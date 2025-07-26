// Uniforms passed from ImagePlaneManager
uniform float u_time;
uniform vec2 u_planeDimensions;
uniform vec2 u_gpgpu_cubeWallGridSize;
uniform float u_gpgpu_cubeWallMorph;

// Attribute sent for each instance
attribute float instanceId;

// Varyings to pass data to the fragment shader
varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vLocalNormal; 
varying float vTriangleId;

void main() {
    // --- 1. Calculate Grid Position from Instance ID ---
    float gridX = mod(instanceId, u_gpgpu_cubeWallGridSize.x);
    float gridY = floor(instanceId / u_gpgpu_cubeWallGridSize.x);

    // --- 2. Calculate Stepped and Flat Z Positions (Corrected Pivot Math) ---
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
    float flatZ = 0.0;

    // --- 3. Morph between the two states (Reverted to Correct Direction) ---
    // ** THE FIX IS HERE: The mix function is reversed to match the new UI. **
    float finalZ = mix(flatZ, steppedZ, u_gpgpu_cubeWallMorph);

    // --- 4. Calculate Cube's Base (X, Y) Position ---
    float cubeSize = u_planeDimensions.x / u_gpgpu_cubeWallGridSize.x;
    float offsetX = (u_gpgpu_cubeWallGridSize.x * cubeSize) / 2.0 - cubeSize / 2.0;
    float offsetY = (u_gpgpu_cubeWallGridSize.y * cubeSize) / 2.0 - cubeSize / 2.0;

    vec3 instancePosition = vec3(
        gridX * cubeSize - offsetX,
        gridY * cubeSize - offsetY,
        finalZ
    );

    // --- 5. Calculate Final Vertex Position ---
    vec4 worldPos4 = modelMatrix * (vec4(position, 1.0) + vec4(instancePosition, 0.0));
    gl_Position = projectionMatrix * viewMatrix * worldPos4;

    // --- 6. Calculate Custom UV for Texture Mapping ---
    vec2 flippedUv = vec2(uv.x, 1.0 - uv.y);
    vec2 uvOffset = vec2(gridX, (u_gpgpu_cubeWallGridSize.y - 1.0) - gridY) / u_gpgpu_cubeWallGridSize;
    vec2 uvScale = 1.0 / u_gpgpu_cubeWallGridSize;
    vUv = (flippedUv * uvScale) + uvOffset;
    
    // --- 7. Pass World Position and Normals to Fragment Shader ---
    vWorldPosition = worldPos4.xyz;
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vLocalNormal = normal; 
    vTriangleId = instanceId;
}