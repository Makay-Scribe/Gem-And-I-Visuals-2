// Received from the vertex shader
in vec3 v_barycentric;
in vec3 v_worldNormal; 

float edgeFactor() {
    // Use fwidth to get an anti-aliased line thickness that is consistent
    // regardless of distance from the camera.
    vec3 d = fwidth(v_barycentric);
    // Smoothstep creates the fade effect for the line.
    vec3 a3 = smoothstep(vec3(0.0), d * 1.5, v_barycentric);
    // The minimum of the three barycentric coordinates will be 0 at the edges.
    return min(min(a3.x, a3.y), a3.z);
}

void main() {
    // Define the colors we'll be using
    vec3 pink = vec3(1.0, 0.5, 0.75);
    vec3 white = vec3(1.0, 1.0, 1.0);
    vec3 black = vec3(0.0, 0.0, 0.0);

    // Choose the primary face color based on the Y-direction of the normal.
    // This makes faces pointing "up" one color, and faces pointing "down" another.
    vec3 faceColor = v_worldNormal.y > 0.0 ? white : pink;

    // Use mix() to create the wireframe effect.
    // When edgeFactor() is 0 (at the triangle edge), the color is black.
    // When edgeFactor() is 1 (at the triangle center), the color is faceColor.
    vec3 finalColor = mix(black, faceColor, edgeFactor());

    gl_FragColor = vec4(finalColor, 1.0);
}