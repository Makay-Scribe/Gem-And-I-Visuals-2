/*
    splat_from_texture.glsl

    This shader is used to "splat" an entire texture (like your canvas image)
    into the fluid simulation's density field. It's the key to the "ignition"
    phase of your advanced transitions.
*/

uniform vec2 resolution;
uniform sampler2D u_splatTexture; // The image/canvas texture we want to splat
uniform sampler2D u_target;       // The density texture we are writing to

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;

    // Read the color from the image we want to splat.
    // We flip the y-coordinate because textures loaded by Three.js are often
    // oriented differently than the GPGPU render targets.
    vec4 splat_color = texture2D(u_splatTexture, vec2(uv.x, 1.0 - uv.y));

    // Read the existing color from the density texture.
    vec4 existing_color = texture2D(u_target, uv);

    // We simply replace the existing color with the splat color.
    // In the future, we could blend them, but for an initial "ignition,"
    // a direct copy is what we want.
    gl_FragColor = mix(existing_color, splat_color, splat_color.a);
}