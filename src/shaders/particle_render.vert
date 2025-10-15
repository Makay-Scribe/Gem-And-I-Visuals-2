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

// A "safe" normalize function to prevent NaN errors.
vec3 safeNormalize(vec3 v) {
    if (length(v) == 0.0) {
        return vec3(0.0, 0.0, 1.0);
    }
    return normalize(v);
}

void main() {
    vUv = uv;
    vec2 gpgpu_uv = vec2(uv.x, 1.0 - uv.y);
    vGpgpuUV = gpgpu_uv;

    vec3 pos_center = texture(u_positionTexture, gpgpu_uv).xyz;
    
    vec2 texelSize = 1.0 / vec2(textureSize(u_positionTexture, 0));
    vec3 pos_right = texture(u_positionTexture, gpgpu_uv + vec2(texelSize.x, 0.0)).xyz;
    vec3 pos_up = texture(u_positionTexture, gpgpu_uv - vec2(0.0, texelSize.y)).xyz;
    
    vNormal = safeNormalize(cross(pos_right - pos_center, pos_up - pos_center));
    
    vWorldPosition = pos_center;
    vec4 mvPosition = modelViewMatrix * vec4(pos_center, 1.0);
    
    gl_Position = projectionMatrix * mvPosition;
    
    // ** THE FIX IS HERE: Implement perspective-correct particle sizing. **
    // This formula is now identical to the one used by the main particle engine.
    // It calculates the size the point *should* be in pixels on the screen,
    // taking into account its distance from the camera (`-mvPosition.z`).
    float targetSize = mix(particle_base_size, particle_min_size, u_particle_size_mix);
    gl_PointSize = targetSize * (300.0 / -mvPosition.z) * u_pixelRatio;
}