// Uniform for the time elapsed since the last frame
uniform float u_delta;

void main() {
    // Get the UV coordinate of the current pixel (particle)
    vec2 uv = gl_FragCoord.xy / resolution.xy;

    // Read the current position and velocity from the input textures
    vec3 position = texture(texturePosition, uv).xyz;
    vec3 velocity = texture(textureVelocity, uv).xyz;

    // Verlet integration: Update the position based on the current velocity
    position += velocity * u_delta;

    // Write the new position to the output texture
    gl_FragColor = vec4(position, 1.0);
}