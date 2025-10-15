// Smoothed Particle Hydrodynamics (SPH) Velocity Shader
// This shader calculates forces between particles to simulate fluid dynamics.

const float PI = 3.14159265359;

uniform float u_time;
uniform float u_delta;

// SPH Parameters
uniform float u_fluid_gravity; 

uniform bool u_isPhysicsRunning;

// ** THE FIX IS HERE: Add new uniforms for state management. **
uniform sampler2D u_initialPosition; // The particle's original, flat position.
uniform int u_physicsState;         // 0: stopped, 1: running, 2: resetting
uniform float u_resetProgress;      // 0.0 to 1.0 for the reset animation.

// Balanced physics constants for a stable simulation
const float PARTICLE_MASS = 1.0;
const float SMOOTHING_RADIUS = 1.5; // h
const float STIFFNESS = 3.0;       // k
const float REST_DENSITY = 1.0;     // rho_0
const float VISCOSITY = 0.2;       // mu
const float WALL_DAMPING = -0.5;

// Simulation world properties
uniform vec2 u_planeDimensions;

// Pre-calculated kernel constants to optimize calculations
const float POLY6 = 315.0 / (64.0 * PI * pow(SMOOTHING_RADIUS, 9.0));
const float SPIKY_GRAD = -45.0 / (PI * pow(SMOOTHING_RADIUS, 6.0));
const float VISC_LAP = 45.0 / (PI * pow(SMOOTHING_RADIUS, 6.0));

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec3 position = texture(texturePosition, uv).xyz;
    vec3 velocity = texture(textureVelocity, uv).xyz;
    vec3 initialPos = texture(u_initialPosition, uv).xyz;

    // --- State Machine Logic ---
    if (u_physicsState == 0) { // STOPPED
        velocity = vec3(0.0);
    } 
    else if (u_physicsState == 1) { // RUNNING
        // --- STAGE 1: DENSITY CALCULATION ---
        float density = 0.0;
        for (int y = -4; y <= 4; y++) {
            for (int x = -4; x <= 4; x++) {
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

        // --- STAGE 2: FORCE CALCULATION ---
        vec3 pressureForce = vec3(0.0);
        vec3 viscosityForce = vec3(0.0);
        vec3 externalForce = vec3(0.0, u_fluid_gravity * 100.0, 0.0) * PARTICLE_MASS;
        for (int y = -4; y <= 4; y++) {
            for (int x = -4; x <= 4; x++) {
                vec2 neighborUV = uv + vec2(float(x), float(y)) / resolution.xy;
                if (neighborUV.x < 0.0 || neighborUV.x > 1.0 || neighborUV.y < 0.0 || neighborUV.y > 1.0) continue;
                vec3 neighborPos = texture(texturePosition, neighborUV).xyz;
                vec3 r = position - neighborPos;
                float r2 = dot(r, r);
                if (r2 < SMOOTHING_RADIUS * SMOOTHING_RADIUS && r2 > 0.0) {
                    float r_len = sqrt(r2);
                    pressureForce += PARTICLE_MASS * STIFFNESS * (density - REST_DENSITY) * SPIKY_GRAD * pow(SMOOTHING_RADIUS - r_len, 2.0) / r_len * r;
                    vec3 neighborVel = texture(textureVelocity, neighborUV).xyz;
                    viscosityForce += VISCOSITY * PARTICLE_MASS * (neighborVel - velocity) * VISC_LAP * (SMOOTHING_RADIUS - r_len);
                }
            }
        }
        
        float settleDuration = 1.0; 
        float settleFactor = smoothstep(0.0, settleDuration, u_time);
        vec3 totalForce = (pressureForce + viscosityForce + externalForce) * settleFactor;
        vec3 acceleration = vec3(0.0);
        if (density > 0.0) {
            acceleration = totalForce / density;
        }
        float maxAccel = 50.0;
        if (length(acceleration) > maxAccel) {
            acceleration = normalize(acceleration) * maxAccel;
        }
        velocity += acceleration * u_delta;
    } 
    else if (u_physicsState == 2) { // RESETTING
        // Calculate a simple attraction force pulling the particle back to its original position.
        vec3 attractionForce = (initialPos - position) * 2.0; // The multiplier is the "strength" of the pull.
        
        // As the reset progresses, blend out the old velocity and blend in the new attraction force.
        velocity = mix(velocity, attractionForce, u_resetProgress);
    }


    // --- Shared Logic (Boundary Conditions) ---
    // Apply damping to all moving particles.
    velocity *= 0.98;

    vec3 halfBounds = vec3(u_planeDimensions.x / 2.0, u_planeDimensions.y / 2.0, u_planeDimensions.x / 2.0);
    if (position.x < -halfBounds.x) { velocity.x *= WALL_DAMPING; }
    if (position.x > halfBounds.x)  { velocity.x *= WALL_DAMPING; }
    if (position.y < -halfBounds.y) { velocity.y *= WALL_DAMPING; }
    if (position.y > halfBounds.y)  { velocity.y *= WALL_DAMPING; }
    if (position.z < -halfBounds.z) { velocity.z *= WALL_DAMPING; }
    if (position.z > halfBounds.z)  { velocity.z *= WALL_DAMPING; }

    gl_FragColor = vec4(velocity, 1.0);
}