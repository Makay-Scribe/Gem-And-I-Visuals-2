// Artistic Position/Velocity Solver - V7 (Replaces SPH for Artistic Control)
#include <gpgpu_common>

uniform float u_time;
uniform float u_delta;

// --- Director Uniforms ---
uniform int u_physicsState;         // 0:stopped, 1:running
uniform vec3 u_gravity;
uniform float u_pressureStrength; // UNUSED in this version, kept for director compatibility
uniform float u_attractionStrength;
uniform int u_targetState;          // 0: Canvas, 1: 3D Model
uniform sampler2D u_initialPosition; 
uniform sampler2D u_modelPosition;

// --- Artistic Uniforms ---
uniform float u_flowStrength;
uniform float u_flowScale;
uniform float u_flowSpeed;
uniform vec3 u_explosionCenter;
uniform float u_explosionStrength;
uniform vec2 u_vortexCenter;
uniform float u_vortexStrength;

// ** NEW CURL NOISE UNIFORMS **
uniform float u_curlStrength;
uniform float u_curlScale;
uniform float u_curlSpeed;

// --- Physics Constants (Simplified) ---
const float PARTICLE_MASS = 1.0;
const float DAMPING = 0.95; // Increased stability

uniform float u_worldSize;


// --- Curl Noise Function (Relies on snoise from gpgpu_common) ---
// Returns a 3D vector field that is divergence-free, creating swirls/vortices.
vec3 curlNoise( vec3 p, float scale, float speed ) {
    float t = u_time * speed;
    vec3 p_scaled = p * scale + t;
    
    // Evaluate simplex noise at 6 offset points
    float n1 = snoise(p_scaled + vec3(10.0, 0.0, 0.0));
    float n2 = snoise(p_scaled + vec3(0.0, 10.0, 0.0));
    float n3 = snoise(p_scaled + vec3(0.0, 0.0, 10.0));
    
    float n4 = snoise(p_scaled + vec3(20.0, 0.0, 0.0));
    float n5 = snoise(p_scaled + vec3(0.0, 20.0, 0.0));
    float n6 = snoise(p_scaled + vec3(0.0, 0.0, 20.0));
    
    // Calculate the partial derivatives (finite differences)
    // The curl is defined as: (d/dy - d/dz) * N_x, (d/dz - d/dx) * N_y, (d/dx - d/dy) * N_z
    vec3 curl = vec3(
        n6 - n2,
        n1 - n5,
        n4 - n3
    );

    return curl * 2.0; // Scale output for better visual effect
}

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec3 position = texture(texturePosition, uv).xyz;
    vec3 velocity = texture(textureVelocity, uv).xyz;
    vec3 initialPos = texture(u_initialPosition, uv).xyz;
    vec3 modelPos = texture(u_modelPosition, uv).xyz;


    // --- State Machine ---
    if (u_physicsState == 0) { // STOPPED
        // When stopped, all forces are zero, and damping will quickly bring
        // residual velocity to zero, ensuring perfect rest.
        velocity *= DAMPING; 
        
    } else if (u_physicsState == 1) { // RUNNING (Director Script or Manual Morph Active)
        
        // --- 1. Calculate Attraction Force ---
        vec3 attractionForce = vec3(0.0);
        // Attraction is the MOST important force for stability and morphing
        if (u_attractionStrength > 0.0) {
            vec3 targetPos = (u_targetState == 1) ? modelPos : initialPos;
            attractionForce = (targetPos - position) * u_attractionStrength;
        }

        // --- 2. Calculate Artistic Forces ---
        
        // A. Simple Simplex Noise Flow (existing turbulence)
        vec3 flowForce = vec3(0.0);
        if (u_flowStrength > 0.0) {
            vec3 noise_coord = position * u_flowScale;
            noise_coord.z += u_time * u_flowSpeed;
            flowForce = vec3( snoise(noise_coord), snoise(noise_coord + 10.0), snoise(noise_coord + 20.0)) * u_flowStrength;
        }
        
        // B. Curl Noise (New elegant swirl/flow)
        vec3 curlForce = vec3(0.0);
        if (u_curlStrength > 0.0) {
            curlForce = curlNoise(position, u_curlScale, u_curlSpeed) * u_curlStrength;
        }

        // C. Explosion Force
        vec3 explosionForce = vec3(0.0);
        if (u_explosionStrength != 0.0) {
            vec3 fromCenter = position - u_explosionCenter;
            float dist = length(fromCenter);
            explosionForce = safeNormalize(fromCenter) * u_explosionStrength / (1.0 + dist * dist);
        }

        // D. Vortex Force (simple spin)
        vec3 vortexForce = vec3(0.0);
        if (u_vortexStrength > 0.0) {
            vec2 toCenter = u_vortexCenter - position.xy;
            float dist = length(toCenter);
            vec2 swirlDir = safeNormalize(vec2(-toCenter.y, toCenter.x));
            vortexForce = vec3(swirlDir, 0.0) * u_vortexStrength / (1.0 + dist * 0.1);
        }
        
        // E. Gravity/Director Force (Used by Melt/Reset)
        // NOTE: u_pressureStrength and all SPH logic are removed here.
        
        // --- 3. Combine All Forces ---
        vec3 totalForce = attractionForce 
                        + u_gravity // Gravity is the only remaining 'physics' force
                        + flowForce
                        + curlForce // New force added
                        + explosionForce
                        + vortexForce;

        vec3 acceleration = totalForce / PARTICLE_MASS;

        float maxAccel = 50.0;
        if (length(acceleration) > maxAccel) {
            acceleration = normalize(acceleration) * maxAccel;
        }
        velocity += acceleration * u_delta;
        
        // Apply Damping
        velocity *= DAMPING;
    }

    // --- Boundary Damping (Same as before) ---
    float halfWorld = u_worldSize / 2.0;
    const float WALL_DAMPING = -0.5;
    if ((position.x < -halfWorld && velocity.x < 0.0) || (position.x > halfWorld && velocity.x > 0.0)) {
        velocity.x *= WALL_DAMPING;
    }
    if ((position.y < -halfWorld && velocity.y < 0.0) || (position.y > halfWorld && velocity.y > 0.0)) {
        velocity.y *= WALL_DAMPING;
    }
    if ((position.z < -halfWorld && velocity.z < 0.0) || (position.z > halfWorld && velocity.z > 0.0)) {
        velocity.z *= WALL_DAMPING;
    }

    gl_FragColor = vec4(velocity, 1.0);
}