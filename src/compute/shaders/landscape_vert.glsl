uniform sampler2D texturePosition;

varying vec2 vUv;

void main() {
    vUv = uv;

    vec4 gpuPosition = texture2D(texturePosition, uv);
    vec3 newPosition = gpuPosition.xyz;

    vec4 modelViewPosition = modelViewMatrix * vec4(newPosition, 1.0);
    gl_Position = projectionMatrix * modelViewPosition;
}