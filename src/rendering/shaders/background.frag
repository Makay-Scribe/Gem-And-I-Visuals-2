// These uniforms are provided by BackgroundManager.js
uniform vec3 iResolution;
uniform float iTime;
uniform vec4 iMouse;
uniform float iAudioVolume;
uniform float iAudioLow;
uniform float iAudioMid;
uniform float iAudioHigh;
uniform float iBeat;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;

out vec4 outColor;

// The mainImage function will be defined by the user's shader code.
// It is injected here by replacing the placeholder comment below.
// SHADERTOY_CODE_GOES_HERE

void main() {
    // We call the mainImage function from the user's shader code.
    vec4 fragColor;
    mainImage(fragColor, gl_FragCoord.xy);
    outColor = fragColor;
}