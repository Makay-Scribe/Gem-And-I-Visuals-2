// Unified Particle Physics Shader - "Orbital Flow" Edition
#include <gpgpu_common>

// --- Uniforms ---
uniform float u_time;
uniform float u_delta; 
uniform sampler2D u_targetPositionMap;
uniform sampler2D u_initialPosition;
uniform vec2 u_planeDimensions; 

// --- GPGPU Internal Uniforms ---
uniform sampler2D texturePosition;
uniform sampler2D textureVelocity;

// --- Particle Behavior ---
uniform float particle_flowScale;
uniform float particle_flowSpeed;
uniform float particle_flowStrength;
uniform float particle_attractionStrength;
uniform float particle_morphProgress; 

// --- Artistic Forces ---
uniform float u_cohesionStrength;
uniform sampler2D u_blurredPosition;
uniform vec3 u_gravityWellPosition;
uniform float u_gravityWellStrength;
uniform float u_orbitalStrength;

// Random helper
float rand(vec2 co){
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;

    vec3 position = texture(texturePosition, uv).xyz;
    vec3 velocity = texture(textureVelocity, uv).xyz;
    
    // 1. Determine Target
    vec3 targetPos = texture(u_targetPositionMap, uv).xyz;

    // 2. The "Chaos" Field
    vec3 noise_coord = position * particle_flowScale;
    noise_coord.z += u_time * particle_flowSpeed;
    
    vec3 flowForce = vec3(
        snoise(noise_coord),
        snoise(noise_coord + vec3(43.0, 17.0, 10.0)), 
        snoise(noise_coord + vec3(12.0, 55.0, 91.0))
    ) * particle_flowStrength;
    
    // 3. The "Orbital" Attraction
    vec3 toTarget = targetPos - position;
    float dist = length(toTarget);
    
    // SAFE NORMALIZE
    vec3 dir = vec3(0.0);
    if (dist > 0.0001) {
        dir = toTarget / dist;
    }

    // A: Calculate Randomized Tangent (Fixes Lopsidedness)
    // Instead of a fixed axis, we generate a random one per particle
    vec3 randomAxis = normalize(vec3(
        rand(uv) - 0.5,
        rand(uv + 0.31) - 0.5,
        rand(uv + 0.67) - 0.5
    ));
    vec3 tangent = cross(dir, randomAxis); 
    
    // B: Arrival Masking
    float randomID = rand(uv); 
    float arrivalMask = smoothstep(randomID - 0.2, randomID + 0.2, particle_morphProgress);

    // C: Dynamic Force Mixing
    float approachFactor = smoothstep(0.0, 5.0, dist); 
    
    // Mix between spiraling (tangent) and homing (dir)
    vec3 moveDir = mix(dir, tangent, approachFactor * 0.5 * (1.0 - arrivalMask)); 
    
    // Apply the force
    vec3 attractionForce = moveDir * particle_attractionStrength * dist * 2.0; 

    // 4. Gravity Well
    vec3 gravityWellForce = vec3(0.0);
    if (u_gravityWellStrength != 0.0 || u_orbitalStrength != 0.0) { 
        vec3 toWell = u_gravityWellPosition - position;
        float distWell = length(toWell);
        if (distWell > 0.0001) { 
            vec3 pullDir = toWell / distWell;
            vec3 orbitalDir = normalize(cross(pullDir, vec3(0.0, 1.0, 0.0)));
            float falloff = 1.0 / (1.0 + distWell * distWell * 0.01); 
            gravityWellForce = (pullDir * u_gravityWellStrength + orbitalDir * u_orbitalStrength) * falloff;
        }
    }

    // 5. Cohesion
    vec3 cohesionForce = vec3(0.0);
    if (u_cohesionStrength > 0.0) {
        vec3 blurredPos = texture(u_blurredPosition, uv).xyz;
        cohesionForce = (blurredPos - position) * u_cohesionStrength;
    }

    // 6. Final Integration
    vec3 totalForce = attractionForce + (flowForce * approachFactor) + gravityWellForce + cohesionForce;

    velocity += totalForce * u_delta; 
    velocity *= 0.90; 

    gl_FragColor = vec4(velocity, 1.0);
}