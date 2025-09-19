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
uniform float u_gpgpu_clothBlendFactor; // Used for smooth transition when enabling cloth

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
    
    vec3 finalPos;
    
    // --- HIGH-LEVEL LOGIC BRANCH ---
    // The cloth simulation is fundamentally incompatible with the other effects.
    // It must run exclusively to maintain a stable physics state.
    if (u_gpgpu_enableCloth) {
        // When cloth is on, it's the ONLY thing that should run.
        // It reads the previous frame's simulation state and computes the next.
        // Crucially, it uses the original 'initialPos' as its anchor/tether goal,
        // not a pre-deformed shape, which ensures stability.
        vec3 currentSimPos = texture(texturePosition, uv).xyz;
        finalPos = calculateCloth(currentSimPos, initialPos, uv, u_audioLow);
    } else {
        // --- NON-CLOTH EFFECTS PIPELINE ---
        // If cloth is off, we can apply the other effects in a controlled sequence.

        // 1. Start with the flat, initial position as our base shape.
        vec3 baseShape = initialPos;
        
        // 2. Apply geometric transformations first to define this new base shape.
        baseShape = calculateCylinder(baseShape, uv, u_audioLow);
        baseShape = calculateFold(baseShape, uv, u_audioLow);
        
        // 3. Calculate all additive displacement effects.
        vec3 displacement = vec3(0.0);
        displacement += calculateSag(uv, u_audioLow);
        displacement += calculateDroop(uv, u_audioLow);
        displacement += calculateWaterRipple(uv, u_audioLow);
        displacement += calculateEqRipple(uv);
        displacement += calculatePeel(uv, u_audioLow);
        
        // 4. Add the final displacement to the (potentially transformed) base shape.
        finalPos = baseShape + displacement;
    }

    // Write the final calculated position to the output texture
    gl_FragColor = vec4(finalPos, 1.0);
}