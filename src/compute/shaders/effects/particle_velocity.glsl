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

// ** REMOVED: Pouring uniforms are not used in this simplified model yet **


void main() {
    // Get the UV coordinate of the current pixel (particle)
    vec2 uv = gl_FragCoord.xy / resolution.xy;

    // Read the current position and velocity from the input textures
    vec3 position = texture(texturePosition, uv).xyz;
    vec3 velocity = texture(textureVelocity, uv).xyz;

    // --- 1. Calculate Flow Field (Turbulence) ---
    // This force pushes the particles around randomly.
    vec3 noise_coord = position * particle_flowScale;
    noise_coord.z += u_time * particle_flowSpeed;
    vec3 flowForce = vec3(
        snoise(noise_coord),
        snoise(noise_coord + vec3(10.0)),
        snoise(noise_coord + vec3(20.0))
    ) * particle_flowStrength;
    
    // ** THE FIX IS HERE: Modify how morphProgress scales the turbulence. **
    // We create a "peak" in the middle of the transition.
    // When morphProgress is 0.0 or 1.0, turbulenceStrength is 0.0.
    // When morphProgress is 0.5, turbulenceStrength is 1.0 (maximum).
    float turbulenceStrength = sin(particle_morphProgress * PI);
    vec3 scaledFlowForce = flowForce * turbulenceStrength;


    // --- 2. Calculate Attraction Force ---
    // This force ALWAYS pulls the particles toward their target position.
    vec3 targetPos = texture(u_targetPositionMap, uv).xyz;
    vec3 attractionForce = (targetPos - position) * particle_attractionStrength;


    // --- 3. Combine Forces ---
    // ** THE FIX IS HERE: We now ADD the forces instead of mixing them. **
    // The particles are always attracted, and turbulence is added on top,
    // scaled by how far along the transition is.
    vec3 finalForce = attractionForce + scaledFlowForce;

    // --- 4. Apply Force and Damping ---
    velocity += finalForce;
    velocity *= 0.98; 

    gl_FragColor = vec4(velocity, 1.0);
}