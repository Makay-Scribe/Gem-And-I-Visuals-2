// src/compute/shaders/sph_position.glsl - V4 (Cleaned for Unified ComputeManager)

uniform float u_delta;
uniform float u_worldSize;

uniform float u_manualMorph; // The 0-1 value from the slider
uniform int u_targetState;   // The target (0 for Canvas, 1 for Model)
uniform sampler2D u_initialPosition;
uniform sampler2D u_modelPosition;

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;

    vec3 position = texture(texturePosition, uv).xyz;
    vec3 velocity = texture(textureVelocity, uv).xyz;

    // Standard Verlet integration: Update the position based on velocity.
    vec3 physics_pos = position + velocity * u_delta;

    vec3 final_pos;
    if (u_manualMorph > 0.0) {
        // If the user is using the manual slider, blend between the physics
        // result and the hard target position.
        vec3 target_pos = (u_targetState == 1) ? texture(u_modelPosition, uv).xyz : texture(u_initialPosition, uv).xyz;
        final_pos = mix(physics_pos, target_pos, u_manualMorph);
    } else {
        // If the slider is at 0, just use the pure physics result.
        final_pos = physics_pos;
    }
    
    // --- BUG FIX ---
    // The hardcoded debug line `final_pos.z += 5.0;` has been removed.
    // --- END BUG FIX ---

    // Add boundary clamping logic.
    float halfWorld = u_worldSize / 2.0;
    final_pos = clamp(final_pos, -halfWorld, halfWorld);

    // Write the new, clamped position to the output texture.
    gl_FragColor = vec4(final_pos, 1.0);
}