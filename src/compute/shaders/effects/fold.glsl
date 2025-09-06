vec3 calculateFold(vec3 flat_pos, vec2 uv_param, float audio) {
    if (!u_gpgpu_enableFold) {
        return flat_pos;
    }

    // Determine which corner this UV coordinate belongs to and normalize it
    vec2 local_uv;
    int corner_index; // 0=BL, 1=BR, 2=TL, 3=TR
    if (uv_param.x < 0.5 && uv_param.y < 0.5)      { local_uv = uv_param; corner_index = 0; }
    else if (uv_param.x > 0.5 && uv_param.y < 0.5) { local_uv = vec2(1.0 - uv_param.x, uv_param.y); corner_index = 1; }
    else if (uv_param.x < 0.5 && uv_param.y > 0.5) { local_uv = vec2(uv_param.x, 1.0 - uv_param.y); corner_index = 2; }
    else                                           { local_uv = vec2(1.0 - uv_param.x, 1.0 - uv_param.y); corner_index = 3; }

    // Define the local coordinate system of the plane
    vec3 axis_U = vec3(1.0, 0.0, 0.0);
    vec3 axis_V = vec3(0.0, 1.0, 0.0);
    vec3 axis_W = getDisplacementNormal();

    // The fold happens along a diagonal line. If we are far from the diagonal, do nothing.
    float uv_sum_diag = local_uv.x + local_uv.y;
    if (uv_sum_diag >= u_gpgpu_foldDepth + u_gpgpu_foldRoundness + EPSILON_SHADER) {
        return flat_pos;
    }

    float arm_U = u_gpgpu_foldDepth * u_planeDimensions.x;
    float arm_V = u_gpgpu_foldDepth * u_planeDimensions.y;
    
    // Determine the corner's sign for correct hinge placement
    vec3 corner_sign = (corner_index == 0) ? vec3(-1,-1, 1) : (corner_index == 1) ? vec3( 1,-1,-1) : (corner_index == 2) ? vec3(-1, 1,-1) : vec3( 1, 1, 1);

    // Calculate the start and end points of the hinge line in 3D space
    vec3 hinge_start = corner_sign.x * axis_U * (u_planeDimensions.x * 0.5 - arm_U) + corner_sign.y * axis_V * (u_planeDimensions.y * 0.5);
    vec3 hinge_end   = corner_sign.x * axis_U * (u_planeDimensions.x * 0.5)           + corner_sign.y * axis_V * (u_planeDimensions.y * 0.5 - arm_V);
    vec3 hinge_axis  = normalize(hinge_end - hinge_start);
    
    // Calculate the total fold angle, including audio modulation
    float main_fold_angle = (-u_gpgpu_foldAngle + u_gpgpu_foldAudioMod * audio) * corner_sign.z;
    
    // Smoothly blend the fold effect based on distance from the diagonal
    float blend_factor = 1.0 - smoothstep(u_gpgpu_foldDepth - u_gpgpu_foldRoundness, u_gpgpu_foldDepth + u_gpgpu_foldRoundness, uv_sum_diag);
    float actual_rotation_angle = main_fold_angle * blend_factor;
    
    // Rotate the point around the hinge
    mat3 R = rotationMatrix3(hinge_axis, actual_rotation_angle);
    vec3 folded_pos = hinge_start + R * (flat_pos - hinge_start);
    vec3 transformed_normal = R * axis_W;

    // Apply nudge (arching the fold)
    if (abs(u_gpgpu_foldNudge) > 0.001) {
        float progress_along_hinge = clamp(dot(flat_pos - hinge_start, hinge_axis) / length(hinge_end - hinge_start), 0.0, 1.0);
        float arch_factor = sin(progress_along_hinge * PI);
        folded_pos += transformed_normal * u_gpgpu_foldNudge * arch_factor * blend_factor;
    }
    
    // Apply tuck (pulling the corner in/out)
    if (u_gpgpu_enableFoldTuck) {
        float tuck_falloff = 1.0 - smoothstep(0.0, u_gpgpu_foldTuckReach, length(local_uv));
        if (tuck_falloff > 0.0) {
            vec3 outward_vector = normalize(corner_sign.x * axis_U + corner_sign.y * axis_V);
            float tuck_strength = u_gpgpu_foldTuckAmount * -0.5;
            folded_pos += outward_vector * tuck_strength * tuck_falloff * blend_factor;
        }
    }

    // Apply crease (pushing the diagonal line up/down)
    if (u_gpgpu_enableFoldCrease) {
        float dist_from_diag = abs(local_uv.x - local_uv.y) / 1.4142; // Normalized distance from diagonal
        float crease_mask = 1.0 - smoothstep(0.0, u_gpgpu_foldDepth * 0.5, dist_from_diag);
        crease_mask = pow(crease_mask, u_gpgpu_foldCreaseSharpness * 0.5);
        folded_pos += transformed_normal * u_gpgpu_foldCreaseDepth * crease_mask * blend_factor;
    }

    return folded_pos;
}