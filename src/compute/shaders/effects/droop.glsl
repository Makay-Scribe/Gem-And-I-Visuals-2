vec3 calculateDroop(vec2 uv, float audio) {
    if (!u_gpgpu_enableDroop) {
        return vec3(0.0);
    }

    vec2 centered_uv = uv - 0.5;

    // Define the central "supported" rectangle
    float supported_half_w = u_gpgpu_droopSupportedWidthFactor * 0.5;
    float supported_half_h = u_gpgpu_droopSupportedDepthFactor * 0.5;

    // Calculate how far the current UV is outside this central rectangle
    float dist_outside_w = max(0.0, abs(centered_uv.x) - supported_half_w);
    float dist_outside_h = max(0.0, abs(centered_uv.y) - supported_half_h);

    // Normalize these distances to a [0, 1] range, where 1 is the plane edge
    float unsupported_range_w = 0.5 - supported_half_w;
    float unsupported_range_h = 0.5 - supported_half_h;
    
    float normalized_dist_w = (unsupported_range_w > EPSILON_SHADER) ? dist_outside_w / unsupported_range_w : 0.0;
    float normalized_dist_h = (unsupported_range_h > EPSILON_SHADER) ? dist_outside_h / unsupported_range_h : 0.0;

    // Apply a quadratic falloff to make the droop more natural
    float droop_factor_w = 1.0 - (1.0 - normalized_dist_w) * (1.0 - normalized_dist_w);
    float droop_factor_h = 1.0 - (1.0 - normalized_dist_h) * (1.0 - normalized_dist_h);

    // The final droop is determined by whichever edge the point is closer to "spilling over"
    float combined_droop_factor = max(droop_factor_w, droop_factor_h);
    
    float final_droop_mask = pow(combined_droop_factor, u_gpgpu_droopFalloffSharpness);
    
    float total_droop_amount = u_gpgpu_droopAmount * (1.0 + audio * u_gpgpu_droopAudioMod);
    
    float droop_displacement = total_droop_amount * final_droop_mask;
    
    // Droop is a negative displacement
    return getDisplacementNormal() * -droop_displacement;
}