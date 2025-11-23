// Unified Particle Physics Shader
#include <gpgpu_common>

// --- Uniforms ---
uniform float u_time;
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
uniform float particle_morphProgress; // 0.0 = Canvas, 1.0 = Model

// --- Artistic Forces ---
uniform float u_cohesionStrength;
uniform sampler2D u_blurredPosition;
uniform vec3 u_gravityWellPosition;
uniform float u_gravityWellStrength;
uniform float u_orbitalStrength;

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;

    vec3 position = texture(texturePosition, uv).xyz;
    vec3 velocity = texture(textureVelocity, uv).xyz;
    
    // 1. Determine Target (Canvas vs Model)
    // We blend the target coordinate based on morph progress
    vec3 canvasPos = texture(u_initialPosition, uv).xyz;
    vec3 modelPos = texture(u_targetPositionMap, uv).xyz; // This texture is swapped in JS
    
    // Note: In the JS, we swap u_targetPositionMap. 
    // But if we want smooth interpolation between two distinct maps without swapping:
    // vec3 targetPos = mix(canvasPos, modelPos, particle_morphProgress);
    // For now, we rely on the JS swapping the texture for the 'target'.
    vec3 targetPos = modelPos;

    // 2. Flow Field (Turbulence)
    vec3 noise_coord = position * particle_flowScale;
    noise_coord.z += u_time * particle_flowSpeed;
    vec3 flowForce = vec3(
        snoise(noise_coord),
        snoise(noise_coord + vec3(10.0)),
        snoise(noise_coord + vec3(20.0))
    ) * particle_flowStrength;
    
    // 3. Attraction Force
    // Simple spring for now. We can upgrade this to "Orbital" later once refactor is done.
    vec3 attractionForce = (targetPos - position) * particle_attractionStrength;

    // 4. Gravity Well / Orbital Force
    vec3 gravityWellForce = vec3(0.0);
    if (u_gravityWellStrength != 0.0 || u_orbitalStrength != 0.0) { 
        vec3 toWell = u_gravityWellPosition - position;
        float dist = length(toWell);
        if (dist > EPSILON_SHADER) {
            vec3 pullDir = toWell / dist;
            vec3 up = vec3(0.0, 1.0, 0.0); 
            vec3 orbitalDir = normalize(cross(pullDir, up));
            float falloff = 1.0 / (1.0 + dist * dist * 0.01); 
            gravityWellForce = (pullDir * u_gravityWellStrength + orbitalDir * u_orbitalStrength) * falloff;
        }
    }

    // 5. Cohesion (Clumping)
    vec3 cohesionForce = vec3(0.0);
    if (u_cohesionStrength > 0.0) {
        vec3 blurredPos = texture(u_blurredPosition, uv).xyz;
        cohesionForce = (blurredPos - position) * u_cohesionStrength;
    }

    // 6. Combine Forces
    // If we are close to target, reduce flow to allow "settling"
    float distToTarget = length(targetPos - position);
    float flowFalloff = smoothstep(0.1, 2.0, distToTarget);
    
    vec3 finalForce = attractionForce + (flowForce * flowFalloff) + gravityWellForce + cohesionForce;

    // 7. Integration
    velocity += finalForce;
    velocity *= 0.92; // Damping

    gl_FragColor = vec4(velocity, 1.0);
}