/*
    advect.glsl (Density Version)
    Advects DENSITY through the VELOCITY FINAL field.
*/

// Uniforms automatically injected by GPUComputationRenderer:
// uniform sampler2D textureDensity;
// uniform sampler2D textureVelocityFinal;

uniform float u_deltaTime;
uniform float u_dissipation;

// Splat Uniforms
uniform vec4 u_splatColor;
uniform vec2 u_point;
uniform float u_radius;
uniform float u_aspectRatio;

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;

    // 1. Advection
    vec2 flowVelocity = texture(textureVelocityFinal, uv).xy;
    vec2 prev_pos_uv = uv - u_deltaTime * flowVelocity;
    
    // Read from the Density texture provided by the library
    vec4 quantity = texture(textureDensity, prev_pos_uv);
    
    quantity *= u_dissipation;

    // 2. Embedded Splat
    vec2 correctedUv = uv - u_point;
    correctedUv.x *= u_aspectRatio;
    float dist = length(correctedUv);
    float splat = smoothstep(u_radius, 0.0, dist);
    
    quantity += u_splatColor * splat;

    pc_fragColor = quantity;
}