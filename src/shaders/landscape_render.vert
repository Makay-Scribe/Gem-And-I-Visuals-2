uniform sampler2D u_positionTexture; // GPGPU position output
uniform sampler2D u_normalTexture;   // GPGPU normal output
uniform vec2 u_planeResolution;     // Resolution of the GPGPU textures

attribute vec2 uv_gpgpu; // Custom UV attribute to sample GPGPU textures

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
    vUv = uv; // Standard UVs for texture mapping

    // Calculate the GPGPU texture coordinate for this vertex
    // Based on the uv_gpgpu attribute that maps vertex to texel
    vec4 gpgpu_pos_data = texture2D(u_positionTexture, uv_gpgpu);
    vec3 transformedPosition = gpgpu_pos_data.xyz; // XYZ stores the position

    vec4 gpgpu_norm_data = texture2D(u_normalTexture, uv_gpgpu);
    vec3 transformedNormal = gpgpu_norm_data.xyz; // XYZ stores the normal

    // Calculate world position
    vec4 worldPosition = modelMatrix * vec4(transformedPosition, 1.0);
    
    // Calculate transformed normal in world space
    vNormal = normalize(normalMatrix * transformedNormal); // normalMatrix transforms normal to view space
    vViewPosition = -worldPosition.xyz; // View position in camera space

    gl_Position = projectionMatrix * viewMatrix * worldPosition;
}