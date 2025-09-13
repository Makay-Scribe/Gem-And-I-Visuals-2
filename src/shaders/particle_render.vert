uniform sampler2D u_positionTexture;
uniform sampler2D u_velocityTexture;
uniform float particle_base_size;
uniform float particle_min_size;
uniform float u_morphProgress;

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
    
    // ** THE FIX IS HERE: Corrected state-based sizing logic **
    float speed = length(velocity);
    
    // Determine if the particle is in an "active" state (either moving or morphed)
    // A speed greater than a tiny threshold (0.01) means it's moving.
    // A morph progress less than 1.0 means it's not fully in its flat state.
    bool isActive = speed > 0.01 || u_morphProgress < 1.0;
    
    // If it's active, use the min_size. Otherwise, use the base_size.
    float targetSize = isActive ? particle_min_size : particle_base_size;
    
    // Apply the final perspective-correct sizing.
    gl_PointSize = targetSize * (300.0 / length(mvPosition.xyz));
}