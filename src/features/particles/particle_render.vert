uniform sampler2D u_positionTexture;
uniform float particle_base_size;
uniform float particle_min_size;
uniform float u_particle_size_mix;
uniform float u_pixelRatio;

attribute vec2 gpgpu_uv;

varying vec2 vUv; 
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vGpgpuUV;

vec3 safeNormalize(vec3 v) {
    if (length(v) == 0.0) return vec3(0.0, 0.0, 1.0);
    return normalize(v);
}

void main() {
    vec3 pos_center = texture(u_positionTexture, gpgpu_uv).xyz;
    
    vGpgpuUV = gpgpu_uv;
    vUv = vec2(gpgpu_uv.x, 1.0 - gpgpu_uv.y); 

    // Calculate Normal
    vec2 texelSize = 1.0 / vec2(textureSize(u_positionTexture, 0));
    vec2 uv_right = clamp(gpgpu_uv + vec2(texelSize.x, 0.0), 0.0, 1.0);
    vec2 uv_up = clamp(gpgpu_uv + vec2(0.0, texelSize.y), 0.0, 1.0);
    vec3 pos_right = texture(u_positionTexture, uv_right).xyz;
    vec3 pos_up = texture(u_positionTexture, uv_up).xyz; 
    vNormal = safeNormalize(cross(pos_right - pos_center, pos_up - pos_center));
    
    vWorldPosition = pos_center;
    vec4 mvPosition = modelViewMatrix * vec4(pos_center, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    float targetSize = mix(particle_base_size, particle_min_size, u_particle_size_mix);
    gl_PointSize = targetSize * (300.0 / -mvPosition.z) * u_pixelRatio;
}