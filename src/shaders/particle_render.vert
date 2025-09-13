uniform sampler2D u_positionTexture;
uniform sampler2D u_velocityTexture;
uniform float particle_base_size;
uniform float particle_min_size;
uniform float u_morphProgress;
uniform float u_particleTargetIsModel; // 0.0 for flat, 1.0 for model
uniform float u_pixelRatio; // NEW: The browser's zoom/pixel density

varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vNormal;

void main() {
    vUv = uv;

    vec2 gpgpu_uv = vec2(uv.x, 1.0 - uv.y);
    vec3 pos_center = texture(u_positionTexture, gpgpu_uv).xyz;
    vec3 velocity = texture(u_velocityTexture, gpgpu_uv).xyz;

    vec2 texelSize = 1.0 / vec2(textureSize(u_positionTexture, 0));
    vec3 pos_right = texture(u_positionTexture, gpgpu_uv + vec2(texelSize.x, 0.0)).xyz;
    vec3 pos_up = texture(u_positionTexture, gpgpu_uv - vec2(0.0, texelSize.y)).xyz;
    
    vNormal = normalize(cross(pos_right - pos_center, pos_up - pos_center));
    
    vWorldPosition = pos_center;
    vec4 mvPosition = modelViewMatrix * vec4(pos_center, 1.0);
    
    gl_Position = projectionMatrix * mvPosition;
    
    // --- FINAL, ROBUST SIZING LOGIC ---
    bool isActive = u_morphProgress < 0.99 || u_particleTargetIsModel > 0.5;
    float targetSize = isActive ? particle_min_size : particle_base_size;
    
    // Apply perspective scaling AND zoom/pixel ratio correction
    // By multiplying by u_pixelRatio, we ensure the final size in screen-space
    // is correct, regardless of browser zoom.
    gl_PointSize = targetSize * (300.0 / -mvPosition.z) * u_pixelRatio;
}