uniform sampler2D u_positionTexture; // GPGPU position output

// REMOVED: Triangle Wave uniforms are no longer needed.

attribute vec2 uv_gpgpu; // Custom UV attribute to sample GPGPU textures

varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vLocalNormal;

// REMOVED: The snoise function is no longer needed in this shader.

void main() {
    vUv = uv; 
    vLocalNormal = normal;
    
    vec3 transformedPosition;

    // The 'if' condition for triangle wave has been removed. We always use the GPGPU texture now.
    vec4 gpgpu_pos_data = texture2D(u_positionTexture, uv_gpgpu);
    transformedPosition = gpgpu_pos_data.xyz;

    vec4 worldPos4 = modelMatrix * vec4(transformedPosition, 1.0);
    vWorldPosition = worldPos4.xyz;

    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);

    gl_Position = projectionMatrix * viewMatrix * worldPos4;
}