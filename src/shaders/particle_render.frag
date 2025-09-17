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

// Twinkle effect uniforms
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

// Simple pseudo-random number function
float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

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

    // --- Step 4: Advanced Twinkle Effect ---
    vec3 final_color = pbr_color;
    if (u_particle_twinkleIntensity > 0.0) {
        // Generate a random value that changes slowly over time for each particle
        float twinkle_noise = rand(vUv + sin(u_time * 0.1));

        // Define a very high threshold for a particle to "flash"
        // The twinkle intensity slider makes it more likely to pass this threshold
        float flash_threshold = 0.999;
        float flash_probability = u_particle_twinkleIntensity * 0.1; // small multiplier to make slider feel right
        
        if (twinkle_noise > flash_threshold - flash_probability) {
            // This particle is "active" for this frame.
            
            // 1. Create the starburst "shine lines"
            vec2 coord = (gl_PointCoord - 0.5) * 2.0; // -1.0 to 1.0
            float starburst = 0.0;
            starburst = max(starburst, 1.0 - abs(coord.x)); // Vertical line
            starburst = max(starburst, 1.0 - abs(coord.y)); // Horizontal line
            starburst = max(starburst, 1.0 - abs(coord.x - coord.y)); // Diagonal
            starburst = max(starburst, 1.0 - abs(coord.x + coord.y)); // Anti-diagonal
            starburst = pow(starburst, 15.0); // Make lines sharp
            
            // 2. Create the bright core flash
            float core_flash = 1.0 - dist * 2.0; // Brightest at the center
            core_flash = pow(core_flash, 3.0);
            
            // 3. Combine and add to the base color, making it extremely bright
            // This high value is what the bloom filter will pick up later.
            float combined_flash = (core_flash * 2.0 + starburst) * u_particle_twinkleIntensity;
            final_color += vec3(combined_flash * 50.0);
        }
    }

    // --- Final Color Processing ---
    vec3 color = final_color / (final_color + vec3(1.0));
    color = pow(color, vec3(1.0/2.2));

    gl_FragColor = vec4(color, alpha);
}