/*
    hydro_simulation.glsl - V5.2 - Final Architecture

    This shader is now fully compliant with a dependency-driven GPGPU pipeline.
    Splatting is now a dedicated pass.
*/

// --- UNIFORMS ---
// All texture samplers are automatically provided by the library.

// Globals
uniform vec2 u_texelSize;
uniform float u_time;
uniform float u_deltaTime;

// Generic uniforms for specific passes
uniform sampler2D u_source;
uniform float u_dissipation;
uniform float u_aspectRatio;
uniform vec4 u_color;
uniform vec2 u_point;
uniform float u_radius;

// Which pass to run
uniform int u_pass;


// --- PASS FUNCTIONS ---

// PASS 0: Advection
vec4 passAdvect(vec2 uv) {
    vec2 vel = texture(textureVelocity, uv).xy;
    vec2 prev_pos_uv = uv - u_deltaTime * vel;
    vec4 advected_quantity = texture(u_source, prev_pos_uv);
    advected_quantity *= u_dissipation;
    return advected_quantity;
}

// PASS 1: Splat
vec4 passSplat(vec2 uv) {
    // NOTE: We now read from the automatically-provided dependency texture
    // based on the variable we are running this on.
    vec4 existing_value = (u_pass == 10) ? texture(textureDensity, uv) : texture(textureVelocity, uv);
    vec2 correctedUv = uv - u_point;
    correctedUv.x *= u_aspectRatio;
    float dist = length(correctedUv);
    float falloff = smoothstep(u_radius, 0.0, dist);
    return existing_value + u_color * falloff;
}

// PASS 2: Divergence
vec4 passDivergence(vec2 uv) {
    float vel_r = texture(textureVelocity, uv + vec2(u_texelSize.x, 0.0)).x;
    float vel_l = texture(textureVelocity, uv - vec2(u_texelSize.x, 0.0)).x;
    float vel_t = texture(textureVelocity, uv + vec2(0.0, u_texelSize.y)).y;
    float vel_b = texture(textureVelocity, uv - vec2(0.0, u_texelSize.y)).y;
    float divergence = 0.5 * (vel_r - vel_l + vel_t - vel_b);
    return vec4(divergence, 0.0, 0.0, 1.0);
}

// PASS 3: Jacobi (Pressure)
vec4 passJacobi(vec2 uv) {
    float p_r = texture(texturePressure, uv + vec2(u_texelSize.x, 0.0)).x;
    float p_l = texture(texturePressure, uv - vec2(u_texelSize.x, 0.0)).x;
    float p_t = texture(texturePressure, uv + vec2(0.0, u_texelSize.y)).x;
    float p_b = texture(texturePressure, uv - vec2(0.0, u_texelSize.y)).x;
    float divergence = texture(textureDivergence, uv).x;
    float new_pressure = (p_l + p_r + p_b + p_t - divergence) * 0.25;
    return vec4(new_pressure, 0.0, 0.0, 1.0);
}

// PASS 4: Gradient Subtraction
vec4 passGradient(vec2 uv) {
    float p_r = texture(texturePressure, uv + vec2(u_texelSize.x, 0.0)).x;
    float p_l = texture(texturePressure, uv - vec2(u_texelSize.x, 0.0)).x;
    float p_t = texture(texturePressure, uv + vec2(0.0, u_texelSize.y)).x;
    float p_b = texture(texturePressure, uv - vec2(0.0, u_texelSize.y)).x;
    vec2 gradient = 0.5 * vec2(p_r - p_l, p_t - p_b);
    vec2 vel = texture(textureVelocity, uv).xy;
    return vec4(vel - gradient, 0.0, 1.0);
}

// PASS 6: Clear (e.g., for pressure)
vec4 passClear(vec2 uv) {
    return vec4(0.0);
}


void main() {
    vec2 uv = gl_FragCoord.xy / resolution;
    
    // The `u_pass` uniform determines which calculation to run.
    // We use special pass numbers for splatting to know which texture to read.
    // 10 = Splat Density, 11 = Splat Velocity
    if (u_pass == 10 || u_pass == 11) {
        pc_fragColor = passSplat(uv);
    }
    else if (u_pass == 0) {
        pc_fragColor = passAdvect(uv);
    } else if (u_pass == 2) {
        pc_fragColor = passDivergence(uv);
    } else if (u_pass == 3) {
        pc_fragColor = passJacobi(uv);
    } else if (u_pass == 4) {
        pc_fragColor = passGradient(uv);
    } else if (u_pass == 6) {
        pc_fragColor = passClear(uv);
    } else {
        pc_fragColor = vec4(0.0);
    }
}