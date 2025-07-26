// PBR-related uniforms
uniform sampler2D u_map;
uniform float u_metalness;
uniform float u_roughness;
uniform float u_envMapIntensity;
uniform samplerCube t_envMap;

// Lighting uniforms
uniform vec3 u_lightColor;
uniform vec3 u_ambientLightColor;
uniform vec3 u_lightDirection;
uniform vec3 u_cameraPosition;

// General uniforms
uniform float u_time;
uniform bool gpgpu_cubeWallUseImageTexture;

// TRIANGLE WAVE RENDER UNIFORMS
uniform bool u_gpgpu_enableTriangleWave;
uniform vec3 u_gpgpu_triWaveColor1;
uniform vec3 u_gpgpu_triWaveColor2;

// CUBEWALL UNIFORMS
uniform vec3 u_gpgpu_cubeWallSideColor;


// Data from vertex shader
varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying float vTriangleId;
varying vec3 vLocalNormal;

#define PI 3.14159265359

// PBR lighting functions (unchanged)
vec3 fresnelSchlick(float cosTheta, vec3 F0) { return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0); }
float DistributionGGX(vec3 N, vec3 H, float roughness) { float a = roughness * roughness; float a2 = a * a; float NdotH = max(dot(N, H), 0.0); float NdotH2 = NdotH * NdotH; float nom = a2; float denom = (NdotH2 * (a2 - 1.0) + 1.0); denom = PI * denom * denom; return nom / max(denom, 0.001); }
float GeometrySchlickGGX(float NdotV, float roughness) { float r = (roughness + 1.0); float k = (r * r) / 8.0; float nom = NdotV; float denom = NdotV * (1.0 - k) + k; return nom / denom; }
float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness) { float NdotV = max(dot(N, V), 0.0); float NdotL = max(dot(N, L), 0.0); float ggx2 = GeometrySchlickGGX(NdotV, roughness); float ggx1 = GeometrySchlickGGX(NdotL, roughness); return ggx1 * ggx2; }

void main() {
    vec2 workingUV = vUv;
    vec3 albedo;
    vec3 N = normalize(vWorldNormal);

    // --- A clear, structured path for each geometry mode ---

    if (u_gpgpu_enableTriangleWave) {
        // --- Path 1: Triangle Wave (Faceted Plane) ---
        workingUV.y = 1.0 - workingUV.y;
        albedo = texture2D(u_map, workingUV).rgb;
        N = normalize(cross(dFdx(vWorldPosition), dFdy(vWorldPosition)));
        
        float isEven = mod(vTriangleId, 2.0);
        vec3 baseColor = mix(u_gpgpu_triWaveColor1, u_gpgpu_triWaveColor2, isEven);
        albedo *= baseColor;

    } else if (abs(vLocalNormal.x) > 0.9 || abs(vLocalNormal.y) > 0.9) {
        // --- Path 2: GeoCube Sides ---
        // This condition is only true for the X and Y faces of a cube.
        albedo = u_gpgpu_cubeWallSideColor;

    } else if (abs(vLocalNormal.z) > 0.9) {
        // --- Path 3: GeoCube Front/Back or a Standard Plane ---
        // ** THE FIX IS HERE: Differentiate between a plane and a cube's front face **
        bool isPlane = (vLocalNormal.x == 0.0 && vLocalNormal.y == 0.0);
        
        if (isPlane) {
             // If it's a plane, always use the texture.
            albedo = texture2D(u_map, workingUV).rgb;
        } else {
            // If it's a cube face, check the toggle.
            if (gpgpu_cubeWallUseImageTexture) {
                albedo = texture2D(u_map, workingUV).rgb;
            } else {
                albedo = vec3(0.1); // Fallback color for cube front face when texture is off
            }
        }

    } else {
        // --- Fallback / Default Path (for Continuous Plane) ---
        albedo = texture2D(u_map, workingUV).rgb;
    }
    
    // --- The rest is standard PBR lighting for all modes ---
    float metalness = u_metalness;
    float roughness = u_roughness;
    
    vec3 V = normalize(u_cameraPosition - vWorldPosition);
    vec3 L = normalize(u_lightDirection);
    vec3 H = normalize(V + L);

    vec3 F0 = vec3(0.04);
    F0 = mix(F0, albedo, metalness);
    vec3 Lo = vec3(0.0);
    float NDF = DistributionGGX(N, H, roughness);
    float G = GeometrySmith(N, V, L, roughness);
    vec3 F = fresnelSchlick(max(dot(H, V), 0.0), F0);
    vec3 kS = F;
    vec3 kD = vec3(1.0) - kS;
    kD *= 1.0 - metalness;
    float NdotL = max(dot(N, L), 0.0);
    vec3 numerator = NDF * G * F;
    float denominator = 4.0 * max(dot(N, V), 0.0) * NdotL + 0.001;
    vec3 specular = numerator / denominator;
    Lo += (kD * albedo / PI + specular) * u_lightColor * NdotL;

    vec3 R = reflect(-V, N);
    vec3 envColor = textureCube(t_envMap, R).rgb * u_envMapIntensity;
    vec3 ambient = (kD * envColor * albedo) + (specular * envColor);
    
    vec3 color = Lo + ambient + u_ambientLightColor * albedo;

    // Basic tone mapping and gamma correction
    color = color / (color + vec3(1.0));
    color = pow(color, vec3(1.0/2.2));

    gl_FragColor = vec4(color, 1.0);
}