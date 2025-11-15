/*
    advect.glsl

    This shader moves a quantity (like density or velocity) through a velocity field.
    It works by performing a backward lookup: for each grid cell (pixel), it looks at the
    velocity at that point, traces that velocity backward in time for one time step,
and then samples the quantity from that previous location. This effectively "pulls"
    the quantity forward along the flow field.
*/

// ** THE FIX IS HERE: We must explicitly declare uniforms used by a standalone ShaderMaterial. **
uniform vec2 resolution;

uniform sampler2D u_velocity;   // The velocity field texture
uniform sampler2D u_source;     // The texture of the quantity to be advected (e.g., density)
uniform vec2 u_texelSize;       // The size of a single texel (1.0 / resolution)
uniform float u_deltaTime;      // The time step for the simulation
uniform float u_dissipation;    // A factor to make the quantity slowly fade away (e.g., 0.999)

void main() {
    // We use gl_FragCoord because this shader is run on a simple plane, not a complex geometry.
    vec2 uv = gl_FragCoord.xy / resolution.xy;

    // 1. Get the velocity at the current grid cell.
    vec2 vel = texture2D(u_velocity, uv).xy;

    // 2. Trace backward in time.
    vec2 prev_pos_uv = uv - u_deltaTime * vel * u_texelSize * resolution;

    // 3. Sample the source quantity from the previous position.
    vec4 advected_quantity = texture2D(u_source, prev_pos_uv);

    // 4. Apply dissipation to make the fluid slowly fade over time.
    advected_quantity *= u_dissipation;
    
    gl_FragColor = advected_quantity;
}