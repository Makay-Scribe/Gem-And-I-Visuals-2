uniform sampler2D u_positionTexture;

// Attribute for sampling GPGPU texture, provided by ImagePlaneManager
attribute vec2 uv_gpgpu;

// Varyings to pass to the fragment shader
varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vLocalNormal;
varying float vTriangleId;

// A "safe" normalize function is no longer needed here, but kept in common.glsl


void main() {
    // Pass the corrected UVs to the fragment shader for texture mapping.
    vUv = vec2(uv.x, 1.0 - uv.y);
    
    // This varying is required by the fragment shader but not used in this mode.
    vTriangleId = 0.0;

    // --- 1. Get Displaced Position from GPGPU Texture ---
    // This is now the ONLY texture read in this shader.
    vec3 displacedPosition = texture2D(u_positionTexture, uv_gpgpu).xyz;

    // --- 2. Remove Normal Calculation ---
    // The normal will now be calculated in the fragment shader using dFdx/dFdy.
    // We pass dummy values to satisfy the varying linkage, as the fragment shader
    // is shared with cubewall mode which DOES use these.
    vLocalNormal = vec3(0.0, 0.0, 1.0);
    vWorldNormal = vec3(0.0, 0.0, 1.0);
    
    // --- 3. Transform to World and View Space ---
    vec4 worldPosition4 = modelMatrix * vec4(displacedPosition, 1.0);
    vWorldPosition = worldPosition4.xyz; // Pass world position to fragment shader for normal calculation
    
    gl_Position = projectionMatrix * viewMatrix * worldPosition4;
}