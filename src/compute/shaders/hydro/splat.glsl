/*
    splat.glsl

    This shader is used to "splat" or inject quantities into a GPGPU texture.
    It's our primary tool for user interaction. It draws a colored, force-applying
    circle onto either the density (color) or velocity texture.
*/

// `resolution` is automatically provided.

// Uniforms for manual `doRenderTarget` call
uniform sampler2D u_target;
uniform float u_aspectRatio;
uniform vec4 u_color;
uniform vec2 u_point;
uniform float u_radius;

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;

    vec4 existing_value = texture(u_target, uv);

    vec2 correctedUv = uv - u_point;
    correctedUv.x *= u_aspectRatio;

    float dist = length(correctedUv);

    float falloff = smoothstep(u_radius, 0.0, dist);

    pc_fragColor = existing_value + u_color * falloff;
}