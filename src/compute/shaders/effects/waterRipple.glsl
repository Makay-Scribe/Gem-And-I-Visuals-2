vec3 calculateWaterRipple(vec2 uv, float audio) {
    if (!u_gpgpu_enableWaterRipple) {
        return vec3(0.0);
    }
    
    float dist = distance(uv, vec2(0.5));
    float ripple = sin(dist * u_gpgpu_rippleFrequency - u_time * u_gpgpu_rippleSpeed) * (1.0 - dist);
    
    float audio_factor = 1.0 + audio * 2.0;
    
    return getDisplacementNormal() * ripple * u_gpgpu_rippleStrength * audio_factor;
}