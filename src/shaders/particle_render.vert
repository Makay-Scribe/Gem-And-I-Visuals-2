uniform sampler2D u_positionTexture;
uniform float particle_size;

varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vNormal;

void main() {
    // The `uv` attribute is now correctly "bottom-up"
    vUv = uv;

    // ** THE FIX IS HERE: Manually flip the Y-coord for GPGPU texture lookup **
    // The GPGPU texture's (0,0) is top-left, so we need to sample it with a flipped V coordinate.
    vec2 gpgpu_uv = vec2(uv.x, 1.0 - uv.y);
    vec3 pos_center = texture(u_positionTexture, gpgpu_uv).xyz;

    // Use the flipped GPGPU UV to sample neighbors correctly
    vec2 texelSize = 1.0 / vec2(textureSize(u_positionTexture, 0));
    vec3 pos_right = texture(u_positionTexture, gpgpu_uv + vec2(texelSize.x, 0.0)).xyz;
    vec3 pos_up = texture(u_positionTexture, gpgpu_uv - vec2(0.0, texelSize.y)).xyz; // Sample downwards in texture space, which is upwards in world space
    
    vNormal = normalize(cross(pos_right - pos_center, pos_up - pos_center));
    
    vWorldPosition = pos_center;
    vec4 mvPosition = modelViewMatrix * vec4(pos_center, 1.0);
    
    gl_Position = projectionMatrix * mvPosition;
    
    gl_PointSize = particle_size * (35.0 / -mvPosition.z);
}