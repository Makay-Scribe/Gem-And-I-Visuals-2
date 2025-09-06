// This is the main shader for GPGPU position computation.
// It includes all modular effect shaders and applies them in sequence.

// --- UNIFORM DECLARATIONS ---
// All uniforms must be declared here to be accessible by the included effect files.

// Uniforms that are used globally by many effects
uniform float u_time;
uniform float u_delta;
uniform float u_audioLow;
uniform sampler2D u_audioTexture;
uniform vec2 u_planeDimensions;
uniform sampler2D u_initialPosition;

// Water Ripple Uniforms
uniform bool u_gpgpu_enableWaterRipple;
uniform float u_gpgpu_rippleSpeed;
uniform float u_gpgpu_rippleStrength;
uniform float u_gpgpu_rippleFrequency;

// EQ Ripple Uniforms
uniform bool u_gpgpu_enableEqRipple; 
uniform float u_gpgpu_eqRippleStrength;
uniform int u_gpgpu_eqRippleStyle;
uniform float u_gpgpu_eqRippleBarCount;
uniform float u_gpgpu_eqRippleBarWidth;
uniform float u_gpgpu_eqRippleRangeStart;
uniform float u_gpgpu_eqRippleRangeEnd;

// Cloth Physics Uniforms
uniform bool u_gpgpu_enableCloth;
uniform float u_gpgpu_clothDamping;
uniform float u_gpgpu_clothStiffness;
uniform float u_gpgpu_clothAudioForce;
uniform float u_gpgpu_clothForceRadius;
uniform int gpgpu_clothIterations;
uniform int gpgpu_clothPinMode;
uniform float u_gpgpu_tetherStrength;
uniform float u_gpgpu_ambientWindStrength;
uniform float u_gpgpu_ambientWindSpeed;
uniform float u_gpgpu_ambientWindScale;
uniform vec3 u_gpgpu_directionalWind;
uniform float u_gpgpu_clothBlendFactor;

// Fold Uniforms
uniform bool u_gpgpu_enableFold;
uniform float u_gpgpu_foldAngle;
uniform float u_gpgpu_foldDepth;
uniform float u_gpgpu_foldRoundness;
uniform float u_gpgpu_foldAudioMod;
uniform float u_gpgpu_foldNudge;
uniform bool u_gpgpu_enableFoldCrease;
uniform float u_gpgpu_foldCreaseDepth;
uniform float u_gpgpu_foldCreaseSharpness;
uniform bool u_gpgpu_enableFoldTuck;
uniform float u_gpgpu_foldTuckAmount;
uniform float u_gpgpu_foldTuckReach;

// Cylinder Uniforms
uniform bool u_gpgpu_enableCylinder;
uniform float u_gpgpu_cylinderRadius;
uniform float u_gpgpu_cylinderHeightScale;
uniform int u_gpgpu_cylinderAxisAlignment;
uniform float u_gpgpu_cylinderArcAngle;
uniform float u_gpgpu_cylinderArcOffset;

// Sag Uniforms
uniform bool u_gpgpu_enableSag;
uniform float u_gpgpu_sagAmount;
uniform float u_gpgpu_sagFalloffSharpness;
uniform float u_gpgpu_sagAudioMod;

// Droop Uniforms
uniform bool u_gpgpu_enableDroop;
uniform float u_gpgpu_droopAmount;
uniform float u_gpgpu_droopAudioMod;
uniform float u_gpgpu_droopFalloffSharpness;
uniform float u_gpgpu_droopSupportedWidthFactor;
uniform float u_gpgpu_droopSupportedDepthFactor;

// Peel Uniforms
uniform bool u_gpgpu_enablePeel;
uniform float u_gpgpu_peelAmount;
uniform float u_gpgpu_peelCurl;
uniform bool u_gpgpu_peelEnableAudio;
uniform float u_gpgpu_peelTextureAmount;
uniform float u_gpgpu_peelDrift;


// --- SHADER INCLUDES ---

// Include common helper functions (snoise, rotationMatrix, etc.)
#include <gpgpu_common>

// Include all individual effect shaders
#include <gpgpu_waterRipple>
#include <gpgpu_eqRipple>
#include <gpgpu_cloth>
#include <gpgpu_fold>
#include <gpgpu_cylinder>
#include <gpgpu_sag>
#include <gpgpu_droop>
#include <gpgpu_peel>


void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec3 initialPos = texture(u_initialPosition, uv).xyz;
    
    vec3 finalPos = initialPos;
    
    // --- GEOMETRIC TRANSFORMATIONS ---
    // These effects fundamentally change the shape and should be applied first.
    finalPos = calculateCylinder(finalPos, uv, u_audioLow);
    finalPos = calculateFold(finalPos, uv, u_audioLow);
    
    // --- MUTUALLY EXCLUSIVE EFFECTS ---
    // The cloth simulation runs independently of the other displacement effects.
    // This prevents state contamination and calculation errors when toggling cloth on/off.
    if (u_gpgpu_enableCloth) {
        // When cloth is enabled, it takes the geometrically transformed position and simulates it.
        // It reads from texturePosition, which contains the previous frame's full simulation state.
        vec3 currentSimPos = texture(texturePosition, uv).xyz;
        finalPos = calculateCloth(currentSimPos, finalPos, uv, u_audioLow); // Pass the base shape as the 'initialPos' goal
    } else {
        // --- STANDARD DISPLACEMENT EFFECTS ---
        // If cloth is off, apply the other displacement effects to the base shape.
        vec3 displacement = vec3(0.0);
        displacement += calculateSag(uv, u_audioLow);
        displacement += calculateDroop(uv, u_audioLow);
        displacement += calculateWaterRipple(uv, u_audioLow);
        displacement += calculateEqRipple(uv);
        displacement += calculatePeel(uv, u_audioLow);
        
        finalPos += displacement;
    }

    // Write the final calculated position to the output texture
    gl_FragColor = vec4(finalPos, 1.0);
}