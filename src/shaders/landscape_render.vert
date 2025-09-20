uniform sampler2D u_positionTexture;

// Attribute for sampling GPGPU texture, provided by ImagePlaneManager
attribute vec2 uv_gpgpu;

// Varyings to pass to the fragment shader
varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal; // <-- This is what we are fixing
varying vec3 vLocalNormal; // <-- Passing this too, for consistency and potential use

// A "safe" normalize function to prevent NaN values if vertices are co-linear.
vec3 safeNormalize(vec3 v) {
    if (length(v) < 1e-6) { // Use a small epsilon
        return vec3(0.0, 0.0, 1.0); // Default to a Z-facing normal
    }
    return normalize(v);
}


void main() {
    // Pass the original geometry's UVs to the fragment shader for texture mapping.
    vUv = uv;

    // --- 1. Get Displaced Position from GPGPU Texture ---
    vec3 displacedPosition = texture2D(u_positionTexture, uv_gpgpu).xyz;

    // --- 2. Calculate Accurate Normal based on Displacement ---
    // To get a correct normal for a displaced surface, we must sample adjacent points
    // on the GPGPU texture to find the slope of the surface at this vertex.
    vec2 texelSize = 1.0 / vec2(textureSize(u_positionTexture, 0));
    vec3 neighborPos_X = texture2D(u_positionTexture, uv_gpgpu + vec2(texelSize.x, 0.0)).xyz;
    vec3 neighborPos_Y = texture2D(u_positionTexture, uv_gpgpu + vec2(0.0, texelSize.y)).xyz;

    // Create two vectors on the surface plane from the center to the neighbors.
    vec3 tangent = neighborPos_X - displacedPosition;
    vec3 bitangent = neighborPos_Y - displacedPosition;

    // The cross product of these two vectors gives us the normal in local space.
    vLocalNormal = safeNormalize(cross(tangent, bitangent));
    
    // --- 3. Transform to World and View Space ---
    vec4 worldPosition4 = modelMatrix * vec4(displacedPosition, 1.0);
    vWorldPosition = worldPosition4.xyz;
    
    // --- THE FIX IS HERE ---
    // Transform our calculated local normal into world space for the fragment shader.
    // This is the "varying" that was missing from the original file.
    vWorldNormal = normalize(mat3(modelMatrix) * vLocalNormal);
    
    // Calculate the final screen position.
    gl_Position = projectionMatrix * viewMatrix * worldPosition4;
}