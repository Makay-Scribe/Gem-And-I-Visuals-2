uniform sampler2D u_positionTexture;
// UNUSED: uniform sampler2D u_velocityTexture;
uniform float particle_base_size;
uniform float particle_min_size;
uniform float u_particle_size_mix; // 0.0 = base size, 1.0 = min size
uniform float u_pixelRatio;

// This attribute contains the (0,0) to (1,1) coordinates for each particle.
attribute vec2 gpgpu_uv;

varying vec2 vUv; 
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec2 vGpgpuUV;

// A "safe" normalize function to prevent NaN errors.
vec3 safeNormalize(vec3 v) {
    if (length(v) == 0.0) {
        return vec3(0.0, 0.0, 1.0);
    }
    return normalize(v);
}

void main() {
    // Read the final particle position from the GPGPU texture
    vec3 pos_center = texture(u_positionTexture, gpgpu_uv).xyz;
    
    // Pass the GPGPU UV to the fragment shader for model texture lookup
    vGpgpuUV = gpgpu_uv;
    
    // Flip the V-coordinate for the main image texture lookup
    vUv = vec2(gpgpu_uv.x, 1.0 - gpgpu_uv.y); 

    // Calculate the particle's normal by sampling its neighbors in the GPGPU texture
    vec2 texelSize = 1.0 / vec2(textureSize(u_positionTexture, 0));
    vec3 pos_right = texture(u_positionTexture, gpgpu_uv + vec2(texelSize.x, 0.0)).xyz;
    vec3 pos_up = texture(u_positionTexture, gpgpu_uv + vec2(0.0, texelSize.y)).xyz; 
    vNormal = safeNormalize(cross(pos_right - pos_center, pos_up - pos_center));
    
    // Standard transformations for rendering
    vWorldPosition = pos_center;
    vec4 mvPosition = modelViewMatrix * vec4(pos_center, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    // Calculate the final point size, accounting for perspective
    float targetSize = mix(particle_base_size, particle_min_size, u_particle_size_mix);
    gl_PointSize = targetSize * (300.0 / -mvPosition.z) * u_pixelRatio;
}