/*
    gradient.glsl

    Subtracts the pressure gradient from velocity to ensure incompressibility.
    This creates the final, clean velocity field for the next frame.
*/

// `resolution`, `texturePressure`, and `textureVelocity` are automatically provided.
uniform vec2 u_texelSize;

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;

    float p_r = texture(texturePressure, uv + vec2(u_texelSize.x, 0.0)).x;
    float p_l = texture(texturePressure, uv - vec2(u_texelSize.x, 0.0)).x;
    float p_t = texture(texturePressure, uv + vec2(0.0, u_texelSize.y)).x;
    float p_b = texture(texturePressure, uv - vec2(0.0, u_texelSize.y)).x;

    vec2 gradient = 0.5 * vec2(p_r - p_l, p_t - p_b);
    vec2 vel = texture(textureVelocity, uv).xy;

    gl_FragColor = vec4(vel - gradient, 0.0, 1.0);
}