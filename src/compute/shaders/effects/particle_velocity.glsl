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

// Uniforms for the new Melt/Vortex effect
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
        float meltFrontY = topOfPlane * (1.0 - u_meltProgress * 2.0); 
        
        if (initialPos.y > meltFrontY) {
            gravityForce = u_gravity;
        }
    }


    // --- 5. Combine Forces ---
    // ** THE FIX IS HERE: Make the force combination more robust. **
    // The issue was that the continuous 'flowForce' could prevent particles from ever
    // settling into their final positions. This new logic makes the flow force fade out
    // as a particle gets closer to its target, ensuring the attraction force always wins.
    float distToTarget = length(targetPos - position);
    
    // `smoothstep` creates a falloff. When the particle is far away ( > 2.0 units),
    // flowFalloff is 1.0 (full strength). When it gets very close ( < 0.1 units),
    // flowFalloff becomes 0.0, disabling the turbulence for that particle.
    float flowFalloff = smoothstep(0.1, 2.0, distToTarget);
    
    vec3 finalForce = attractionForce + (flowForce * flowFalloff) + gravityForce + vortexForce;


    // --- 6. Apply Force and Damping ---
    velocity += finalForce;
    velocity *= 0.90; 

    gl_FragColor = vec4(velocity, 1.0);
}