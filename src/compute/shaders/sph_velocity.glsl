// src/compute/shaders/sph_velocity.glsl

// This shader implements a stable, spring-like attraction force
// to gently pull particles toward the world origin (0,0,0).

// This uniform MUST be declared to match the data sent from JavaScript,
// even if it is not used in this specific physics calculation.
uniform float u_time;

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec3 position = texture(texturePosition, uv).xyz;
    vec3 velocity = texture(textureVelocity, uv).xyz;

    // A stable spring-like force
    // Calculate the vector pointing from the particle to the center.
    vec3 toCenter = -position;
    
    // The force is directly proportional to the distance, but with a very small constant.
    vec3 attractionForce = toCenter * 0.005;
    
    // Apply the force to the velocity for this frame.
    velocity += attractionForce;

    // Apply damping to act like friction and allow particles to settle.
    velocity *= 0.98;

    gl_FragColor = vec4(velocity, 1.0);
}