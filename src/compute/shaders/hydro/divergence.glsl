/*
    divergence.glsl

    Calculates the divergence of the velocity field. A measure of how much
    the field is expanding or converging at any given point.
*/

// ** THE FIX IS HERE: We must declare all uniforms used by our manual materials. **
uniform vec2 resolution;
uniform sampler2D u_velocity;
uniform vec2 u_texelSize;

void main() {
    // We now correctly calculate the UV coordinate using the declared 'resolution' uniform.
    vec2 uv = gl_FragCoord.xy / resolution.xy;

    // Sample the velocity of the neighbors (right, left, top, bottom)
    float vel_r = texture2D(u_velocity, uv + vec2(u_texelSize.x, 0.0)).x;
    float vel_l = texture2D(u_velocity, uv - vec2(u_texelSize.x, 0.0)).x;
    float vel_t = texture2D(u_velocity, uv + vec2(0.0, u_texelSize.y)).y;
    float vel_b = texture2D(u_velocity, uv - vec2(0.0, u_texelSize.y)).y;

    // Calculate the divergence using the central difference method.
    float divergence = 0.5 * (vel_r - vel_l + vel_t - vel_b);

    gl_FragColor = vec4(divergence, 0.0, 0.0, 1.0);
}