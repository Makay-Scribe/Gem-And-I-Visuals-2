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

// *** FIRE & ASH EFFECT UNIFORMS ***
uniform float u_fire_progress;      // This now represents VISUAL progress (0.0 to 1.0)
uniform sampler2D u_fire_colorRamp; // A 1D texture (gradient) for fire colors
uniform vec3 u_fire_ashColor;       // The color for the "ash" phase
uniform float u_ash_twinkleIntensity; // New uniform to control ash flicker
uniform float u_ash_twinkleSpeed;     // New uniform to control ash flicker speed


// Varyings from the vertex shader
varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vGpgpuUV;

#define PI 3.14159265359

// PBR lighting functions (unchanged)
vec3 fresnelSchlick(float cosTheta, vec3 F0) { return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0); }
float DistributionGGX(vec3 N, vec3 H, float roughness) { float a = roughness * roughness; float a2 = a * a; float NdotH = max(dot(N, H), 0.0); float NdotH2 = NdotH * NdotH; float nom = a2; float denom = (NdotH2 * (a2 - 1.0) + 1.0); denom = PI * denom * denom; return nom / max(denom, 0.001); }
float GeometrySchlickGGX(float NdotV, float roughness) { float r = (roughness + 1.0); float k = (r * r) / 8.0; float nom = NdotV; float denom = NdotV * (1.0 - k) + k; return nom / denom; }
float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness) { float NdotV = max(dot(N, V), 0.0); float NdotL = max(dot(N, L), 0.0); float ggx2 = GeometrySchlickGGX(NdotV, roughness); float ggx1 = GeometrySchlickGGX(NdotL, roughness); return ggx1 * ggx2; }

// Simplex Noise (snoise) function (unchanged)
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) { const vec2 C = vec2(1.0/6.0, 1.0/3.0); const vec4 D = vec4(0.0, 0.5, 1.0, 2.0); vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx); vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g; vec3 i1 = min( g.xyz, l.zxy ); vec3 i2 = max( g.xyz, l.zxy ); vec3 x1 = x0 - i1 + C.xxx; vec3 x2 = x0 - i2 + C.yyy; vec3 x3 = x0 - D.yyy; i = mod289(i); vec4 p = permute( permute( permute( i.z + vec4(0.0, i1.z, i2.z, 1.0 )) + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) + i.x + vec4(0.0, i1.x, i2.x, 1.0 )); float n_ = 0.142857142857; vec3 ns = n_ * D.wyz - D.xzx; vec4 j = p - 49.0 * floor(p * ns.z * ns.z); vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_ ); vec4 x = x_ *ns.x + ns.yyyy; vec4 y = y_ *ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y); vec4 b0 = vec4( x.xy, y.xy ); vec4 b1 = vec4( x.zw, y.zw ); vec4 s0 = floor(b0)*2.0 + 1.0; vec4 s1 = floor(b1)*2.0 + 1.0; vec4 sh = -step(h, vec4(0.0)); vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ; vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ; vec3 p0 = vec3(a0.xy,h.x); vec3 p1 = vec3(a0.zw,h.y); vec3 p2 = vec3(a1.xy,h.z); vec3 p3 = vec3(a1.zw,h.w); vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3))); p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w; vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0); m = m * m; return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) ); }

void main() {
    float dist = distance(gl_PointCoord, vec2(0.5));
    if (dist > 0.5) { discard; }
    float alpha = 1.0 - smoothstep(0.45, 0.5, dist);

    // --- PBR Color Calculation ---
    vec3 imageWrapColor = texture(u_map, vUv).rgb;
    vec2 modelUV = texture(u_particleModelUVTexture, vGpgpuUV).rg;
    vec3 modelColor = texture(u_particleModelTexture, modelUV).rgb;
    vec3 albedo = mix(imageWrapColor, modelColor, u_particleColorMix);
    
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

    // --- Final Color Initialization ---
    vec3 final_color = pbr_color;

    // *** DECOUPLED FIRE & ASH EFFECT LOGIC ***
    // This logic branch is taken if either the fire is burning OR the ash is still visible.
    // The ash_fade_progress allows the ash to have its own lifecycle after the fire is out.
    float ash_fade_progress = (1.0 - u_fire_progress);
    if (u_fire_progress > 0.0 || u_ash_twinkleIntensity > 0.0) {
        
        // --- Fire Calculation (Only happens when u_fire_progress is > 0) ---
        float fire_noise = snoise(vec3(vGpgpuUV * 15.0, u_time * 5.0)) * 0.5 + 0.5;
        float ramp_coord = clamp(fire_noise, 0.0, 1.0);
        vec3 fire_color = texture(u_fire_colorRamp, vec2(ramp_coord, 0.5)).rgb;
        vec3 emissive_fire = fire_color * pow(u_fire_progress, 2.0) * 5.0;

        // --- Ash Calculation (Happens as fire fades and ash twinkles) ---
        vec3 ash_color = u_fire_ashColor;
        if (u_ash_twinkleIntensity > 0.0) {
            float twinkle_noise = snoise(vec3(vGpgpuUV * 40.0, u_time * u_ash_twinkleSpeed)); // Fast noise
            float twinkle_factor = mix(1.0, twinkle_noise * 0.5 + 0.5, u_ash_twinkleIntensity);
            ash_color *= twinkle_factor;
        }
        
        // --- Blending ---
        // Blend the emissive fire and the dark ash. Fire is dominant at high progress.
        vec3 effect_color = mix(ash_color, emissive_fire, u_fire_progress);
        
        // Mix the final PBR color with our effect color.
        // We use a separate progress for fading to ash to make it linger.
        float total_effect_mix = clamp(u_fire_progress + u_ash_twinkleIntensity, 0.0, 1.0);
        final_color = mix(pbr_color, effect_color, total_effect_mix);
    }
    
    // Twinkle Effect (unchanged)
    if (u_particle_twinkleIntensity > 0.0) {
        float noiseVal = snoise(vec3(vUv * 10.0, u_time * 0.3));
        noiseVal = (noiseVal + 1.0) * 0.5;
        float activation_threshold = 0.95;
        float adjusted_threshold = activation_threshold - (u_particle_twinkleIntensity * 0.2);
        if (noiseVal > adjusted_threshold) {
            vec2 coord = (gl_PointCoord - 0.5) * 2.0; 
            float starburst = 0.0;
            starburst = max(starburst, 1.0 - abs(coord.x)); starburst = max(starburst, 1.0 - abs(coord.y)); starburst = max(starburst, 1.0 - abs(coord.x - coord.y)); starburst = max(starburst, 1.0 - abs(coord.x + coord.y)); 
            starburst = pow(starburst, 15.0); 
            float core_flash = 1.0 - dist * 2.0; 
            core_flash = pow(core_flash, 3.0);
            float flash_strength = smoothstep(adjusted_threshold, 1.0, noiseVal);
            float combined_flash = (core_flash * 2.0 + starburst) * flash_strength;
            final_color += vec3(combined_flash * 50.0);
        }
    }

    // --- Final Output ---
    vec3 color = final_color / (final_color + vec3(1.0)); // Simple tone mapping
    color = pow(color, vec3(1.0/2.2)); // Gamma correction

    gl_FragColor = vec4(color, alpha);
}