uniform sampler2D u_positionTexture;
uniform vec2 u_texelSize;

varying vec2 vUv;
varying vec3 vViewPosition;
varying vec3 vNormal;
varying vec3 vWorldPosition;

void main() {
    vUv = uv;

    // 1. Read Position (The Displacement) from GPGPU
    vec3 pos = texture2D(u_positionTexture, uv).xyz;

    // 2. Calculate Smooth Normals on the fly
    // We sample neighbors to figure out the slope of the liquid surface
    float eps = 1.0; // Step size (1 pixel)
    
    vec3 posRight = texture2D(u_positionTexture, uv + vec2(u_texelSize.x * eps, 0.0)).xyz;
    vec3 posUp    = texture2D(u_positionTexture, uv + vec2(0.0, u_texelSize.y * eps)).xyz;
    
    // Calculate tangent vectors
    vec3 tangentX = posRight - pos;
    vec3 tangentY = posUp - pos;
    
    // Cross product gives the normal perpendicular to the surface
    // Normalize ensures lighting behaves correctly
    vec3 newNormal = normalize(cross(tangentX, tangentY));
    vNormal = normalMatrix * newNormal;

    // 3. Standard Transforms
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    vViewPosition = -mvPosition.xyz;
    
    vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;

    gl_Position = projectionMatrix * mvPosition;
}