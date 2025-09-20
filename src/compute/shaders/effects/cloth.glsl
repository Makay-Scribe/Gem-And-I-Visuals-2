// Function to satisfy spring constraints between neighboring particles.
// This is the core of the Verlet integration for the cloth simulation.
void satisfyConstraints(inout vec3 p, vec2 uv, float stiffnessPerIteration, float restLengthX, float restLengthY, float restLengthDiag) {
    vec2 texelSize = 1.0 / resolution.xy;
    vec3 delta;
    float deltaLength;

    // --- ORTHOGONAL NEIGHBORS (Full Stiffness) ---
    // Right
    delta = texture(texturePosition, uv + vec2(texelSize.x, 0.0)).xyz - p;
    deltaLength = length(delta);
    if (deltaLength > 0.0) p += delta * 0.5 * stiffnessPerIteration * ((deltaLength - restLengthX) / deltaLength);
    
    // Left
    delta = texture(texturePosition, uv - vec2(texelSize.x, 0.0)).xyz - p;
    deltaLength = length(delta);
    if (deltaLength > 0.0) p += delta * 0.5 * stiffnessPerIteration * ((deltaLength - restLengthX) / deltaLength);
    
    // Up
    delta = texture(texturePosition, uv + vec2(0.0, texelSize.y)).xyz - p;
    deltaLength = length(delta);
    if (deltaLength > 0.0) p += delta * 0.5 * stiffnessPerIteration * ((deltaLength - restLengthY) / deltaLength);

    // Down
    delta = texture(texturePosition, uv - vec2(0.0, texelSize.y)).xyz - p;
    deltaLength = length(delta);
    if (deltaLength > 0.0) p += delta * 0.5 * stiffnessPerIteration * ((deltaLength - restLengthY) / deltaLength);

    // --- DIAGONAL NEIGHBORS (Reduced Stiffness for a softer feel) ---
    float diagonalStiffness = stiffnessPerIteration * 0.7; // Diagonals are slightly less stiff

    // Up-Right
    delta = texture(texturePosition, uv + texelSize).xyz - p;
    deltaLength = length(delta);
    if (deltaLength > 0.0) p += delta * 0.5 * diagonalStiffness * ((deltaLength - restLengthDiag) / deltaLength);

    // Up-Left
    delta = texture(texturePosition, uv + vec2(-texelSize.x, texelSize.y)).xyz - p;
    deltaLength = length(delta);
    if (deltaLength > 0.0) p += delta * 0.5 * diagonalStiffness * ((deltaLength - restLengthDiag) / deltaLength);

    // Down-Right
    delta = texture(texturePosition, uv + vec2(texelSize.x, -texelSize.y)).xyz - p;
    deltaLength = length(delta);
    if (deltaLength > 0.0) p += delta * 0.5 * diagonalStiffness * ((deltaLength - restLengthDiag) / deltaLength);

    // Down-Left
    delta = texture(texturePosition, uv - texelSize).xyz - p;
    deltaLength = length(delta);
    if (deltaLength > 0.0) p += delta * 0.5 * diagonalStiffness * ((deltaLength - restLengthDiag) / deltaLength);
}

// Main function to calculate the cloth physics for a single frame
vec3 calculateCloth(vec3 currentPos, vec3 initialPos, vec2 uv, float audio) {
    vec3 prevPos = texture(texturePreviousPosition, uv).xyz;

    // Verlet integration
    vec3 velocity = (currentPos - prevPos) * u_gpgpu_clothDamping;
    vec3 totalAcceleration = vec3(0.0);

    // --- Forces ---
    
    // 1. Wind
    vec3 noise_coord = vec3(uv * u_gpgpu_ambientWindScale, u_time * u_gpgpu_ambientWindSpeed);
    vec3 ambientWind = vec3(snoise(noise_coord), snoise(noise_coord + 150.0), snoise(noise_coord + 300.0));
    vec3 windForce = (ambientWind * u_gpgpu_ambientWindStrength) + u_gpgpu_directionalWind;
    windForce *= u_gpgpu_clothBlendFactor;

    // 2. Tether Force
    if (u_gpgpu_tetherStrength > 0.0) {
        float distFromCenter = distance(uv, vec2(0.5));
        float tetherFalloff = 1.0 - smoothstep(0.4, 0.7, distFromCenter);
        
        vec3 windTargetPos = initialPos + windForce;
        totalAcceleration += (windTargetPos - currentPos) * u_gpgpu_tetherStrength * tetherFalloff;
    } else {
        totalAcceleration += windForce;
    }

    // 3. Audio Force
    float distFromCenter = distance(uv, vec2(0.5));
    if (distFromCenter < u_gpgpu_clothForceRadius) {
        float falloff = 1.0 - smoothstep(0.0, u_gpgpu_clothForceRadius, distFromCenter);
        vec3 audioAccel = getDisplacementNormal() * audio * u_gpgpu_clothAudioForce * falloff;
        totalAcceleration += audioAccel * u_gpgpu_clothBlendFactor;
    }

    // --- Integration ---
    vec3 newPos = currentPos + velocity + totalAcceleration * u_delta * u_delta;

    // --- Constraints ---
    float restLengthX = u_planeDimensions.x / resolution.x;
    float restLengthY = u_planeDimensions.y / resolution.y;
    float restLengthDiag = length(vec2(restLengthX, restLengthY));

    int iterations = int(gpgpu_clothIterations);

    if (iterations > 0) {
        float stiffnessPerIteration = u_gpgpu_clothStiffness / float(iterations);
        for (int i = 0; i < iterations; i++) {
            satisfyConstraints(newPos, uv, stiffnessPerIteration, restLengthX, restLengthY, restLengthDiag);
        }
    }
    
    // --- Pinning ---
    if (gpgpu_clothPinMode == 1) { // Corners
        if (uv.x < 0.01 && uv.y < 0.01 || uv.x > 0.99 && uv.y < 0.01 || uv.x < 0.01 && uv.y > 0.99 || uv.x > 0.99 && uv.y > 0.99) {
            newPos = initialPos;
        }
    } else if (gpgpu_clothPinMode == 2) { // Top Edge
        if (uv.y > 0.99) {
            newPos = initialPos;
        }
    } else if (gpgpu_clothPinMode == 3) { // Center
        if (distance(uv, vec2(0.5)) < 0.05) {
            newPos = initialPos;
        }
    }

    return newPos;
}