uniform sampler2D u_positionTexture;
// UNUSED: uniform sampler2D u_velocityTexture;
uniform float particle_base_size;
uniform float particle_min_size;
uniform float u_particle_size_mix; // 0.0 = base size, 1.0 = min size
uniform float u_pixelRatio;

varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vGpgpuUV;

void main() {
    vUv = uv;
    vec2 gpgpu_uv = vec2(uv.x, 1.0 - uv.y);
    vGpgpuUV = gpgpu_uv;

    vec3 pos_center = texture(u_positionTexture, gpgpu_uv).xyz;
    // UNUSED: vec3 velocity = texture(u_velocityTexture, gpgpu_uv).xyz;

    vec2 texelSize = 1.0 / vec2(textureSize(u_positionTexture, 0));
    vec3 pos_right = texture(u_positionTexture, gpgpu_uv + vec2(texelSize.x, 0.0)).xyz;
    vec3 pos_up = texture(u_positionTexture, gpgpu_uv - vec2(0.0, texelSize.y)).xyz;
    
    vNormal = normalize(cross(pos_right - pos_center, pos_up - pos_center));
    
    vWorldPosition = pos_center;
    vec4 mvPosition = modelViewMatrix * vec4(pos_center, 1.0);
    
    gl_Position = projectionMatrix * mvPosition;
    
    float targetSize = mix(particle_base_size, particle_min_size, u_particle_size_mix);
    
    gl_PointSize = targetSize * (300.0 / -mvPosition.z) * u_pixelRatio;
}