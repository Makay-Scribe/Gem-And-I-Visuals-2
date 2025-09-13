// Uniforms from the main material
uniform sampler2D u_map;

// Lighting uniforms (for matching the PBR material's look when flat)
uniform vec3 u_lightColor;
uniform vec3 u_ambientLightColor;
uniform vec3 u_lightDirection;

// Varyings from the vertex shader
varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vNormal;

#define PI 3.14159265359

void main() {
    // --- Step 1: Make the point circular ---
    // Calculate distance from the center of the point (0.5, 0.5)
    float dist = distance(gl_PointCoord, vec2(0.5));
    // Create a smooth falloff to the edge for anti-aliasing.
    // This makes the alpha go from 1.0 to 0.0 smoothly between a distance of 0.45 and 0.5.
    float alpha = 1.0 - smoothstep(0.45, 0.5, dist);

    // If the pixel is fully outside the circle, or has zero alpha, discard it.
    if (alpha <= 0.0) {
        discard;
    }

    // --- Step 2: Calculate Color ---
    // Get the base color from the image/video texture
    vec3 albedo = texture(u_map, vUv).rgb;

    // --- Step 3: Approximate PBR Lighting ---
    // This is a simplified lighting model to match the PBR look when the plane is flat,
    // ensuring a seamless transition when we swap materials.
    vec3 N = normalize(vNormal);
    vec3 L = normalize(u_lightDirection);
    
    // Basic diffuse lighting
    float NdotL = max(dot(N, L), 0.0);
    vec3 diffuse = u_lightColor * NdotL;

    // Combine diffuse with ambient light
    vec3 finalColor = albedo * (u_ambientLightColor + diffuse);

    // Final output with calculated alpha for the circular shape
    gl_FragColor = vec4(finalColor, alpha);
}