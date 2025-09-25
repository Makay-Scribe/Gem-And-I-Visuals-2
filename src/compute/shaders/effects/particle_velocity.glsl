// Import common functions like snoise (Simplex Noise)
#include <gpgpu_common>

// Uniforms for controlling the simulation
uniform float u_time;
uniform sampler2D u_targetPositionMap; // Texture containing the target shape (flat plane, 3D model, etc.)
uniform sampler2D u_initialPosition; // The original, flat position of the particle
uniform vec2 u_planeDimensions; 

// Uniforms for the flow field (turbulence)
uniform float particle_flowScale;
uniform float particle_flowSpeed;
uniform float particle_flowStrength;

// Uniforms for morphing and attraction
uniform float particle_morphProgress;
uniform float particle_attractionStrength;

// ** THE FIX IS HERE: Uniforms for the new artistic transition effects **
uniform vec3 u_gravity;
uniform float u_vortexStrength;
uniform vec2 u_vortexPosition; // Center of the vortex in world space
uniform float u_meltProgress; // 0 = not melting, 1 = fully melted


void main() {
    // Get the UV coordinate of the current pixel (particle)
    vec2 uv = gl_FragCoord.xy / resolution.xy;

    // Read the current position and velocity from the input textures
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

    // --- 3. Calculate Vortex Force ---
    vec3 vortexForce = vec3(0.0);
    if (u_vortexStrength > 0.0) {
        vec2 toCenter = u_vortexPosition - position.xy;
        float dist = length(toCenter);
        vec2 pullDir = normalize(toCenter);
        vec2 swirlDir = vec2(-pullDir.y, pullDir.x);
        float falloff = 1.0 / (1.0 + dist * dist);
        vortexForce.xy = (pullDir + swirlDir) * u_vortexStrength * falloff;
    }

    // --- 4. Calculate Melt/Gravity Force ---
    vec3 gravityForce = vec3(0.0);
    if (u_meltProgress > 0.0) {
        float topOfPlane = u_planeDimensions.y * 0.5;
        // The melt front moves from top (1.0) to bottom (-1.0) as meltProgress goes from 0 to 1
        float meltFrontY = topOfPlane * (1.0 - u_meltProgress * 2.0); 
        
        // Only apply gravity to particles whose *original* position is above the melt line
        if (initialPos.y > meltFrontY) {
            gravityForce = u_gravity;
        }
    }


    // --- 5. Combine Forces ---
    float distToTarget = length(targetPos - position);
    
    // The flow field (turbulence) fades out as a particle gets closer to its target,
    // ensuring the attraction force can win and the particle can settle.
    float flowFalloff = smoothstep(0.1, 2.0, distToTarget);
    
    vec3 finalForce = attractionForce + (flowForce * flowFalloff) + gravityForce + vortexForce;


    // --- 6. Apply Force and Damping ---
    velocity += finalForce;
    velocity *= 0.90; // Damping factor to prevent infinite acceleration

    gl_FragColor = vec4(velocity, 1.0);
}