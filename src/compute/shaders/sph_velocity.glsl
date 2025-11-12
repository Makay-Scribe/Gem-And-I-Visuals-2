// Artistic Position/Velocity Solver - V8 (Refactored for Unified ComputeManager)
#include <gpgpu_common>

uniform float u_time;
uniform float u_delta;

// --- GPGPU Internal Uniforms ---
uniform sampler2D texturePosition;
uniform sampler2D textureVelocity;

// --- Director Uniforms ---
uniform int u_physicsState;         // 0:stopped, 1:running
uniform vec3 u_gravity;
uniform int u_targetState;          // 0: Canvas, 1: 3D Model
uniform sampler2D u_initialPosition; 
uniform sampler2D u_modelPosition;

// --- Artistic Uniforms (Renamed for Uniqueness) ---
uniform float fluid_attractionStrength; 
uniform float u_flowStrength;
uniform float u_flowScale;
uniform float u_flowSpeed;
uniform vec3 u_explosionCenter;
uniform float u_explosionStrength;
uniform vec2 u_vortexCenter;
uniform float u_vortexStrength;
uniform float fluid_curlStrength; 
uniform float fluid_curlScale;    
uniform float fluid_curlSpeed;    

// ** NEW: Cohesion Uniforms **
uniform float u_cohesionStrength;
uniform sampler2D u_blurredPosition;

// --- Physics Constants (Simplified) ---
const float PARTICLE_MASS = 1.0;
const float DAMPING = 0.95;

uniform float u_worldSize;


// --- Curl Noise Function (Relies on snoise from gpgpu_common) ---
vec3 curlNoise( vec3 p, float scale, float speed ) {
    float t = u_time * speed;
    vec3 p_scaled = p * scale + t;
    
    float n1 = snoise(p_scaled + vec3(10.0, 0.0, 0.0));
    float n2 = snoise(p_scaled + vec3(0.0, 10.0, 0.0));
    float n3 = snoise(p_scaled + vec3(0.0, 0.0, 10.0));
    
    float n4 = snoise(p_scaled + vec3(20.0, 0.0, 0.0));
    float n5 = snoise(p_scaled + vec3(0.0, 20.0, 0.0));
    float n6 = snoise(p_scaled + vec3(0.0, 0.0, 20.0));
    
    vec3 curl = vec3( n6 - n2, n1 - n5, n4 - n3 );

    return curl * 2.0;
}

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec3 position = texture(texturePosition, uv).xyz;
    vec3 velocity = texture(textureVelocity, uv).xyz;
    vec3 initialPos = texture(u_initialPosition, uv).xyz;
    vec3 modelPos = texture(u_modelPosition, uv).xyz;

    if (u_physicsState == 0) { // STOPPED
        velocity *= DAMPING; 
        
    } else { // RUNNING
        
        vec3 attractionForce = vec3(0.0);
        if (fluid_attractionStrength > 0.0) {
            vec3 targetPos = (u_targetState == 1) ? modelPos : initialPos;
            attractionForce = (targetPos - position) * fluid_attractionStrength;
        }

        vec3 flowForce = vec3(0.0);
        if (u_flowStrength > 0.0) {
            vec3 noise_coord = position * u_flowScale + u_time * u_flowSpeed;
            flowForce = vec3( snoise(noise_coord), snoise(noise_coord + 10.0), snoise(noise_coord + 20.0)) * u_flowStrength;
        }
        
        vec3 curlForce = vec3(0.0);
        if (fluid_curlStrength > 0.0) {
            curlForce = curlNoise(position, fluid_curlScale, fluid_curlSpeed) * fluid_curlStrength;
        }

        vec3 explosionForce = vec3(0.0);
        if (u_explosionStrength != 0.0) {
            vec3 fromCenter = position - u_explosionCenter;
            float dist = length(fromCenter);
            explosionForce = safeNormalize(fromCenter) * u_explosionStrength / (1.0 + dist * dist);
        }

        vec3 vortexForce = vec3(0.0);
        if (u_vortexStrength > 0.0) {
            vec2 toCenter = u_vortexCenter - position.xy;
            float dist = length(toCenter);
            vec2 swirlDir = safeNormalize(vec2(-toCenter.y, toCenter.x));
            vortexForce = vec3(swirlDir, 0.0) * u_vortexStrength / (1.0 + dist * 0.1);
        }
        
        // ** NEW: Calculate Cohesion Force **
        vec3 cohesionForce = vec3(0.0);
        if (u_cohesionStrength > 0.0) {
            vec3 blurredPos = texture(u_blurredPosition, uv).xyz;
            cohesionForce = (blurredPos - position) * u_cohesionStrength;
        }

        vec3 totalForce = attractionForce + u_gravity + flowForce + curlForce + explosionForce + vortexForce + cohesionForce;

        vec3 acceleration = totalForce / PARTICLE_MASS;

        float maxAccel = 50.0;
        if (length(acceleration) > maxAccel) {
            acceleration = normalize(acceleration) * maxAccel;
        }
        velocity += acceleration * u_delta;
        
        velocity *= DAMPING;
    }

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