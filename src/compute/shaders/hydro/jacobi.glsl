/*
    jacobi.glsl

    Iteratively solves for pressure to counteract the divergence.
*/

// `resolution`, `texturePressure`, and `textureDivergence` are automatically provided.
uniform vec2 u_texelSize;

uniform float u_alpha;
uniform float u_rbeta;

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;

    float p_r = texture(texturePressure, uv + vec2(u_texelSize.x, 0.0)).x;
    float p_l = texture(texturePressure, uv - vec2(u_texelSize.x, 0.0)).x;
    float p_t = texture(texturePressure, uv + vec2(0.0, u_texelSize.y)).x;
    float p_b = texture(texturePressure, uv - vec2(0.0, u_texelSize.y)).x;

    float divergence = texture(textureDivergence, uv).x;

    float new_pressure = (p_l + p_r + p_b + p_t + u_alpha * divergence) * u_rbeta;

    gl_FragColor = vec4(new_pressure, 0.0, 0.0, 1.0);
}