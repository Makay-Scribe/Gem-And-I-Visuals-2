/*
    splat.glsl

    This shader is used to "splat" or inject quantities into a GPGPU texture.
    It's our primary tool for user interaction. It draws a colored, force-applying
    circle onto either the density (color) or velocity texture.
*/

uniform vec2 resolution;

// The texture we are modifying (e.g., textureDensity or textureVelocity)
uniform sampler2D u_target;

// The aspect ratio of the simulation grid (width / height)
uniform float u_aspectRatio;

// ** THE FIX IS HERE: The color/force is now a vec4 for better data integrity **
uniform vec4 u_color;

// The center point of our splat in UV coordinates [0, 1].
uniform vec2 u_point;

// The radius of the splat in UV coordinates.
uniform float u_radius;

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

    // ** THE FIX IS HERE: Add the new vec4 color/force directly. **
    // The alpha component is correctly handled by the HydroSimManager before being sent here.
    gl_FragColor = existing_value + u_color * falloff;
}