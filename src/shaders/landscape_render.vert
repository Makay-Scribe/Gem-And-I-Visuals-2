uniform sampler2D u_positionTexture; // Re-enable
uniform sampler2D u_normalTexture;   // Re-enable

attribute vec2 uv_gpgpu; // This is the special UV map we need to use

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
    vUv = uv; // The standard UVs are still used for the main image/video texture

    // --- THE FIX IS HERE ---
    // Look up the position and normal data using the special 'uv_gpgpu' attribute
    // instead of the standard 'uv' attribute.
    vec4 gpgpu_pos_data = texture2D(u_positionTexture, uv_gpgpu);
    vec3 transformedPosition = gpgpu_pos_data.xyz;

    vec4 gpgpu_norm_data = texture2D(u_normalTexture, uv_gpgpu);
    vec3 transformedNormal = gpgpu_norm_data.xyz;

    vec4 worldPosition = modelMatrix * vec4(transformedPosition, 1.0);
    
    vNormal = normalize(normalMatrix * transformedNormal);
    vViewPosition = -worldPosition.xyz;

    gl_Position = projectionMatrix * viewMatrix * worldPosition;
}