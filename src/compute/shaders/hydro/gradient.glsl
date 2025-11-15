/*
    gradient.glsl

    This shader subtracts the pressure gradient from the velocity field.
    The gradient of a scalar field (like pressure) is a vector that points in the
    direction of the greatest rate of increase. By subtracting this vector from the
    velocity, we are essentially "pushing" the velocity away from high-pressure areas
    and towards low-pressure areas, which conserves mass and makes the flow incompressible.
*/

uniform vec2 resolution;
uniform sampler2D u_pressure;   // The final, solved pressure field from the Jacobi iterations
uniform sampler2D u_velocity;   // The velocity field we want to correct
uniform vec2 u_texelSize;

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;

    // Sample the pressure of the neighbors (right, left, top, bottom).
    float p_r = texture2D(u_pressure, uv + vec2(u_texelSize.x, 0.0)).x;
    float p_l = texture2D(u_pressure, uv - vec2(u_texelSize.x, 0.0)).x;
    float p_t = texture2D(u_pressure, uv + vec2(0.0, u_texelSize.y)).x;
    float p_b = texture2D(u_pressure, uv - vec2(0.0, u_texelSize.y)).x;

    // Calculate the pressure gradient using the central difference method.
    // This is the vector that points from low pressure to high pressure.
    vec2 gradient = 0.5 * vec2(p_r - p_l, p_t - p_b);

    // Read the current (divergent) velocity.
    vec2 vel = texture2D(u_velocity, uv).xy;

    // Subtract the gradient from the velocity to get the new, divergence-free velocity.
    vec2 new_velocity = vel - gradient;

    gl_FragColor = vec4(new_velocity, 0.0, 1.0);
}