varying vec2 vUv;

uniform sampler2D mainTexture;
uniform bool hasTexture; // Flag from JavaScript

void main() {
    // --- FINAL CODE ---
    if (hasTexture) {
        vec4 texColor = texture2D(mainTexture, vUv);
        // Discard pixels that are mostly transparent.
        if (texColor.a < 0.1) discard; 
        gl_FragColor = texColor;
    } else {
        // If no texture is loaded, render as grey.
        gl_FragColor = vec4(0.5, 0.5, 0.5, 1.0);
    }
}