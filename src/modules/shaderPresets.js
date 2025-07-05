export const shaderPresets = {
    presetBg1: `
// CC0: Towards the source of life
//  A bit change of pace today
//  Still decently compact
//  Now I will take a walk and see if I can shorten it further

// Twigl: https://twigl.app?ol=true&ss=-OTqrs-Td6CYNZQF2MIy

void mainImage(out vec4 O, vec2 C) {
  float i  // Loop counter for raymarching steps
      , j  // Multipurpose: fractal octave counter, then canyon depth factor
      , d  // Distance to nearest mountain surface (controls step size & translucency)
      , z  // Current distance along the ray (depth into the canyon)
      , k  // Sine wave modulation for adding surface detail variation
      ;  
  vec3 r=iResolution  // Screen resolution (width, height, aspect ratio)
     , o              // Accumulated color/light as we march through the canyon
     , p              // Current 3D world position along the ray
     , R=normalize(vec3(C-.5*r.xy, r.y)) // Ray direction from camera through this pixel
     ;
  vec4 U = vec4(2,3,1,0); // Reusable color constants (red, green, blue, zero)
  
  // Raymarching loop: step through the canyon scene
  for(vec2 P  // 2D coordinate for sampling the mountain height noise
         , X  // Accumulated mountain height from fractal noise layers
         , Y  // Current fractal octave amplitude (gets smaller each layer)
      ; ++i<77.        
      ; z+=.8*d        // Step forward based on distance to nearest surface
      ) {
    // Calculate current 3D position along the camera ray
    p = z*R;
    p.z += iTime; // Move forward
    
    // Generate procedural mountain terrain using fractal noise
    P = p.xz*.5;  // Use XZ plane (top-down view) scaled down for terrain sampling
    X -= X;       // Reset height accumulator to zero (equivalent to X = vec2(0))
    
    Y=vec2(.6);   // Start with base amplitude for first noise octave
    // Build mountain heights using 4 octaves of sine wave interference
    for (
         j=0.          // Reset octave counter
       ; ++j<4.        // Generate 4 octaves of detail
       ; Y *= vec2(.6,.4)  // Reduce amplitude each octave (creates fractal falloff)
       )
        X -= (sin(P.x)*sin(P.y)+1.)*Y // Add sine interference pattern scaled by octave
      , P *= 2.1*mat2(.6,.8,-.6,.8)   // Rotate & scale coordinates for next octave detail
      ;
    
    // Shape the canyon walls using distance from center
    k = sin(p.x)*sin(p.z); // Surface texture variation using sine waves
    j = smoothstep(.5,4.,abs(p.x+sin(.2*p.z)*sin(.32*p.z))); // Canyon width (0=center, 1=walls)
    
    // Combine mountain height with canyon shaping and add vertical offset
    X = abs(X*j+p.y+vec2(1,2)); // j scales mountains (higher at canyon walls)
    j = .1+j*j; // Convert canyon distance to lighting intensity
    
    // Distance field: how close we are to the mountain surface
    d = min(X.x, X.y)+1E-3; // Take closest mountain, add epsilon for translucency
    
    // Add colored light based on which mountain face we're closest to
    o += X.x < X.y 
      ? j/d*vec3(2.+k,3.*p.y,3)  // Outer mountain face: purple-red with height gradient
      : 20.*j/sqrt(d)*(1.+k)*(1.+sin(99.*p.y+50.*p.z)/z)*U.wzy // Inner face: blue with fine detail
      ;
    
    // Add the river of light at canyon bottom
    o += .2/max(j-.1, 5e-4)*U.zxy; // Bright cyan-yellow glow, protected from divide-by-zero
  }
  
  // Add horizon glow effect in the distance
  o += 1E3/abs(2.*R.y+.2)*smoothstep(25., 50.,z)*vec3(1,2,6); // Cyan sky glow
  
  // Final color output with tone mapping and contrast adjustment
  O = tanh(o.xyzx/3e4)/.8-U*8E-2; // Compress bright values, boost contrast
}
`,
    presetBg2: `
float sun(vec2 uv, float battery)
{
 	float val = smoothstep(0.3, 0.29, length(uv));
 	float bloom = smoothstep(0.7, 0.0, length(uv));
    float cut = 3.0 * sin((uv.y + iTime * 0.2 * (battery + 0.02)) * 100.0) 
				+ clamp(uv.y * 14.0 + 1.0, -6.0, 6.0);
    cut = clamp(cut, 0.0, 1.0);
    return clamp(val * cut, 0.0, 1.0) + bloom * 0.6;
}

float grid(vec2 uv, float battery)
{
    vec2 size = vec2(uv.y, uv.y * uv.y * 0.2) * 0.01;
    uv += vec2(0.0, iTime * 4.0 * (battery + 0.05));
    uv = abs(fract(uv) - 0.5);
 	vec2 lines = smoothstep(size, vec2(0.0), uv);
 	lines += smoothstep(size * 5.0, vec2(0.0), uv) * 0.4 * battery;
    return clamp(lines.x + lines.y, 0.0, 3.0);
}

float dot2(in vec2 v ) { return dot(v,v); }

float sdTrapezoid( in vec2 p, in float r1, float r2, float he )
{
    vec2 k1 = vec2(r2,he);
    vec2 k2 = vec2(r2-r1,2.0*he);
    p.x = abs(p.x);
    vec2 ca = vec2(p.x-min(p.x,(p.y<0.0)?r1:r2), abs(p.y)-he);
    vec2 cb = p - k1 + k2*clamp( dot(k1-p,k2)/dot2(k2), 0.0, 1.0 );
    float s = (cb.x<0.0 && ca.y<0.0) ? -1.0 : 1.0;
    return s*sqrt( min(dot2(ca),dot2(cb)) );
}

float sdLine( in vec2 p, in vec2 a, in vec2 b )
{
    vec2 pa = p-a, ba = b-a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    return length( pa - ba*h );
}

float sdBox( in vec2 p, in vec2 b )
{
    vec2 d = abs(p)-b;
    return length(max(d,vec2(0))) + min(max(d.x,d.y),0.0);
}

float opSmoothUnion(float d1, float d2, float k){
	float h = clamp(0.5 + 0.5 * (d2 - d1) /k,0.0,1.0);
    return mix(d2, d1 , h) - k * h * ( 1.0 - h);
}

float sdCloud(in vec2 p, in vec2 a1, in vec2 b1, in vec2 a2, in vec2 b2, float w)
{
	//float lineVal1 = smoothstep(w - 0.0001, w, sdLine(p, a1, b1));
    float lineVal1 = sdLine(p, a1, b1);
    float lineVal2 = sdLine(p, a2, b2);
    vec2 ww = vec2(w*1.5, 0.0);
    vec2 left = max(a1 + ww, a2 + ww);
    vec2 right = min(b1 - ww, b2 - ww);
    vec2 boxCenter = (left + right) * 0.5;
    //float boxW = right.x - left.x;
    float boxH = abs(a2.y - a1.y) * 0.5;
    //float boxVal = sdBox(p - boxCenter, vec2(boxW, boxH)) + w;
    float boxVal = sdBox(p - boxCenter, vec2(0.04, boxH)) + w;
    
    float uniVal1 = opSmoothUnion(lineVal1, boxVal, 0.05);
    float uniVal2 = opSmoothUnion(lineVal2, boxVal, 0.05);
    
    return min(uniVal1, uniVal2);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (2.0 * fragCoord.xy - iResolution.xy)/iResolution.y;
    float battery = iAudioVolume;
    
    vec3 col = vec3(0.0, 0.1, 0.2);
    if (uv.y < -0.2)
    {
        uv.y = 3.0 / (abs(uv.y + 0.2) + 0.05);
        uv.x *= uv.y * 1.0;
        float gridVal = grid(uv, battery);
        col = mix(col, vec3(1.0, 0.5, 1.0), gridVal);
    }
    else
    {
        float fujiD = min(uv.y * 4.5 - 0.5, 1.0);
        uv.y -= battery * 1.1 - 0.51;
        
        vec2 sunUV = uv;
        vec2 fujiUV = uv;
        
        sunUV += vec2(0.75, 0.2);
        col = vec3(1.0, 0.2, 1.0);
        float sunVal = sun(sunUV, battery);
        
        col = mix(col, vec3(1.0, 0.4, 0.1), sunUV.y * 2.0 + 0.2);
        col = mix(vec3(0.0, 0.0, 0.0), col, sunVal);
        
        float fujiVal = sdTrapezoid( uv  + vec2(-0.75+sunUV.y * 0.0, 0.5), 1.75 + pow(uv.y * uv.y, 2.1), 0.2, 0.5);
        float waveVal = uv.y + sin(uv.x * 20.0 + iTime * 2.0) * 0.05 + 0.2;
        float wave_width = smoothstep(0.0,0.01,(waveVal));
        
        col = mix( col, mix(vec3(0.0, 0.0, 0.25), vec3(1.0, 0.0, 0.5), fujiD), step(fujiVal, 0.0));
        col = mix( col, vec3(1.0, 0.5, 1.0), wave_width * step(fujiVal, 0.0));
        col = mix( col, vec3(1.0, 0.5, 1.0), 1.0-smoothstep(0.0,0.01,abs(fujiVal)) );
        
        col += mix( col, mix(vec3(1.0, 0.12, 0.8), vec3(0.0, 0.0, 0.2), clamp(uv.y * 3.5 + 3.0, 0.0, 1.0)), step(0.0, fujiVal) );
        
        vec2 cloudUV = uv;
        cloudUV.x = mod(cloudUV.x + iTime * 0.1, 4.0) - 2.0;
        float cloudTime = iTime * 0.5;
        float cloudY = -0.5;
        float cloudVal1 = sdCloud(cloudUV, vec2(0.1 + sin(cloudTime + 140.5)*0.1,cloudY), vec2(1.05 + cos(cloudTime * 0.9 - 36.56) * 0.1, cloudY), vec2(0.2 + cos(cloudTime * 0.867 + 387.165) * 0.1,0.25+cloudY), vec2(0.5 + cos(cloudTime * 0.9675 - 15.162) * 0.09, 0.25+cloudY), 0.075);
        cloudY = -0.6;
        float cloudVal2 = sdCloud(cloudUV, vec2(-0.9 + cos(cloudTime * 1.02 + 541.75) * 0.1,cloudY), vec2(-0.5 + sin(cloudTime * 0.9 - 316.56) * 0.1, cloudY), vec2(-1.5 + cos(cloudTime * 0.867 + 37.165) * 0.1,0.25+cloudY), vec2(-0.6 + sin(cloudTime * 0.9675 + 665.162) * 0.09, 0.25+cloudY), 0.075);
        
        float cloudVal = min(cloudVal1, cloudVal2);
        
        col = mix(col, vec3(0.0, 0.0, 0.2), 1.0 - smoothstep(0.075 - 0.0001, 0.075, cloudVal));
        col += vec3(1.0, 1.0, 1.0)*(1.0 - smoothstep(0.0,0.01,abs(cloudVal - 0.075)));
    }
    
    float fog = smoothstep(0.1, -0.02, abs(uv.y + 0.2));
    col += fog * fog * fog;
    col = mix(vec3(col.r, col.r, col.r) * 0.5, col, battery * 0.7);

    fragColor = vec4(col,1.0);
}
`,
    presetBg3: `
#define PI 3.14159265359
#define E 2.7182818284
#define GR 1.61803398875
#define time (sin(((sin(float(__LINE__)*100.0)*GR/PI+GR/PI/E)*iTime+100.0)/100.0)*100.0)
#define saw(x) (acos(cos(x))/PI)
#define sphereN(uv) (clamp(1.0-length(uv*2.0-1.0), 0.0, 1.0))
#define clip(x) (smoothstep(0.5-GR/PI/E, .5+GR/PI/E, x))
#define zero(x) (smoothstep(-1.0/PI/E/GR, 1.0/PI/E/GR, sin(x*PI/2.0))*2.0-1.0)
#define TIMES_DETAILED (1.0)
#define angle(uv) (atan((uv).y, (uv).x))
#define angle_percent(uv) ((angle(uv)/PI+1.0)/2.0)
#define absMin(x,y) (abs(x) < abs(y) ? x: y)
#define quadrant(uv) (absMin((zero(uv).x), (zero(uv).y))+floor(uv.x/2.0)+floor(uv.y/2.0))
#define flux(x) (vec3(cos(x),cos(4.0*PI/3.0+x),cos(2.0*PI/3.0+x))*.5+.5)
#define rotatePoint(p,n,theta) (p*cos(theta)+cross(n,p)*sin(theta)+n*dot(p,n) *(1.0-cos(theta)))
#define GUASS(x) (smoothstep(0.0, 1.0/GR/PI/E, saw(x*PI/2.0)*(1.0-saw(x*PI/2.0))))
#define GRID_COUNT (50.0)
#define hash(p) (fract(sin(vec2( dot(p,vec2(127.5,313.7)),dot(p,vec2(239.5,185.3))))*43458.3453))
#define MAX_DIM (max(iResolution.x, iResolution.y))

float seedling = 0.0;

vec2 spiral(vec2 uv)
{
    float turns = 5.0;
    float r = pow(log(length(uv)+1.), 1.175);
    float theta = atan(uv.y, uv.x)*turns-r*PI;
    return vec2(saw(r*PI+iTime), saw(theta+iTime*1.1));
}

vec2 cmul(vec2 v1, vec2 v2) {
	return vec2(v1.x * v2.x - v1.y * v2.y, v1.y * v2.x + v1.x * v2.y);
}

vec2 cdiv(vec2 v1, vec2 v2) {
	return vec2(v1.x * v2.x + v1.y * v2.y, v1.y * v2.x - v1.x * v2.y) / dot(v2, v2);
}

vec2 mobius(vec2 uv, vec2 multa, vec2 offa, vec2 multb, vec2 offb)
{
    return saw(cdiv(cmul(uv, multa) + offa, cmul(uv, multb) + offb)*PI)*2.0-1.0;
}

vec2 square_map(vec2 uv)
{
    return (rotatePoint(vec3(uv+vec2(cos(seedling*PI), cos(seedling*GR)), 0.0), vec3(0.0, 0.0, 1.0), time/PI).xy*(1.0+sin(time+seedling)/PI/E/GR)
            +vec2(cos(time+seedling)+sin(time+seedling)));
}

vec2 iterate_square(vec2 uv, vec2 dxdy, out float magnification)
{
    vec2 a = uv+vec2(0.0, 		0.0);
    vec2 b = uv+vec2(dxdy.x, 	0.0);
    vec2 c = uv+vec2(dxdy.x, 	dxdy.y);
    vec2 d = uv+vec2(0.0, 		dxdy.y);
    vec2 ma = square_map(a);
    vec2 mb = square_map(b);
    vec2 mc = square_map(c);
    vec2 md = square_map(d);
    float da = length(mb-ma);
    float db = length(mc-mb);
    float dc = length(md-mc);
    float dd = length(ma-md);
	float stretch = max(max(max(da/dxdy.x,db/dxdy.y),dc/dxdy.x),dd/dxdy.y);
    magnification = stretch;
    return square_map(uv);
}

vec2 mobius_map(vec2 uv, vec2 multa, vec2 offa, vec2 multb, vec2 offb)
{
    return mobius(uv, multa, offa, multb, offb);
}

vec2 iterate_mobius(vec2 uv, vec2 dxdy, out float magnification, vec2 multa, vec2 offa, vec2 multb, vec2 offb)
{
    vec2 a = uv+vec2(0.0, 		0.0);
    vec2 b = uv+vec2(dxdy.x, 	0.0);
    vec2 c = uv+vec2(dxdy.x, 	dxdy.y);
    vec2 d = uv+vec2(0.0, 		dxdy.y);
    vec2 ma = mobius_map(a, multa, offa, multb, offb);
    vec2 mb = mobius_map(b, multa, offa, multb, offb);
    vec2 mc = mobius_map(c, multa, offa, multb, offb);
    vec2 md = mobius_map(d, multa, offa, multb, offb);
    float da = length(mb-ma);
    float db = length(mc-mb);
    float dc = length(md-mc);
    float dd = length(ma-md);
	float stretch = max(max(max(da/dxdy.x,db/dxdy.y),dc/dxdy.x),dd/dxdy.y);
    magnification = stretch;
    return mobius_map(uv, multa, offa, multb, offb);
}

vec3 phase(float map)
{
    return vec3(saw(map), saw(4.0*PI/3.0+map), saw(2.0*PI/3.0+map));
}

float lowAverage()
{
    const int iters = 32;
    float product = 1.0;
    float sum = 0.0;
    float smallest = 0.0;
    for(int i = 0; i < iters; i++)
    {
        float sound = texture(iChannel0, vec2(float(i)/float(iters), 0.5)).r;
        smallest = 0.0;
        product *= sound;
        sum += sound;
    }
    return max(sum/float(iters), pow(product, 1.0/float(iters)));
}

vec3 hash3( vec2 p)
{
    vec3 q = vec3( dot(p,vec2(123.4,234.5)), dot(p,vec2(456.7,321.0)), dot(p,vec2(432.1,543.2)) );
    return fract(sin(q)*12345.678);
}

vec4 galaxy(vec2 uv)
{
	uv *= 5.0;
    float r1 = log(length(uv)+1.)*2.0;
    float r2 = pow(log(length(uv)+1.)*3.0, .5);
    float rotation = time;
    float theta1 = atan(uv.y, uv.x)-r1*PI+rotation*.5+seedling;
    float theta2 = atan(uv.y, uv.x)-r2*PI+rotation*.5+seedling;
    vec4 color = vec4(flux(time+seedling), 1.0);
    vec4 final_color = acos(1.0-(cos(theta1)*cos(theta1)+sqrt(cos(theta1+PI)*cos(theta1+PI)))/2.0)*(1.0-log(r1+1.))*color + cos(1.0-(cos(theta2)*cos(theta2)+cos(theta2+PI/2.)*cos(theta2+PI/2.))/2.0)*(1.25-log(r2+1.))*color;
    final_color.rgba += color;
    final_color /= r1;
    final_color *= 2.0;
    float weight = clamp(length(clamp(final_color.rgb, 0.0, 1.0)), 0.0, 1.0);
    return final_color;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord.xy / iResolution.xy;
    vec4 sample1 = texture(iChannel1, uv);
    float scale = exp(sin(time))*E+GR;
    uv = uv*scale-scale/2.0;
    uv.x *= iResolution.x/iResolution.y;
    uv = rotatePoint(vec3(uv, 0.0), vec3(0.0, 0.0, 1.0), time/PI).xy;
    vec2 uv0 = uv;
    uv += cos(vec2(time, time/GR));
    float r = length(uv);
    float map = time;
    float noise = 1.0;
    float spounge = time*4.0*PI;
	const int max_iterations = 4;
    int target = max_iterations;
    vec2 multa, multb, offa, offb;
    float antispeckle = 1.0; 
    float magnification = 1.0;
	vec3 color = vec3(1.0);
	vec3 accum = vec3(0.0);
    float sum = 0.0;
    float anticolor = 1.0;
    seedling = 0.0;
    float black, white;
    white = 0.0;
    float border_color = 0.0;
    float border = 0.0;
    vec4 hit = vec4(0.0);
    for(int i = 0; i < max_iterations; i++)
    {
        float iteration = float(i)/float(max_iterations);
        multa = cos(vec2(time*1.1, time*1.2)+iteration*PI);
        offa = cos(vec2(time*1.3, time*1.4)+iteration*PI)*PI;
        multb = cos(vec2(time*1.5, time*1.6)+iteration*PI);
        offb = cos(vec2(time*1.7, time*1.8)+iteration*PI);
        uv = iterate_square(uv, .5/iResolution.xy, magnification);
        float weight = smoothstep(0.0, 0.25, magnification);
        antispeckle *= smoothstep(0.0, 1.0/TIMES_DETAILED, sqrt(1.0/(1.0+magnification)));
        float q = quadrant(uv);
        seedling += q+float(i);
        map += (q+seedling)*antispeckle;
        float shift = time;
        border = max(border, (smoothstep(1.0-1.0/GR/E/PI, 1.0, (cos(uv.y*PI)))));
        border = max(border, (smoothstep(1.0-1.0/GR/E/PI, 1.0, (cos(uv.x*PI)))));
        float stripes = map*1.0*PI;
        float black_val = smoothstep(0.0, .75, saw(stripes))*clamp(1.0-abs(border), 0.0, 1.0);
        float white_val = smoothstep(0.75, 1.0, saw(stripes))*black_val;
        vec3 final_color = flux(map*2.0*PI+shift+float(i))*black_val+white_val;
        color *= (final_color);
        accum += final_color;
        sum += 1.0;
        anticolor *= white_val;
        if(i != 0)
        {
			hit += galaxy(saw(uv*PI/2.0)*2.0-1.0)*clamp(1.0-length(hit.rgb), 0.0, 1.0)*(1.0-border);
            uv = iterate_mobius(uv, .5/iResolution.xy, magnification, multa, offa, multb, offb);
            antispeckle *= smoothstep(0.0, 1.0/TIMES_DETAILED, sqrt(1.0/(1.0+magnification)));
            border = max(border, (smoothstep(1.0-1.0/GR/E/PI, 1.0, (cos(uv.y*PI)))));
            border = max(border, (smoothstep(1.0-1.0/GR/E/PI, 1.0, (cos(uv.x*PI)))));
        }
    }
    
    scale = 32.;
    vec2 gridPosition = floor(uv0 * scale) / scale;
    vec2 randomOffset = hash(gridPosition) * 2. - 1.;
    vec2 localGridPositionCenter = fract(uv0 * scale) - .5;
    float stars = mix(0., 1., step(length(localGridPositionCenter + randomOffset * .5), .1));
    float map2 = (stars+length(randomOffset))*PI*2.0;
    float twinkle = saw(time+map2);
    hit = hit+clamp(vec4(flux(map2+time)*PI+twinkle, 1.0)*stars*twinkle*PI, 0.0, 1.0)*clamp(1.0-(border), 0.0, 1.0);
    
    color = pow(color, vec3(1.0/float(max_iterations)));
    
    antispeckle = pow(antispeckle, 1.0/float(max_iterations));
    
    fragColor.rgb = (color+accum/sum)*(1.0-border);
    fragColor.a = 1.0;
    
    fragColor = hit;
}
`
};