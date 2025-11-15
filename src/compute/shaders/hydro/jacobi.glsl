/*
    jacobi.glsl (Pressure Solver)

    This shader performs one iteration of the Jacobi method to solve for the pressure field.
    The goal is to find a pressure field where the pressure at any given point is the average
    of its neighbors, plus the divergence at that point. By running this shader many times,
    we converge on a solution that makes the velocity field "divergence-free" (incompressible).
*/

uniform vec2 resolution;
uniform sampler2D u_pressure;   // The pressure field from the previous iteration
uniform sampler2D u_divergence; // The divergence field calculated by divergence.glsl
uniform vec2 u_texelSize;
uniform float u_alpha;          // A constant related to the time step, typically -dx^2
uniform float u_rbeta;          // A constant for the Jacobi relaxation, typically 1/4

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;

    // Sample the pressure of the neighbors (right, left, top, bottom) from the previous iteration.
    float p_r = texture2D(u_pressure, uv + vec2(u_texelSize.x, 0.0)).x;
    float p_l = texture2D(u_pressure, uv - vec2(u_texelSize.x, 0.0)).x;
    float p_t = texture2D(u_pressure, uv + vec2(0.0, u_texelSize.y)).x;
    float p_b = texture2D(u_pressure, uv - vec2(0.0, u_texelSize.y)).x;

    // Get the divergence at the current point.
    float divergence = texture2D(u_divergence, uv).x;

    // The core Jacobi iteration formula.
    float new_pressure = (p_l + p_r + p_b + p_t + u_alpha * divergence) * u_rbeta;

    gl_FragColor = vec4(new_pressure, 0.0, 0.0, 1.0);
}