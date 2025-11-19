/*
    clear.glsl

    This is a simple utility shader. Its only purpose is to clear a render target
    by writing a specific value to every pixel. It's used to reset simulation
    textures and prevent the propagation of invalid data like NaN.
*/

// `resolution` is automatically provided.
uniform sampler2D u_target;
uniform float u_value;

void main() {
    // We simply write out a vec4 where all components are the clear value.
    pc_fragColor = vec4(u_value, u_value, u_value, u_value);
}