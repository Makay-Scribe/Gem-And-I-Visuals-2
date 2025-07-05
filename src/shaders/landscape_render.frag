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

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;

#define PI 3.14159265359

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
    // Surface properties
    vec3 albedo = texture2D(u_map, vUv).rgb;
    float metalness = u_metalness;
    float roughness = u_roughness;

    // Vectors
    vec3 N = normalize(vNormal);
    vec3 V = normalize(u_cameraPosition - vViewPosition);
    vec3 L = normalize(u_lightDirection);
    vec3 H = normalize(V + L);

    // PBR calculations
    vec3 F0 = vec3(0.04);
    F0 = mix(F0, albedo, metalness);

    // Radiance
    vec3 Lo = vec3(0.0);
    
    float NDF = DistributionGGX(N, H, roughness);
    float G = GeometrySmith(N, V, L, roughness);
    vec3 F = fresnelSchlick(max(dot(H, V), 0.0), F0);
    
    vec3 kS = F;
    vec3 kD = vec3(1.0) - kS;
    kD *= 1.0 - metalness;

    float NdotL = max(dot(N, L), 0.0);

    // Specular BRDF
    vec3 numerator = NDF * G * F;
    float denominator = 4.0 * max(dot(N, V), 0.0) * NdotL + 0.001;
    vec3 specular = numerator / denominator;

    // Add lighting
    Lo += (kD * albedo / PI + specular) * u_lightColor * NdotL;

    // Ambient light using environment map
    vec3 R = reflect(-V, N);
    vec3 envColor = textureCube(t_envMap, R).rgb * u_envMapIntensity;
    vec3 ambient = (kD * envColor * albedo) + (specular * envColor);
    
    // Final color
    vec3 color = Lo + ambient + u_ambientLightColor * albedo;
    color = color / (color + vec3(1.0)); // Basic Reinhard tone mapping
    color = pow(color, vec3(1.0/2.2)); // Gamma correction

    gl_FragColor = vec4(color, 1.0);
}