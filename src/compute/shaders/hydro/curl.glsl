/*
    curl.glsl

    Calculates a curl noise field. This creates a turbulent, swirling vector field
    that is divergence-free, meaning it adds motion without causing the fluid to
    expand or compress. It's perfect for ambient, continuous turbulence.
*/

uniform vec2 resolution;
uniform float u_time;
uniform float u_curlStrength;
uniform float u_curlScale;
uniform float u_curlSpeed;

// We will need to include a noise function, like snoise, for this to work.
#include <hydro_common>

// ** THE FIX IS HERE: Replaced the buggy curlNoise function with a mathematically correct one. **
// This version correctly uses a scalar (float-returning) snoise function to compute a 3D curl vector.
vec3 curlNoise(vec3 p) {
    const float e = 0.01; // A small epsilon for calculating derivatives

    // Sample the noise field at points offset along each axis
    float n1 = snoise(vec3(p.x, p.y + e, p.z)).x;
    float n2 = snoise(vec3(p.x, p.y - e, p.z)).x;
    float n3 = snoise(vec3(p.x, p.y, p.z + e)).x;
    float n4 = snoise(vec3(p.x, p.y, p.z - e)).x;
    float n5 = snoise(vec3(p.x + e, p.y, p.z)).x;
    float n6 = snoise(vec3(p.x - e, p.y, p.z)).x;

    // Approximate the partial derivatives
    float dz_dy = (n1 - n2) / (2.0 * e);
    float dy_dz = (n3 - n4) / (2.0 * e);
    float dx_dz = (n3 - n4) / (2.0 * e);
    float dz_dx = (n5 - n6) / (2.0 * e);
    float dy_dx = (n5 - n6) / (2.0 * e);
    float dx_dy = (n1 - n2) / (2.0 * e);

    // Calculate the curl (∇ × F)
    float x = dy_dz - dz_dy;
    float y = dz_dx - dx_dz;
    float z = dx_dy - dy_dx;

    return vec3(x, y, z);
}

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    
    // Use a 3D coordinate for the noise, with z animated by time
    vec3 p = vec3(uv * u_curlScale, u_time * u_curlSpeed);
    
    vec3 noise = curlNoise(p);
    
    gl_FragColor = vec4(noise * u_curlStrength, 1.0);
}