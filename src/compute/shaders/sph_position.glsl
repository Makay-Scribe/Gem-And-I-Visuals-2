// src/compute/shaders/sph_position.glsl - V5 (Simplified for Force-Based System)

uniform float u_delta;
uniform float u_worldSize;

// These uniforms are no longer needed here as blending is removed.
// uniform float u_manualMorph;
// uniform int u_targetState;
// uniform sampler2D u_initialPosition;
// uniform sampler2D u_modelPosition;

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;

    vec3 position = texture(texturePosition, uv).xyz;
    vec3 velocity = texture(textureVelocity, uv).xyz;

    // Standard Verlet integration: Update the position based on the current velocity.
    vec3 physics_pos = position + velocity * u_delta;

    // *** THE FIX IS HERE: We now ONLY use the physics result. ***
    // The 'mix' logic has been removed to create a consistent force-based system.
    vec3 final_pos = physics_pos;
    
    // Add boundary clamping logic.
    float halfWorld = u_worldSize / 2.0;
    final_pos = clamp(final_pos, -halfWorld, halfWorld);

    // Write the new, clamped position to the output texture.
    gl_FragColor = vec4(final_pos, 1.0);
}