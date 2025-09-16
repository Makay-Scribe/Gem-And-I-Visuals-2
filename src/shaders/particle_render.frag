// Uniforms from the main material
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

// Color Mode Uniforms
uniform sampler2D u_particleModelUVTexture;
uniform sampler2D u_particleModelTexture;
uniform float u_particleColorMix;
uniform int u_particleColorMode;

// Varyings from the vertex shader
varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vNormal;
// ** THE FIX IS HERE: Receive the correct GPGPU coordinate from the vertex shader. **
varying vec2 vGpgpuUV;

#define PI 3.14159265359

// PBR lighting functions
vec3 fresnelSchlick(float cosTheta, vec3 F0) { return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0); }
float DistributionGGX(vec3 N, vec3 H, float roughness) { float a = roughness * roughness; float a2 = a * a; float NdotH = max(dot(N, H), 0.0); float NdotH2 = NdotH * NdotH; float nom = a2; float denom = (NdotH2 * (a2 - 1.0) + 1.0); denom = PI * denom * denom; return nom / max(denom, 0.001); }
float GeometrySchlickGGX(float NdotV, float roughness) { float r = (roughness + 1.0); float k = (r * r) / 8.0; float nom = NdotV; float denom = NdotV * (1.0 - k) + k; return nom / denom; }
float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness) { float NdotV = max(dot(N, V), 0.0); float NdotL = max(dot(N, L), 0.0); float ggx2 = GeometrySchlickGGX(NdotV, roughness); float ggx1 = GeometrySchlickGGX(NdotL, roughness); return ggx1 * ggx2; }

void main() {
    // --- Step 1: Make the point circular ---
    float dist = distance(gl_PointCoord, vec2(0.5));
    float alpha = 1.0 - smoothstep(0.45, 0.5, dist);
    if (alpha <= 0.0) {
        discard;
    }

    // --- Step 2: Determine Albedo (base color) based on mode ---
    vec3 albedo;
    
    if (u_particleColorMode == 1) { // Chrome Mode
        albedo = vec3(1.0);
    } else if (u_particleColorMode == 2) { // Model Color Mode
        // ** THE FIX IS HERE: This is the core logic change. **
        // 1. We get the default color using the particle's original grid position (`vUv`). This is our "Image Wrap" color.
        vec3 defaultColor = texture(u_map, vUv).rgb;
        
        // 2. We look up the baked UV coordinate for this particle from our baked UV texture,
        //    using the CORRECT lookup coordinate (`vGpgpuUV`).
        vec2 modelUV = texture(u_particleModelUVTexture, vGpgpuUV).rg;
        
        // 3. We use that baked UV coordinate to sample the actual model's texture map.
        vec3 modelColor = texture(u_particleModelTexture, modelUV).rgb;
        
        // 4. We mix between the two colors. The `u_particleColorMix` uniform will be used
        //    for smooth transitions between Default and Model Color modes.
        albedo = mix(defaultColor, modelColor, u_particleColorMix);

    } else { // Default Mode (Image Wrap)
        // Use the particle's original grid position (`vUv`) to sample the main texture.
        albedo = texture(u_map, vUv).rgb;
    }
    
    // --- Step 3: Calculate PBR Lighting ---
    vec3 N = normalize(vNormal);
    vec3 V = normalize(u_cameraPosition - vWorldPosition);
    vec3 L = normalize(u_lightDirection);
    vec3 H = normalize(V + L);

    vec3 F0 = vec3(0.04);
    F0 = mix(F0, albedo, u_metalness); // Use the global u_metalness uniform
    vec3 Lo = vec3(0.0);
    float NDF = DistributionGGX(N, H, u_roughness); // Use the global u_roughness uniform
    float G = GeometrySmith(N, V, L, u_roughness);
    vec3 F = fresnelSchlick(max(dot(H, V), 0.0), F0);
    vec3 kS = F;
    vec3 kD = vec3(1.0) - kS;
    kD *= 1.0 - u_metalness;
    float NdotL = max(dot(N, L), 0.0);
    vec3 numerator = NDF * G * F;
    float denominator = 4.0 * max(dot(N, V), 0.0) * NdotL + 0.001;
    vec3 specular = numerator / denominator;
    Lo += (kD * albedo / PI + specular) * u_lightColor * NdotL;

    vec3 R = reflect(-V, N);
    vec3 envColor = textureCube(t_envMap, R).rgb * u_envMapIntensity;
    vec3 ambient = (kD * envColor * albedo) + (specular * envColor);
    
    vec3 color = Lo + ambient + u_ambientLightColor * albedo;

    color = color / (color + vec3(1.0));
    color = pow(color, vec3(1.0/2.2));

    gl_FragColor = vec4(color, alpha);
}