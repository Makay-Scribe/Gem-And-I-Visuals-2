// Unified Particle Physics Shader - "Snappy & Responsive" Tune
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
    
    // A. Hydro Force
    vec2 fluidUV = (position.xy / u_planeDimensions) + 0.5;
    fluidUV = clamp(fluidUV, 0.0, 1.0); 
    vec3 hydroVelocity = texture(u_hydroVelocityTexture, fluidUV).xyz;
    
    // Tune: High multiplier to make sure the liquid pushes particles effectively
    vec3 hydroForce = hydroVelocity * 10.0 * particle_flowStrength;

    // B. Simplex Noise (Eternal Drift)
    vec3 noise_coord = position * particle_flowScale;
    noise_coord.z += u_time * particle_flowSpeed;
    vec3 staticNoise = vec3(
        snoise(noise_coord),
        snoise(noise_coord + vec3(17.4)), 
        snoise(noise_coord + vec3(93.1))
    );
    vec3 noiseForce = staticNoise * 0.5 * particle_flowStrength;

    // --- 2. ORBITAL ATTRACTION ---
    vec3 toTarget = targetPos - position;
    float dist = length(toTarget);
    
    vec3 dir = vec3(0.0);
    if (dist > 0.0001) dir = toTarget / dist;

    vec3 axis = vec3(0.0, 1.0, 0.0); 
    vec3 tangent = cross(dir, axis); 
    
    float approachFactor = smoothstep(0.0, 15.0, dist); 
    float randomID = rand(uv); 
    float arrivalMask = smoothstep(randomID - 0.2, randomID + 0.2, particle_morphProgress);

    vec3 moveDir = mix(dir, tangent, approachFactor * 0.5 * (1.0 - arrivalMask)); 
    
    // *** CRITICAL FIX ***
    // Removed the `* 0.05` multiplier. 
    // We use the RAW attraction strength now for instant snapping.
    vec3 attractionForce = moveDir * particle_attractionStrength; 

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
    vec3 totalForce = attractionForce + hydroForce + noiseForce + extraForces;

    // *** CRITICAL FIX ***
    // Increased Max Acceleration from 50.0 to 1000.0
    // This allows particles to cross the screen in < 1 second if force is high.
    float maxAccel = 1000.0; 
    vec3 acceleration = totalForce;
    if (length(acceleration) > maxAccel) {
        acceleration = normalize(acceleration) * maxAccel;
    }

    velocity += acceleration * u_delta; 
    
    // Friction/Damping
    // 0.92 allows for fast movement but stops them from vibrating endlessly at the target
    velocity *= 0.92; 

    gl_FragColor = vec4(velocity, 1.0);
}