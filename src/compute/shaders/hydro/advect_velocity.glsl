/*
    advect_velocity.glsl
    Advects VELOCITY through the VELOCITY FINAL field.
    Includes manual Splat interactions and the Fire Injection logic.
*/

// Uniforms automatically injected by GPUComputationRenderer (DO NOT REDECLARE):
// uniform sampler2D textureVelocity;
// uniform sampler2D textureVelocityFinal;

uniform float u_deltaTime;
uniform float u_dissipation;

// Splat Uniforms
uniform vec4 u_splatColor;
uniform vec2 u_point;
uniform float u_radius;
uniform float u_aspectRatio;

// Fire Uniforms
uniform bool u_fireActive;
uniform float u_time;

// Include Simplex Noise
#include <gpgpu_common>

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;

    // 1. Advection (Self-Advection)
    // Move the velocity field along itself
    vec2 flowVelocity = texture(textureVelocityFinal, uv).xy;
    vec2 prev_pos_uv = uv - u_deltaTime * flowVelocity;
    
    // Sample the previous frame's velocity
    vec4 quantity = texture(textureVelocity, prev_pos_uv);
    
    // Apply dissipation (friction/decay)
    quantity *= u_dissipation;

    // 2. Embedded Splat (Mouse Interaction)
    vec2 correctedUv = uv - u_point;
    correctedUv.x *= u_aspectRatio;
    float dist = length(correctedUv);
    float splat = smoothstep(u_radius, 0.0, dist);
    
    quantity += u_splatColor * splat;

    // 3. Fire Injection (The "Burn" Effect)
    if (u_fireActive) {
        float burnHeight = 0.15; // Fire originates from bottom 15% of screen
        
        if (uv.y < burnHeight) {
            // Calculate strength based on height (strongest at bottom)
            float strength = 1.0 - (uv.y / burnHeight);
            strength = pow(strength, 2.0); // Non-linear falloff
            
            // Generate turbulent noise
            // We move the noise upwards over time (uv.y - time) to simulate rising heat
            float noise = snoise(vec3(uv.x * 20.0, uv.y * 10.0 - u_time * 2.0, u_time));
            
            // Create Force Vector:
            // X: Chaotic side-to-side movement
            // Y: Strong upward lift
            vec2 fireForce = vec2(noise * 1.5, 4.0 + noise * 0.5);
            
            // Apply force scaled by delta time
            quantity.xy += fireForce * strength * u_deltaTime * 5.0; 
        }
    }

    pc_fragColor = quantity;
}