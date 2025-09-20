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

// CUBEWALL UNIFORMS
uniform bool u_gpgpu_enableCubeWall;
uniform vec3 u_gpgpu_cubeWallSideColor;
uniform float u_gpgpu_cubeWallBevelWidth;
uniform float u_gpgpu_cubeWallBevelIntensity;
uniform vec2 u_gpgpu_cubeWallGridSize;

// Data from vertex shader
varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vLocalNormal;

#define PI 3.14159265359

// --- BEVEL FUNCTION ---
vec3 getBeveledNormal(vec3 originalNormal, vec2 faceUV, float bevelWidth, float bevelIntensity) {
    if (bevelWidth <= 0.0 || bevelIntensity <= 0.0) {
        return originalNormal;
    }
    vec2 dist_to_center = abs(faceUV - 0.5);
    float dist_to_edge = 0.5 - max(dist_to_center.x, dist_to_center.y);
    float bevel_factor = smoothstep(0.0, bevelWidth, dist_to_edge);
    if (bevel_factor >= 1.0) {
        return originalNormal;
    }
    vec2 edge_dir = step(dist_to_center.y, dist_to_center.x) * vec2(1.0, 0.0) + (1.0 - step(dist_to_center.y, dist_to_center.x)) * vec2(0.0, 1.0);
    edge_dir *= sign(faceUV - 0.5);
    vec3 tangent = (abs(originalNormal.z) > 0.9) ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 0.0, 1.0);
    if (abs(originalNormal.y) > 0.9) tangent = vec3(1.0, 0.0, 0.0);
    vec3 bitangent = cross(originalNormal, tangent);
    vec3 bevel_normal_local = normalize(originalNormal + (tangent * edge_dir.x + bitangent * edge_dir.y) * bevelIntensity);
    return normalize(mix(bevel_normal_local, originalNormal, bevel_factor));
}


// PBR lighting functions (unchanged)
vec3 fresnelSchlick(float cosTheta, vec3 F0) { return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0); }
float DistributionGGX(vec3 N, vec3 H, float roughness) { float a = roughness * roughness; float a2 = a * a; float NdotH = max(dot(N, H), 0.0); float NdotH2 = NdotH * NdotH; float nom = a2; float denom = (NdotH2 * (a2 - 1.0) + 1.0); denom = PI * denom * denom; return nom / max(denom, 0.001); }
float GeometrySchlickGGX(float NdotV, float roughness) { float r = (roughness + 1.0); float k = (r * r) / 8.0; float nom = NdotV; float denom = NdotV * (1.0 - k) + k; return nom / denom; }
float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness) { float NdotV = max(dot(N, V), 0.0); float NdotL = max(dot(N, L), 0.0); float ggx2 = GeometrySchlickGGX(NdotV, roughness); float ggx1 = GeometrySchlickGGX(NdotL, roughness); return ggx1 * ggx2; }

void main() {
    vec3 albedo;
    vec3 N = normalize(vWorldNormal);

    // --- ** THE FIX IS HERE ** ---
    // We now have two distinct paths for coloring: one for the complex CubeWall,
    // and a simple one for all other mesh types (Faceted, Continuous).

    if (u_gpgpu_enableCubeWall) {
        // --- CUBEWALL / GEOCUBE LOGIC ---
        
        // 1. Apply beveling to the normal for edge highlights
        bool isCubeFace = abs(vLocalNormal.z) > 0.9 || abs(vLocalNormal.x) > 0.9 || abs(vLocalNormal.y) > 0.9;
        if (isCubeFace) {
            vec2 faceUV = fract(vUv * u_gpgpu_cubeWallGridSize);
            N = getBeveledNormal(N, faceUV, u_gpgpu_cubeWallBevelWidth, u_gpgpu_cubeWallBevelIntensity);
        }

        // 2. Determine albedo based on face orientation (front vs. side)
        if (abs(vLocalNormal.x) > 0.9 || abs(vLocalNormal.y) > 0.9) {
            // This is a side face of a cube.
            albedo = u_gpgpu_cubeWallSideColor;
        } else {
            // This is a front face. Use the image texture or a default dark color.
            if (gpgpu_cubeWallUseImageTexture) {
                albedo = texture2D(u_map, vUv).rgb;
            } else {
                albedo = vec3(0.1);
            }
        }
    } else {
        // --- FACETED / CONTINUOUS LOGIC ---
        // For any non-CubeWall mesh, we simply apply the texture directly.
        albedo = texture2D(u_map, vUv).rgb;
    }
    
    // --- PBR LIGHTING CALCULATION (now uses the correct normal 'N' and 'albedo') ---
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