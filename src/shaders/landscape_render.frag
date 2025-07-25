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
uniform float u_audioLow;

// Balloon Effect Uniforms
uniform bool u_imageEffect_enableBalloon;
uniform vec2 u_imageEffect_point;
uniform float u_imageEffect_strength;
uniform float u_imageEffect_radius;
uniform float u_imageEffect_audioInfluence;

// Jolt uniforms
uniform bool u_imageEffect_enableJolt;
uniform float u_imageEffect_joltStrength;
uniform float u_imageEffect_joltSpeed;
uniform float u_imageEffect_joltAudioInfluence;

// TRIANGLE WAVE RENDER UNIFORMS
uniform bool u_gpgpu_enableTriangleWave;
uniform vec3 u_gpgpu_triWaveColor1;
uniform vec3 u_gpgpu_triWaveColor2;


// Data from vertex shader (now in world space)
varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying float vTriangleId;

#define PI 3.14159265359

// Simplified balloon effect function
vec2 balloonLensEffect(vec2 uv, vec2 effectCenter, float audio, float amount, float radius) {
    vec2 diff = uv - effectCenter;
    float dist = length(diff);

    float outerRadius = radius * (0.3 + audio * 1.0);
    float innerRadius = outerRadius * (0.2 + (1.0 - amount) * 0.6);
    
    float falloff = 1.0 - smoothstep(innerRadius, outerRadius, dist);

    if (falloff > 0.001) {
        float lensStrength = amount * (0.2 + audio * 0.8) * falloff;
        float normalizedDist = dist / outerRadius;
        float angle = atan(diff.y, diff.x);
        
        float newRadius = pow(normalizedDist, 1.0 + lensStrength * 2.5) * outerRadius;
        
        diff.x = newRadius * cos(angle);
        diff.y = newRadius * sin(angle);
        uv = effectCenter + diff;
    }
    return uv;
}

vec2 textureJoltEffect(vec2 uv, float time, float audio, float strength, float speed, float audioInfluence) {
    float audioMod = 1.0 + audio * audioInfluence;
    float offsetX = sin(time * speed) * strength * audioMod;
    float offsetY = cos(time * speed * 0.8) * strength * audioMod; // Use a different multiplier for a less circular motion
    return uv + vec2(offsetX, offsetY);
}

// Basic PBR lighting functions
vec3 fresnelSchlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

float DistributionGGX(vec3 N, vec3 H, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH = max(dot(N, H), 0.0);
    float NdotH2 = NdotH * NdotH;
    float nom = a2;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;
    return nom / max(denom, 0.001);
}

float GeometrySchlickGGX(float NdotV, float roughness) {
    float r = (roughness + 1.0);
    float k = (r * r) / 8.0;
    float nom = NdotV;
    float denom = NdotV * (1.0 - k) + k;
    return nom / denom;
}

float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float ggx2 = GeometrySchlickGGX(NdotV, roughness);
    float ggx1 = GeometrySchlickGGX(NdotL, roughness);
    return ggx1 * ggx2;
}

void main() {
    vec2 workingUV = vUv;
    
    // Image effects modify the UV coordinates before texturing
    if (u_imageEffect_enableBalloon) {
        float audioMod = u_audioLow * u_imageEffect_audioInfluence;
        workingUV = balloonLensEffect(workingUV, u_imageEffect_point, audioMod, u_imageEffect_strength, u_imageEffect_radius);
    }

    if (u_imageEffect_enableJolt) {
        workingUV = textureJoltEffect(workingUV, u_time, u_audioLow, u_imageEffect_joltStrength, u_imageEffect_joltSpeed, u_imageEffect_joltAudioInfluence);
    }

    vec3 albedo;
    vec3 N; // The final normal used for lighting
    
    if (u_gpgpu_enableTriangleWave) {
        // ** THE FIX IS HERE: Flip the Y-coordinate for the texture **
        workingUV.y = 1.0 - workingUV.y;

        albedo = texture2D(u_map, workingUV).rgb;

        // For the faceted Triangle Wave, calculate the flat face normal on the fly using derivatives.
        N = normalize(cross(dFdx(vWorldPosition), dFdy(vWorldPosition)));
        
        // Modulate the main texture color with the triangle's unique base color
        float isEven = mod(vTriangleId, 2.0);
        vec3 baseColor = mix(u_gpgpu_triWaveColor1, u_gpgpu_triWaveColor2, isEven);
        albedo *= baseColor;
    } else {
        albedo = texture2D(u_map, workingUV).rgb;
        // For the standard GPGPU-driven plane, use the smooth interpolated normal from the vertex shader.
        N = normalize(vWorldNormal);
    }

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