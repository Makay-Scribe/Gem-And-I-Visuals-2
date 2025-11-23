// Unified Particle Physics Shader - Fixed Interaction
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

// --- HYDRO SIMULATION INPUT ---
uniform sampler2D u_hydroVelocityTexture;

// Random helper
float rand(vec2 co){
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;

    vec3 position = texture(texturePosition, uv).xyz;
    vec3 velocity = texture(textureVelocity, uv).xyz;
    vec3 targetPos = texture(u_targetPositionMap, uv).xyz;

    // --- 1. CALCULATE FORCES ---
    
    // A. Hydro Force (Mouse Interaction)
    // This needs to be ALWAYS active so you can push particles off their target.
    vec2 fluidUV = (position.xy / u_planeDimensions) + 0.5;
    fluidUV = clamp(fluidUV, 0.0, 1.0); 
    vec3 hydroVelocity = texture(u_hydroVelocityTexture, fluidUV).xyz;
    
    // Boost factor: 100.0 allows the mouse to overpower the attraction
    vec3 hydroForce = hydroVelocity * 100.0 * particle_flowStrength;

    // B. Simplex Noise (Ambient Drift)
    vec3 noise_coord = position * particle_flowScale;
    noise_coord.z += u_time * particle_flowSpeed;
    vec3 staticNoise = vec3(
        snoise(noise_coord),
        snoise(noise_coord + vec3(17.4)), 
        snoise(noise_coord + vec3(93.1))
    );
    vec3 noiseForce = staticNoise * 2.0 * particle_flowStrength;

    // --- 2. ORBITAL ATTRACTION ---
    vec3 toTarget = targetPos - position;
    float dist = length(toTarget);
    
    vec3 dir = vec3(0.0);
    if (dist > 0.0001) dir = toTarget / dist;

    // Tangent (Spiral)
    vec3 axis = vec3(0.0, 1.0, 0.0); 
    vec3 tangent = cross(dir, axis); 
    
    // Approach logic
    float approachFactor = smoothstep(0.0, 5.0, dist); 
    float randomID = rand(uv); 
    float arrivalMask = smoothstep(randomID - 0.2, randomID + 0.2, particle_morphProgress);

    vec3 moveDir = mix(dir, tangent, approachFactor * 0.5 * (1.0 - arrivalMask)); 
    
    // Attraction Force
    vec3 attractionForce = moveDir * particle_attractionStrength * dist * 2.0; 

    // --- 3. COHESION & GRAVITY ---
    vec3 extraForces = vec3(0.0);
    
    if (u_gravityWellStrength != 0.0 || u_orbitalStrength != 0.0) { 
        vec3 toWell = u_gravityWellPosition - position;
        float distWell = length(toWell);
        if (distWell > 0.0001) { 
            vec3 pullDir = toWell / distWell;
            vec3 orbitalDir = normalize(cross(pullDir, vec3(0.0, 1.0, 0.0)));
            float falloff = 1.0 / (1.0 + distWell * distWell * 0.01); 
            extraForces += (pullDir * u_gravityWellStrength + orbitalDir * u_orbitalStrength) * falloff;
        }
    }

    if (u_cohesionStrength > 0.0) {
        vec3 blurredPos = texture(u_blurredPosition, uv).xyz;
        extraForces += (blurredPos - position) * u_cohesionStrength;
    }

    // --- 4. INTEGRATION ---
    
    // Damping Logic:
    // When particles are at the target (dist ~ 0), we kill the NOISE so the image is sharp.
    // But we DO NOT kill the Hydro force, so you can still push them around.
    float stabilityFactor = smoothstep(0.0, 2.0, dist);
    
    vec3 totalForce = attractionForce + hydroForce + (noiseForce * stabilityFactor) + extraForces;

    velocity += totalForce * u_delta; 
    velocity *= 0.90; // Friction

    gl_FragColor = vec4(velocity, 1.0);
}