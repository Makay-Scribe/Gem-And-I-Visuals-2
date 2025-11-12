// Refactored for Unified ComputeManager
#include <gpgpu_common>

// --- Uniforms for controlling the simulation ---
uniform float u_time;
uniform sampler2D u_targetPositionMap;
uniform sampler2D u_initialPosition;
uniform vec2 u_planeDimensions; 

// --- GPGPU Internal Uniforms ---
uniform sampler2D texturePosition;
uniform sampler2D textureVelocity;

// --- Particle Mode Uniforms ---
uniform float particle_flowScale;
uniform float particle_flowSpeed;
uniform float particle_flowStrength;
uniform float particle_attractionStrength;

// ** NEW: Cohesion Uniforms **
uniform float u_cohesionStrength;
uniform sampler2D u_blurredPosition;

// --- Artistic Effect Uniforms for Particle Mode ---
uniform vec3 u_gravityWellPosition;
uniform float u_gravityWellStrength;
uniform float u_orbitalStrength;


void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;

    vec3 position = texture(texturePosition, uv).xyz;
    vec3 velocity = texture(textureVelocity, uv).xyz;
    vec3 initialPos = texture(u_initialPosition, uv).xyz;

    // --- 1. Calculate Flow Field (Turbulence) ---
    vec3 noise_coord = position * particle_flowScale;
    noise_coord.z += u_time * particle_flowSpeed;
    vec3 flowForce = vec3(
        snoise(noise_coord),
        snoise(noise_coord + vec3(10.0)),
        snoise(noise_coord + vec3(20.0))
    ) * particle_flowStrength;
    
    // --- 2. Calculate Attraction Force ---
    vec3 targetPos = texture(u_targetPositionMap, uv).xyz;
    vec3 attractionForce = (targetPos - position) * particle_attractionStrength;

    // --- 3. Calculate Gravity Well Force ---
    vec3 gravityWellForce = vec3(0.0);
    if (u_gravityWellStrength != 0.0 || u_orbitalStrength != 0.0) { // Check against non-zero
        vec3 toWell = u_gravityWellPosition - position;
        float dist = length(toWell);
        
        if (dist > EPSILON_SHADER) {
            vec3 pullDir = toWell / dist;

            vec3 up = vec3(0.0, 1.0, 0.0); 
            vec3 orbitalDir = normalize(cross(pullDir, up));
            orbitalDir = normalize(mix(orbitalDir, up, 0.1));

            float falloff = 1.0 / (1.0 + dist * dist * 0.01); 

            vec3 combinedForce = (pullDir * u_gravityWellStrength) + (orbitalDir * u_orbitalStrength);
            gravityWellForce = combinedForce * falloff;
        }
    }

    // --- 4. ** NEW: Calculate Cohesion Force ** ---
    vec3 cohesionForce = vec3(0.0);
    if (u_cohesionStrength > 0.0) {
        vec3 blurredPos = texture(u_blurredPosition, uv).xyz;
        cohesionForce = (blurredPos - position) * u_cohesionStrength;
    }

    // --- 5. Combine Forces ---
    float distToTarget = length(targetPos - position);
    
    float flowFalloff = smoothstep(0.1, 2.0, distToTarget);
    
    vec3 finalForce = attractionForce + (flowForce * flowFalloff) + gravityWellForce + cohesionForce;

    // --- 6. Apply Force and Damping ---
    velocity += finalForce;
    velocity *= 0.90; // Damping factor

    gl_FragColor = vec4(velocity, 1.0);
}