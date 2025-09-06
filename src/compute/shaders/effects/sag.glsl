vec3 calculateSag(vec2 uv, float audio) {
    if (!u_gpgpu_enableSag) {
        return vec3(0.0);
    }

    // Center the UV coordinates so (0,0) is the middle of the plane
    vec2 uv_centered = uv - 0.5;

    // Calculate the distance from the center, normalized to a [0, 1] range.
    // The maximum distance is from the center to a corner (sqrt(0.5^2 + 0.5^2) approx 0.7071).
    float dist_from_center = length(uv_centered) / 0.7071;
    dist_from_center = clamp(dist_from_center, 0.0, 1.0);

    // Create a mask that is 1.0 at the center and falls off to 0.0 at the edges.
    // The sharpness controls how quickly it falls off.
    float sag_mask = 1.0 - pow(dist_from_center, u_gpgpu_sagFalloffSharpness);
    
    float total_sag_amount = u_gpgpu_sagAmount * (1.0 + audio * u_gpgpu_sagAudioMod);
    
    float sag_displacement = total_sag_amount * sag_mask;
    
    // Sag is a negative displacement along the Z-axis.
    return getDisplacementNormal() * -sag_displacement;
}