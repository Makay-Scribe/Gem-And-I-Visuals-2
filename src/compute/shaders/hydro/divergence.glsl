/*
    divergence.glsl

    Calculates how much the fluid is expanding or compressing at each pixel.
*/

// `resolution` and `textureVelocity` are automatically provided.
uniform vec2 u_texelSize;

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;

    float vel_r = texture(textureVelocity, uv + vec2(u_texelSize.x, 0.0)).x;
    float vel_l = texture(textureVelocity, uv - vec2(u_texelSize.x, 0.0)).x;
    float vel_t = texture(textureVelocity, uv + vec2(0.0, u_texelSize.y)).y;
    float vel_b = texture(textureVelocity, uv - vec2(0.0, u_texelSize.y)).y;

    float divergence = 0.5 * (vel_r - vel_l + vel_t - vel_b);

    gl_FragColor = vec4(divergence, 0.0, 0.0, 1.0);
}