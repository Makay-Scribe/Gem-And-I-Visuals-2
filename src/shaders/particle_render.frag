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

// ** THE FIX IS HERE: Add uniforms for the twinkle effect **
uniform float u_time;
uniform float u_particle_twinkleIntensity;

// Varyings from the vertex shader
varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vNormal;
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

    // --- Step 2: Determine Albedo (base color) ---
    vec3 imageWrapColor = texture(u_map, vUv).rgb;
    vec2 modelUV = texture(u_particleModelUVTexture, vGpgpuUV).rg;
    vec3 modelColor = texture(u_particleModelTexture, modelUV).rgb;
    vec3 albedo = mix(imageWrapColor, modelColor, u_particleColorMix);

    
    // --- Step 3: Calculate PBR Lighting ---
    vec3 N = normalize(vNormal);
    vec3 V = normalize(u_cameraPosition - vWorldPosition);
    vec3 L = normalize(u_lightDirection);
    vec3 H = normalize(V + L);

    vec3 F0 = vec3(0.04);
    F0 = mix(F0, albedo, u_metalness);
    vec3 Lo = vec3(0.0);
    float NDF = DistributionGGX(N, H, u_roughness);
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
    
    vec3 pbr_color = Lo + ambient + u_ambientLightColor * albedo;

    // ** THE FIX IS HERE: Add the twinkle effect logic **
    // --- Step 4: Twinkle Effect ---
    float twinkleFactor = 1.0;
    if (u_particle_twinkleIntensity > 0.0) {
        // Create a unique, pseudo-random seed for each particle based on its grid position
        float random_seed = fract(sin(dot(vUv.xy, vec2(12.9898, 78.233))) * 43758.5453);
        // Animate this seed over time to create a pulse (from -1.0 to 1.0)
        float twinklePulse = sin(u_time * 5.0 + random_seed * (PI * 2.0));
        // Remap the pulse to a 0.0 to 1.0 range
        twinklePulse = twinklePulse * 0.5 + 0.5;
        // Mix between no effect (a multiplier of 1.0) and full twinkle effect (a multiplier of 1.0 + pulse)
        // This makes particles get brighter, but not darker.
        twinkleFactor = mix(1.0, 1.0 + twinklePulse, u_particle_twinkleIntensity);
    }
    
    vec3 color = pbr_color * twinkleFactor;


    color = color / (color + vec3(1.0));
    color = pow(color, vec3(1.0/2.2));

    gl_FragColor = vec4(color, alpha);
}// Uniforms from the main material
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

// ** THE FIX IS HERE: Add uniforms for the twinkle effect **
uniform float u_time;
uniform float u_particle_twinkleIntensity;

// Varyings from the vertex shader
varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vNormal;
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

    // --- Step 2: Determine Albedo (base color) ---
    vec3 imageWrapColor = texture(u_map, vUv).rgb;
    vec2 modelUV = texture(u_particleModelUVTexture, vGpgpuUV).rg;
    vec3 modelColor = texture(u_particleModelTexture, modelUV).rgb;
    vec3 albedo = mix(imageWrapColor, modelColor, u_particleColorMix);

    
    // --- Step 3: Calculate PBR Lighting ---
    vec3 N = normalize(vNormal);
    vec3 V = normalize(u_cameraPosition - vWorldPosition);
    vec3 L = normalize(u_lightDirection);
    vec3 H = normalize(V + L);

    vec3 F0 = vec3(0.04);
    F0 = mix(F0, albedo, u_metalness);
    vec3 Lo = vec3(0.0);
    float NDF = DistributionGGX(N, H, u_roughness);
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
    
    vec3 pbr_color = Lo + ambient + u_ambientLightColor * albedo;

    // ** THE FIX IS HERE: Add the twinkle effect logic **
    // --- Step 4: Twinkle Effect ---
    float twinkleFactor = 1.0;
    if (u_particle_twinkleIntensity > 0.0) {
        // Create a unique, pseudo-random seed for each particle based on its grid position
        float random_seed = fract(sin(dot(vUv.xy, vec2(12.9898, 78.233))) * 43758.5453);
        // Animate this seed over time to create a pulse (from -1.0 to 1.0)
        float twinklePulse = sin(u_time * 5.0 + random_seed * (PI * 2.0));
        // Remap the pulse to a 0.0 to 1.0 range
        twinklePulse = twinklePulse * 0.5 + 0.5;
        // Mix between no effect (a multiplier of 1.0) and full twinkle effect (a multiplier of 1.0 + pulse)
        // This makes particles get brighter, but not darker.
        twinkleFactor = mix(1.0, 1.0 + twinklePulse, u_particle_twinkleIntensity);
    }
    
    vec3 color = pbr_color * twinkleFactor;


    color = color / (color + vec3(1.0));
    color = pow(color, vec3(1.0/2.2));

    gl_FragColor = vec4(color, alpha);
}