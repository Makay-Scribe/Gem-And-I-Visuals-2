uniform float time;
uniform float transitionProgress;
uniform float baseWarpMode; // 0.0 for None, 1.0 for Cylinder
uniform float baseWarpRadius;
uniform float baseWarpYScale;
uniform sampler2D initialPositionTexture; // The static, original plane data

// Function to generate a random 3D direction
vec3 random3(vec3 c) {
    float j = 4096.0 * sin(dot(c, vec3(17.0, 59.4, 15.0)));
    vec3 r;
    r.z = fract(512.0 * j);
    j *= .125;
    r.x = fract(512.0 * j);
    j *= .125;
    r.y = fract(512.0 * j);
    return normalize(r - 0.5);
}

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    
    // ALWAYS start with the original, unmodified position data.
    vec3 position = texture2D(initialPositionTexture, uv).xyz;

    // --- Apply Y-Scale to the base shape ---
    position.y *= baseWarpYScale;

    // --- Base Warp Logic ---
    if (baseWarpMode == 1.0) { // Cylinder Mode
        float radius = baseWarpRadius;
        float angle = (uv.x - 0.5) * 2.0 * 3.14159;
        
        // We use the original X for the angle, but the scaled Y for the height.
        float originalX = texture2D(initialPositionTexture, uv).x;
        position.x = cos(angle) * radius;
        position.z = sin(angle) * radius;
    }

    // --- Apply physics velocity AFTER all warping and scaling ---
    vec3 velocity = texture2D(textureVelocity, uv).xyz;
    position += velocity;

    gl_FragColor = vec4(position, 1.0);
}