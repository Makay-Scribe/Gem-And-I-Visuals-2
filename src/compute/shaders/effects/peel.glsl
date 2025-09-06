vec3 calculatePeel(vec2 uv, float audio) {
    if (!u_gpgpu_enablePeel) {
        return vec3(0.0);
    }

    vec2 centeredUv = uv - 0.5;

    // The effect is strongest at the corners. This calculation amplifies the effect based on distance from the center.
    float cornerStrength = pow(length(centeredUv) * 1.414, 4.0);

    // Use a sine wave to create a smooth looping animation for the peel effect.
    float peelAnimation = (sin(u_time * 0.5) + 1.0) * 0.5; // Ranges from 0 to 1
    
    // Determine the final amount of peel, incorporating the base amount, animation, and optional audio reactivity.
    float audioInfluence = u_gpgpu_peelEnableAudio ? audio : 0.0;
    float totalAmount = u_gpgpu_peelAmount * peelAnimation * (1.0 + audioInfluence * 3.0);
    
    // Calculate the main displacement along the Z-axis (pushing the corners out).
    float displacement = cornerStrength * totalAmount * 10.0;

    // Add some noise-based texture to the peel surface.
    displacement += snoise(vec3(uv * 20.0, u_time * 0.1)) * u_gpgpu_peelTextureAmount * displacement;
    
    // Add a slow "drift" to the curl effect over time.
    float drift_animation = sin(u_time * 0.2) * u_gpgpu_peelDrift;
    float final_curl = u_gpgpu_peelCurl + drift_animation;

    // Calculate the 2D offset in the XY plane to create the curling motion.
    vec2 offset_2d = safeNormalize(centeredUv) * -1.0 * displacement * final_curl;
    
    // Combine the Z-displacement with the XY-curl offset.
    vec3 displacement_vec = getDisplacementNormal() * displacement;
    displacement_vec.xy += offset_2d;

    return displacement_vec;
}