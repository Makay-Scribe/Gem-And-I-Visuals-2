// Uniforms passed from ImagePlaneManager
uniform float u_time;
uniform vec2 u_planeDimensions;
uniform vec2 u_gpgpu_cubeWallGridSize;
uniform float u_gpgpu_cubeWallMorph;

// GPGPU Data Textures
uniform sampler2D u_positionTexture; 
uniform sampler2D u_initialPosition; 

// Attribute sent for each instance
attribute float instanceId;

// Varyings to pass data to the fragment shader
varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vLocalNormal; 
varying float vTriangleId;

void main() {
    // --- 1. Calculate Grid Position and UV from Instance ID ---
    float gridX = mod(instanceId, u_gpgpu_cubeWallGridSize.x);
    float gridY = floor(instanceId / u_gpgpu_cubeWallGridSize.x);

    // This UV is for sampling the GPGPU textures
    vec2 gpgpu_uv = vec2(
        gridX / (u_gpgpu_cubeWallGridSize.x - 1.0),
        1.0 - (gridY / (u_gpgpu_cubeWallGridSize.y - 1.0))
    );

    // --- 2. Calculate the Cube's MATHEMATICAL Base Position (Fixes Gaps & Alignment) ---
    float cubeSize = u_planeDimensions.x / u_gpgpu_cubeWallGridSize.x;
    float offsetX = (u_gpgpu_cubeWallGridSize.x * cubeSize) / 2.0 - cubeSize / 2.0;
    float offsetY = (u_gpgpu_cubeWallGridSize.y * cubeSize) / 2.0 - cubeSize / 2.0;
    vec3 mathematicalBasePosition = vec3(
        gridX * cubeSize - offsetX,
        gridY * cubeSize - offsetY,
        0.0
    );

    // --- 3. Get Displacement from GPGPU Simulation ---
    vec3 displacedPosFromGPGPU = texture2D(u_positionTexture, gpgpu_uv).xyz;
    vec3 flatPosFromGPGPU = texture2D(u_initialPosition, gpgpu_uv).xyz;
    vec3 displacement = displacedPosFromGPGPU - flatPosFromGPGPU;

    // --- 4. Calculate Stepped Z-offset for the Morph effect ---
    float maxSteppedDisplacement = u_planeDimensions.x * 0.4;
    float PIVOT_CUBE_ID = 40.0;
    float pivotGridX = mod(PIVOT_CUBE_ID, u_gpgpu_cubeWallGridSize.x);
    float pivotGridY = floor(PIVOT_CUBE_ID / u_gpgpu_cubeWallGridSize.x);
    float pivotValue = pivotGridX + pivotGridY;
    float currentValue = gridX + gridY;
    float minSteppedInput = 0.0 - pivotValue;
    float maxSteppedInput = (u_gpgpu_cubeWallGridSize.x - 1.0) + (u_gpgpu_cubeWallGridSize.y - 1.0) - pivotValue;
    float largestDisplacement = max(abs(minSteppedInput), abs(maxSteppedInput));
    float wallStepDepth = largestDisplacement > 0.0 ? maxSteppedDisplacement / largestDisplacement : 0.0;
    float steppedZ = (currentValue - pivotValue) * wallStepDepth;
    float zMorphOffset = mix(0.0, steppedZ, u_gpgpu_cubeWallMorph);

    // --- 5. Calculate Final Vertex Position ---
    vec3 finalPosition = mathematicalBasePosition + displacement + vec3(0.0, 0.0, zMorphOffset) + position;
    vec4 worldPos4 = modelMatrix * vec4(finalPosition, 1.0);
    gl_Position = projectionMatrix * viewMatrix * worldPos4;

    // --- 6. Calculate Custom UV for Texture Mapping (Fixes Flipped Image) ---
    vec2 flippedUv = vec2(uv.x, 1.0 - uv.y);
    // ** THE FIX IS HERE: Invert the gridY to correctly map the texture **
    vec2 uvOffset = vec2(gridX, (u_gpgpu_cubeWallGridSize.y - 1.0) - gridY) / u_gpgpu_cubeWallGridSize;
    vec2 uvScale = 1.0 / u_gpgpu_cubeWallGridSize;
    vUv = (flippedUv * uvScale) + uvOffset;
    
    // --- 7. Pass Varyings to Fragment Shader ---
    vWorldPosition = worldPos4.xyz;
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vLocalNormal = normal; 
    vTriangleId = instanceId;
}