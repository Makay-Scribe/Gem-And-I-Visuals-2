vec3 calculateEqRipple(vec2 uv) { 
    if (!u_gpgpu_enableEqRipple) {
        return vec3(0.0);
    }

    float rangeWidth = u_gpgpu_eqRippleRangeEnd - u_gpgpu_eqRippleRangeStart; 
    if (rangeWidth <= 0.0) return vec3(0.0);

    float remappedUvX;
    if (u_gpgpu_eqRippleStyle == 1) { // Center
        remappedUvX = abs(uv.x - 0.5) * 2.0;
    } else if (u_gpgpu_eqRippleStyle == 2) { // Full
        remappedUvX = uv.x;
    } else { // Left (Default)
        remappedUvX = uv.x;
        rangeWidth *= 0.5; // In left mode, the full audio range is mapped to the left half of the plane
    }

    // Exit if the current pixel is outside the active range
    if (remappedUvX < u_gpgpu_eqRippleRangeStart || remappedUvX > u_gpgpu_eqRippleRangeEnd) return vec3(0.0);
    
    // Normalize the coordinate to be within the active range [0, 1]
    float finalUvX = (remappedUvX - u_gpgpu_eqRippleRangeStart) / rangeWidth;

    // Determine which frequency bar this pixel belongs to
    float barIndexFloat = finalUvX * u_gpgpu_eqRippleBarCount; 
    float barIndexInt = floor(barIndexFloat); 
    
    // Find the center of the bar to sample the audio texture
    float texelCoordX = (barIndexInt + 0.5) / u_gpgpu_eqRippleBarCount; 
    
    // Sample the audio texture
    float audioValue = texture(u_audioTexture, vec2(texelCoordX, 0.5)).r; 
    
    // Create the "window" for the bar shape
    float barProgress = fract(barIndexFloat); 
    float halfBarW = u_gpgpu_eqRippleBarWidth * 0.5; 
    float window = step(0.5 - halfBarW, barProgress) - step(0.5 + halfBarW, barProgress); 
    
    float displacement = audioValue * u_gpgpu_eqRippleStrength * window; 
    
    return getDisplacementNormal() * displacement; 
}