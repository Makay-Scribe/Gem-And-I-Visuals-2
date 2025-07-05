precision highp float; 

uniform vec3 iResolution; 
uniform float iTime; 
varying vec2 vUv; 

void main() { 
  vec2 p = vUv * 2.0 - 1.0; 
  vec3 col = 0.5 + 0.5 * cos(iTime + p.xyx + vec3(0,2,4)); 
  gl_FragColor = vec4(col,1.0); 
}