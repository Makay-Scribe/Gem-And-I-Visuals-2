// This shader calculates the normal vector for each vertex on the surface.
// A normal is a vector that points perpendicular to the surface at a given point.
// It's essential for calculating how light reflects off the surface.

// NOTE: We DO NOT declare 'uniform sampler2D t_position;' here.
// The GPUComputationRenderer provides it automatically because we set it as a dependency.

// Helper function to get the position of a neighboring pixel.
// 'offset' is a vec2 like (1.0, 0.0) for the pixel to the right, or (0.0, 1.0) for the pixel above.
vec3 get_neighbor_pos(vec2 uv, vec2 offset) {
  // We need to know the size of a single pixel in UV space to correctly calculate the neighbor's UV.
  vec2 pixel_size = 1.0 / resolution.xy;
  return texture2D(t_position, uv + offset * pixel_size).xyz;
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;

  // Get the positions of the current point and its direct neighbors.
  vec3 pos_c = texture2D(t_position, uv).xyz; // Center
  vec3 pos_r = get_neighbor_pos(uv, vec2(1.0, 0.0)); // Right
  vec3 pos_l = get_neighbor_pos(uv, vec2(-1.0, 0.0)); // Left
  vec3 pos_t = get_neighbor_pos(uv, vec2(0.0, 1.0)); // Top (in texture space)
  vec3 pos_b = get_neighbor_pos(uv, vec2(0.0, -1.0)); // Bottom (in texture space)

  // Calculate two vectors that lie on the surface of the mesh at this point.
  vec3 tangent = normalize(pos_r - pos_l);
  vec3 bitangent = normalize(pos_t - pos_b);

  // The cross product of the tangent and bitangent gives us the normal vector.
  // normalize() ensures the resulting vector has a length of 1, which is required for lighting calculations.
  vec3 normal = normalize(cross(tangent, bitangent));

  // Write the calculated normal out. The GPUComputationRenderer will store this in our new 't_normal' texture.
  gl_FragColor = vec4(normal, 1.0);
}