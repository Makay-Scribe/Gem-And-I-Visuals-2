uniform sampler2D u_positionTexture;
uniform sampler2D u_velocityTexture;
uniform float particle_base_size;
uniform float particle_min_size;
uniform float u_particle_size_mix; // 0.0 = base size, 1.0 = min size
uniform float u_pixelRatio;

varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vNormal;
// ** THE FIX IS HERE: Add a new varying to pass the GPGPU UV coordinate **
varying vec2 vGpgpuUV;

void main() {
    // This 'uv' comes from the geometry buffer attribute. It represents the particle's
    // original position on the flat 2D grid (e.g., top-left, center, etc.).
    vUv = uv;

    // This is the coordinate we must use to look up data in our GPGPU textures.
    // We flip the Y-axis because WebGL's texture coordinates (0,0 at top-left) are
    // inverted compared to the typical buffer geometry UVs (0,0 at bottom-left).
    vec2 gpgpu_uv = vec2(uv.x, 1.0 - uv.y);
    
    // ** THE FIX IS HERE: Pass the correct GPGPU coordinate to the fragment shader. **
    // Now, the fragment shader will know BOTH the particle's original grid position (vUv)
    // AND its correct lookup coordinate for baked data (vGpgpuUV).
    vGpgpuUV = gpgpu_uv;

    vec3 pos_center = texture(u_positionTexture, gpgpu_uv).xyz;
    vec3 velocity = texture(u_velocityTexture, gpgpu_uv).xyz;

    vec2 texelSize = 1.0 / vec2(textureSize(u_positionTexture, 0));
    vec3 pos_right = texture(u_positionTexture, gpgpu_uv + vec2(texelSize.x, 0.0)).xyz;
    vec3 pos_up = texture(u_positionTexture, gpgpu_uv - vec2(0.0, texelSize.y)).xyz;
    
    vNormal = normalize(cross(pos_right - pos_center, pos_up - pos_center));
    
    vWorldPosition = pos_center;
    vec4 mvPosition = modelViewMatrix * vec4(pos_center, 1.0);
    
    gl_Position = projectionMatrix * mvPosition;
    
    // --- SIMPLIFIED SIZING LOGIC ---
    // Smoothly interpolate between the base size and the min size using the mix uniform.
    float targetSize = mix(particle_base_size, particle_min_size, u_particle_size_mix);
    
    // Apply perspective scaling and zoom/pixel ratio correction.
    gl_PointSize = targetSize * (300.0 / -mvPosition.z) * u_pixelRatio;
}