// This shader computes the new velocity of the vertices.

// NOTE: texturePosition and textureVelocity are provided automatically
// by GPUComputationRenderer because they are set as dependencies.

uniform sampler2D audioTexture;
uniform float audioStrength;

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    
    vec3 velocity = texture2D(textureVelocity, uv).xyz;

    // --- Audio Interaction ---
    if (audioStrength > 0.0) {
        // Read the audio frequency data corresponding to this vertex's horizontal position.
        // The 'r' channel of our audioTexture contains the frequency value (0.0 to 1.0).
        float audioValue = texture2D(audioTexture, vec2(uv.x, 0.5)).r;
        
        // Apply an upward force based on the audio value and strength.
        velocity.y += audioValue * audioStrength;
    }

    // Apply damping to make the simulation stable.
    // This will cause any existing velocity to slowly fade out.
    velocity *= 0.95; // Increased damping slightly to handle audio input

    gl_FragColor = vec4(velocity, 1.0);
}