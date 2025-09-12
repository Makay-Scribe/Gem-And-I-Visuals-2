// Import common functions like snoise (Simplex Noise)
#include <gpgpu_common>

// Uniforms for controlling the simulation
uniform float u_time;
uniform sampler2D u_targetPositionMap; // Texture containing the target shape (flat plane, 3D model, etc.)

// Uniforms for the flow field (turbulence)
uniform float particle_flowScale;
uniform float particle_flowSpeed;
uniform float particle_flowStrength;

// Uniforms for morphing and attraction
uniform float particle_morphProgress;
uniform float particle_attractionStrength;

// ** NEW: Uniforms for the pouring transition **
uniform bool u_isPouring;
uniform float u_pourProgress;
uniform vec3 u_pourSourcePoint;


void main() {
    // Get the UV coordinate of the current pixel (particle)
    vec2 uv = gl_FragCoord.xy / resolution.xy;

    // Read the current position and velocity from the input textures
    vec3 position = texture(texturePosition, uv).xyz;
    vec3 velocity = texture(textureVelocity, uv).xyz;

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
    vec3 attractionForce;

    // ** NEW: Gravity Well / Pouring Logic **
    if (u_isPouring) {
        // Stage 1: An initial strong pull towards the gravity well (the pour source point)
        vec3 pourAttraction = (u_pourSourcePoint - position) * (particle_attractionStrength * 2.0);
        
        // Stage 2: The final attraction force towards the model's shape
        vec3 finalAttraction = (targetPos - position) * particle_attractionStrength;
        
        // Blend between the two forces based on the pour progress.
        // As u_pourProgress goes from 0 to 1, we transition from pouring to forming the final shape.
        attractionForce = mix(pourAttraction, finalAttraction, u_pourProgress);
    } else {
        // Default behavior: just attract to the target shape
        attractionForce = (targetPos - position) * particle_attractionStrength;
    }


    // --- 3. Blend Forces ---
    vec3 finalForce = mix(flowForce, attractionForce, particle_morphProgress);

    // --- 4. Apply Force and Damping ---
    velocity += finalForce;
    velocity *= 0.98; 

    gl_FragColor = vec4(velocity, 1.0);
}