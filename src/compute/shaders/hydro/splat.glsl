/*
    splat.glsl

    This shader is used to "splat" or inject quantities into a GPGPU texture.
    It's our primary tool for user interaction. It draws a colored, force-applying
    circle onto either the density (color) or velocity texture.
*/

// ** THE FIX IS HERE: We must explicitly declare uniforms used by a standalone ShaderMaterial. **
uniform vec2 resolution;

// The texture we are modifying (e.g., textureDensity or textureVelocity)
uniform sampler2D u_target;

// The aspect ratio of the simulation grid (width / height)
uniform float u_aspectRatio;

// The color (or force vector) we want to inject.
uniform vec3 u_color;

// The center point of our splat in UV coordinates [0, 1].
uniform vec2 u_point;

// The radius of the splat in UV coordinates.
uniform float u_radius;

// NOTE: We do not use a varying for the UVs.

void main() {
    // We use gl_FragCoord because this shader is run on a simple plane, not a complex geometry.
    vec2 uv = gl_FragCoord.xy / resolution.xy;

    // Read the existing value from the texture.
    vec4 existing_value = texture2D(u_target, uv);

    // Calculate the UV coordinate, correcting for the aspect ratio to make our splat circular.
    vec2 correctedUv = uv - u_point;
    correctedUv.x *= u_aspectRatio;

    // Calculate the distance from the splat's center.
    float dist = length(correctedUv);

    // Create a smooth, fading circle using smoothstep.
    // This will be 1.0 at the center and fall off to 0.0 at the radius edge.
    float falloff = smoothstep(u_radius, 0.0, dist);

    // Add the new color/force to the existing value, multiplied by the falloff.
    // For density (color), this adds dye. For velocity, this adds force.
    gl_FragColor = existing_value + vec4(u_color, 1.0) * falloff;
}