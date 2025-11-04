// Smoothed Particle Hydrodynamics (SPH) Velocity Shader - V6 (Stable & Correct)
#include <gpgpu_common>

uniform float u_time;
uniform float u_delta;

// --- Director Uniforms ---
uniform int u_physicsState;         // 0:stopped, 1:running
uniform vec3 u_gravity;
uniform float u_pressureStrength;
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


// --- SPH Constants ---
const float PARTICLE_MASS = 1.0;
const float SMOOTHING_RADIUS = 1.5; // h
const float STIFFNESS = 3.0;       // k
const float REST_DENSITY = 1.0;     // rho_0
const float VISCOSITY = 0.2;       // mu
const float WALL_DAMPING = -0.5;

uniform float u_worldSize;

const float POLY6 = 315.0 / (64.0 * PI * pow(SMOOTHING_RADIUS, 9.0));
const float SPIKY_GRAD = -45.0 / (PI * pow(SMOOTHING_RADIUS, 6.0));
const float VISC_LAP = 45.0 / (PI * pow(SMOOTHING_RADIUS, 6.0));

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec3 position = texture(texturePosition, uv).xyz;
    vec3 velocity = texture(textureVelocity, uv).xyz;
    vec3 initialPos = texture(u_initialPosition, uv).xyz;
    vec3 modelPos = texture(u_modelPosition, uv).xyz;


    // --- State Machine ---

    if (u_physicsState == 0) { // STOPPED
        velocity = vec3(0.0);

    } else if (u_physicsState == 1) { // RUNNING (Director Script Active)
        
        // --- 1. Calculate SPH Forces (Pressure & Viscosity) ---
        vec3 pressureForce = vec3(0.0);
        vec3 viscosityForce = vec3(0.0);
        
        if (u_pressureStrength > 0.0) {
            float density = 0.0;
            const int neighborhood = 20;
            for (int y = -neighborhood; y <= neighborhood; y++) {
                for (int x = -neighborhood; x <= neighborhood; x++) {
                    if (x == 0 && y == 0) continue;

                    vec2 neighborUV = uv + vec2(float(x), float(y)) / resolution.xy;
                    if (neighborUV.x < 0.0 || neighborUV.x > 1.0 || neighborUV.y < 0.0 || neighborUV.y > 1.0) continue;
                    vec3 neighborPos = texture(texturePosition, neighborUV).xyz;
                    vec3 r = position - neighborPos;
                    float r2 = dot(r, r);
                    if (r2 < SMOOTHING_RADIUS * SMOOTHING_RADIUS) {
                        density += PARTICLE_MASS * POLY6 * pow(SMOOTHING_RADIUS * SMOOTHING_RADIUS - r2, 3.0);
                    }
                }
            }

            for (int y = -neighborhood; y <= neighborhood; y++) {
                for (int x = -neighborhood; x <= neighborhood; x++) {
                    if (x == 0 && y == 0) continue;
                    
                    vec2 neighborUV = uv + vec2(float(x), float(y)) / resolution.xy;
                    if (neighborUV.x < 0.0 || neighborUV.x > 1.0 || neighborUV.y < 0.0 || neighborUV.y > 1.0) continue;
                    vec3 neighborPos = texture(texturePosition, neighborUV).xyz;
                    vec3 r = position - neighborPos;
                    float r2 = dot(r, r);
                    if (r2 < SMOOTHING_RADIUS * SMOOTHING_RADIUS && r2 > 0.0) {
                        float r_len = sqrt(r2);
                        pressureForce += -PARTICLE_MASS * STIFFNESS * (density - REST_DENSITY) * SPIKY_GRAD * pow(SMOOTHING_RADIUS - r_len, 2.0) / r_len * r;
                        vec3 neighborVel = texture(textureVelocity, neighborUV).xyz;
                        viscosityForce += VISCOSITY * PARTICLE_MASS * (neighborVel - velocity) * VISC_LAP * (SMOOTHING_RADIUS - r_len);
                    }
                }
            }
        }
        
        // --- 2. Calculate Attraction Force ---
        vec3 attractionForce = vec3(0.0);
        if (u_attractionStrength > 0.0) {
            vec3 targetPos = (u_targetState == 1) ? modelPos : initialPos;
            attractionForce = (targetPos - position) * u_attractionStrength;
        }

        // --- 3. Calculate Artistic Forces ---
        vec3 flowForce = vec3(0.0);
        if (u_flowStrength > 0.0) {
            vec3 noise_coord = position * u_flowScale;
            noise_coord.z += u_time * u_flowSpeed;
            flowForce = vec3( snoise(noise_coord), snoise(noise_coord + 10.0), snoise(noise_coord + 20.0)) * u_flowStrength;
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

        // --- 4. Combine All Forces ---
        vec3 totalForce = (pressureForce * u_pressureStrength) 
                        + viscosityForce 
                        + u_gravity 
                        + attractionForce 
                        + flowForce
                        + explosionForce
                        + vortexForce;

        vec3 acceleration = totalForce / PARTICLE_MASS;

        float maxAccel = 50.0;
        if (length(acceleration) > maxAccel) {
            acceleration = normalize(acceleration) * maxAccel;
        }
        velocity += acceleration * u_delta;
    }

    // --- Shared Logic ---
    velocity *= 0.98;

    // ** THE FIX IS HERE: This shader now ONLY modifies velocity. Position is NOT touched. **
    float halfWorld = u_worldSize / 2.0;
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