// src/compute/shaders/sph_position.glsl
// This is a standard Verlet integration position update shader.

// This uniform is passed in from the JavaScript update loop and represents
// the time elapsed since the last frame. It's crucial for the physics calculation.
uniform float u_delta;

void main() {
    // Get the UV coordinate for the current particle.
    vec2 uv = gl_FragCoord.xy / resolution.xy;

    // Read the current position and velocity from the input textures.
    vec3 position = texture(texturePosition, uv).xyz;
    vec3 velocity = texture(textureVelocity, uv).xyz;

    // Update the position based on the current velocity and the frame's delta time.
    position += velocity * u_delta;

    // Write the new position to the output texture for the next frame.
    gl_FragColor = vec4(position, 1.0);
}