vec3 calculateCylinder(vec3 flat_pos, vec2 uv, float audio) {
    if (!u_gpgpu_enableCylinder) {
        return flat_pos;
    }

    // Map the plane's X-coordinate (uv.x) to an angle around the cylinder.
    // The offset and arc angle control which part of the circle is used.
    float angle = -(u_gpgpu_cylinderArcOffset + uv.x * u_gpgpu_cylinderArcAngle);
    
    // Map the plane's Y-coordinate (uv.y) to the length along the cylinder's main axis.
    float length_coord = (uv.y - 0.5) * u_planeDimensions.y * u_gpgpu_cylinderHeightScale;

    vec3 p;
    vec3 normal_dir; // The normal direction, used for audio-reactive displacement.

    if (u_gpgpu_cylinderAxisAlignment == 1) { // X-Axis
        p = vec3(length_coord, cos(angle) * u_gpgpu_cylinderRadius, sin(angle) * u_gpgpu_cylinderRadius);
        normal_dir = normalize(vec3(0.0, p.y, p.z));
    } else if (u_gpgpu_cylinderAxisAlignment == 2) { // Z-Axis
        p = vec3(cos(angle) * u_gpgpu_cylinderRadius, sin(angle) * u_gpgpu_cylinderRadius, length_coord);
        normal_dir = normalize(vec3(p.x, p.y, 0.0));
    } else { // Y-Axis (Default)
        p = vec3(cos(angle) * u_gpgpu_cylinderRadius, length_coord, sin(angle) * u_gpgpu_cylinderRadius);
        normal_dir = normalize(vec3(p.x, 0.0, p.z));
    }

    // Audio reactivity is applied outwards along the cylinder's normal.
    // NOTE: deformationStrength is a legacy uniform, we should consider making a new one if needed.
    // For now, let's use a hardcoded small value.
    p += normal_dir * audio * 5.0; 

    return p;
}