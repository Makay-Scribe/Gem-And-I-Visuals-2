uniform sampler2D u_positionTexture; // GPGPU position output
uniform sampler2D u_normalTexture;   // GPGPU normal output

attribute vec2 uv_gpgpu; // Custom UV attribute to sample GPGPU textures

// We now send world-space position and normal to the fragment shader
// for consistent lighting calculations.
varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

void main() {
    vUv = uv; // Standard UVs for texture mapping

    // Calculate the GPGPU texture coordinate for this vertex
    // Based on the uv_gpgpu attribute that maps vertex to texel
    vec4 gpgpu_pos_data = texture2D(u_positionTexture, uv_gpgpu);
    vec3 transformedPosition = gpgpu_pos_data.xyz; // XYZ stores the position

    vec4 gpgpu_norm_data = texture2D(u_normalTexture, uv_gpgpu);
    vec3 transformedNormal = gpgpu_norm_data.xyz; // XYZ stores the normal

    // Calculate world position of the vertex
    vec4 worldPos4 = modelMatrix * vec4(transformedPosition, 1.0);
    vWorldPosition = worldPos4.xyz;

    // Calculate world normal by transforming the original normal by the model matrix.
    // We use a 4x4 matrix but treat the normal as a direction (w = 0.0).
    vWorldNormal = normalize((modelMatrix * vec4(transformedNormal, 0.0)).xyz);

    // Final screen position calculation
    gl_Position = projectionMatrix * viewMatrix * worldPos4;
}