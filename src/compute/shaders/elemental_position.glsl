// Elemental Physics Shader
// STEP 1: STABILIZATION MODE
// We are disabling the complex noise and the 3D model target to ensure
// the system renders a perfect, single, texture-mapped plane.

uniform float uTime;
uniform float uDelta;

// --- Control Sliders ---
uniform float uMorph;
uniform float uTurbulence;
uniform float uFrequency;
uniform float uSpeed;

// --- Data Sources ---
uniform sampler2D u_canvasPosTex; 
uniform sampler2D u_modelPosTex;

// --- Simplex Noise Functions ---
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) { 
    const vec2 C = vec2(1.0/6.0, 1.0/3.0) ;
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy) );
    vec3 x0 = v - i + dot(i, C.xxx) ;
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute( permute( permute( 
        i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
        + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_ );
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4( x.xy, y.xy );
    vec4 b1 = vec4( x.zw, y.zw );
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
}

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    
    vec4 currentPosInfo = texture(texturePosition, uv);
    vec3 currentPos = currentPosInfo.xyz;

    // 1. The Baseline: Flat Canvas
    // We read the initial flat position. This is our anchor.
    vec3 posCanvas = texture(u_canvasPosTex, uv).xyz;
    
    // --- FORCED STABILIZATION ---
    // Instead of morphing to a Blob or Model, we will morph to
    // a very subtle, gentle wave to prove the liquid is working 
    // without breaking the geometry.
    
    vec3 posLiquid = posCanvas;
    
    // A very gentle sine wave ripple. No jagged noise.
    // This allows "stretching and dripping" logic later, but keeps it clean now.
    float wave = sin(posCanvas.x * 0.5 + uTime * uSpeed) * cos(posCanvas.y * 0.5 + uTime * uSpeed * 0.8);
    posLiquid.z += wave * uTurbulence * 2.0; // Z-displacement only

    // We temporarily IGNORE the u_modelPosTex to stop the "shredding" effect.
    // This forces the system to respect the plane topology.
    vec3 target;
    
    // Simple 0-1 mix between Flat Canvas and Gentle Liquid
    // We map the full slider to just this transition for now.
    target = mix(posCanvas, posLiquid, uMorph);

    // Move towards target (simple spring)
    vec3 newPos = mix(currentPos, target, 0.1);

    gl_FragColor = vec4(newPos, 1.0);
}