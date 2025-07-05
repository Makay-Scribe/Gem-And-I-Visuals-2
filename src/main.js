import './style.css';
import * as THREE from 'three';
import { UIManager } from './modules/UIManager.js';
import { ButterchurnManager } from './modules/ButterchurnManager.js';
import { Debugger } from './modules/Debugger.js';
import { AudioProcessor } from './modules/AudioProcessor.js';
import { CameraManager } from './modules/CameraManager.js';
import { ShaderManager } from './modules/ShaderManager.js';
import { SceneManager } from './modules/SceneManager.js';
import { BackgroundManager } from './modules/BackgroundManager.js';
import { ImagePlaneManager } from './modules/ImagePlaneManager.js';
import { ModelManager } from './modules/ModelManager.js';
import { ComputeManager } from './compute/ComputeManager.js';
import { GPGPUDebugger } from './modules/GPGPUDebugger.js';

const App = {
    THREE: THREE, 
    renderer: null, camera: null, scene: null, 
    gltfModel: null, animationMixer: null,
    modelPresets: {
        'modelPreset1': { name: 'Dancing Planet', path: '/3dmodel/converted/Dancing planet.glb' },
        'modelPreset2': { name: 'Swimming Shark', path: '/3dmodel/converted/Swimming shark.glb' },
        'modelPreset3': { name: 'Flying Pterodactyl', path: '/3dmodel/converted/Flying pterodactyl.glb' },
        'modelPreset4': { name: 'School of Fish', path: '/3dmodel/converted/School of fish.glb' },
        'modelPreset5': { name: 'Walking Astronaut', path: '/3dmodel/converted/Walking astronaut.glb' },
        'modelPreset6': { name: 'Banana Gun', path: '/3dmodel/converted/Banana Gun with Scope.glb' },
        'modelPreset7': { name: 'Dancing Planet', path: '/3dmodel/converted/Dancing planet.glb' },      // Doubled up
        'modelPreset8': { name: 'Swimming Shark', path: '/3dmodel/converted/Swimming shark.glb' },      // Doubled up
        'modelPreset9': { name: 'Flying Pterodactyl', path: '/3dmodel/converted/Flying pterodactyl.glb' },// Doubled up
        'modelPreset10': { name: 'School of Fish', path: '/3dmodel/converted/School of fish.glb' },     // Doubled up
        'modelPreset11': { name: 'Walking Astronaut', path: '/3dmodel/converted/Walking astronaut.glb' },// Doubled up
        'modelPreset12': { name: 'Banana Gun', path: '/3dmodel/converted/Banana Gun with Scope.glb' },   // Doubled up
    },
    shaderAudioValue: 0.0,
    hdrTexture: null, audioTexture: null,
    backgroundScene: null, backgroundCamera: null, backgroundPlane: null,
    shaderMaterial: null, butterchurnMaterial: null, butterchurnTexture: null,
    guideLaser: null, directionalLight: null, ambientLight: null,
    clock: new THREE.Clock(), currentTime: 0, frame: 0,
    mouseState: new THREE.Vector4(0, 0, 0, 0),
    jolt_currentOffset: 0.0, 
    jolt_targetOffset: 0.0,
    shaderPresets: {
        presetBg1: `// "Star Nest" by Pablo Román Andrioli\n// License: CC BY-NC-SA 3.0\n\n#define iterations 17\n#define formuparam 0.53\n\n#define volsteps 8\n#define stepsize 0.2\n\n#define zoom   0.900\n#define tile   0.850\n#define speed  0.010 \n\n#define brightness 0.0015\n#define darkmatter 0.300\n#define distfading 0.560\n#define saturation 0.800\n\nvoid mainImage( out vec4 fragColor, in vec2 fragCoord )\n{\n\t//get coords and direction\n\tvec2 uv=fragCoord.xy/iResolution.xy-.5;\n\tuv.y*=iResolution.y/iResolution.x;\n\tvec3 dir=vec3(uv*zoom,1.);\n\tfloat time=iTime*speed+.25;\n\n\t//mouse rotation\n\tfloat a1=.5+iMouse.x/iResolution.x*2.;\n\tfloat a2=.8+iMouse.y/iResolution.y*2.;\n\tmat2 rot1=mat2(cos(a1),sin(a1),-sin(a1),cos(a1));\n\tmat2 rot2=mat2(cos(a2),sin(a2),-sin(a2),cos(a2));\n\tdir.xz*=rot1;\n\tdir.xy*=rot2;\n\tvec3 from=vec3(1.,.5,0.5);\n\tfrom+=vec3(time*2.,time,-2.);\n\tfrom.xz*=rot1;\n\tfrom.xy*=rot2;\n\t\n\t//volumetric rendering\n\tfloat s=0.1,fade=1.;\n\tvec3 v=vec3(0.);\n\tfor (int r=0; r<volsteps; r++) {\n\t\tvec3 p=from+s*dir*.5;\n\t\tp = abs(vec3(tile)-mod(p,vec3(tile*2.))); // tiling fold\n\t\tfloat pa,a=pa=0.;\n\t\tfor (int i=0; i<iterations; i++) { \n\t\t\tp=abs(p)/dot(p,p)-formuparam; // the magic formula\n\t\t\ta+=abs(length(p)-pa); // absolute sum of average change\n\t\t\tpa=length(p);\n\t\t}\n\t\tfloat dm=max(0.,darkmatter-a*a*.001); //dark matter\n\t\ta*=a*a; // add contrast\n\t\tif (r>3) fade*=1.-dm; // dark matter, don't render near\n\t\t//v+=vec3(dm,dm*.5,0.);\n\t\tv+=fade;\n\t\tv+=vec3(s,s*s,s*s*s*s)*a*brightness*fade; //coloring based on distance\n\t\tfade*=distfading; //fade out distant objects\n\t\ts+=stepsize;\n\t}\n\tv=mix(vec3(length(v)),v,saturation); //color saturation\n\tfragColor = vec4(v*.01,1.);\t\n}`,
        presetBg2: `// "Seascape" by Alexander Alekseev aka TDM - 2014\nconst int NUM_STEPS = 8;\nconst float PI\t \t= 3.141592;\nconst float EPSILON\t= 1e-3;\n#define EPSILON_NRM (0.1 / iResolution.x)\n\nconst int ITER_GEOMETRY = 3;\nconst int ITER_FRAGMENT = 5;\nconst float SEA_HEIGHT = 0.6;\nconst float SEA_CHOPPY = 4.0;\nconst float SEA_SPEED = 0.8;\nconst float SEA_FREQ = 0.16;\nconst vec3 SEA_BASE = vec3(0.1,0.19,0.22);\nconst vec3 SEA_WATER_COLOR = vec3(0.8,0.9,0.6);\n#define SEA_TIME (1.0 + iTime * SEA_SPEED)\nconst mat2 octave_m = mat2(1.6,1.2,-1.2,1.6);\n\nmat3 fromEuler(vec3 ang) {\n\tvec2 a1 = vec2(sin(ang.x),cos(ang.x));\n    vec2 a2 = vec2(sin(ang.y),cos(ang.y));\n    vec2 a3 = vec2(sin(ang.z),cos(ang.z));\n    mat3 m;\n    m[0] = vec3(a1.y*a3.y+a1.x*a2.x*a3.x,a1.y*a2.x*a3.x+a3.y*a1.x,-a2.y*a3.x);\n\tm[1] = vec3(-a2.y*a1.x,a1.y*a2.y,a2.x);\n\tm[2] = vec3(a3.y*a1.x*a2.x+a1.y*a3.x,a1.x*a3.x-a1.y*a3.y*a2.x,a2.y*a3.y);\n\treturn m;\n}\nfloat hash( vec2 p ) {\n\tfloat h = dot(p,vec2(127.1,311.7));\t\n    return fract(sin(h)*43758.5453123);\n}\nfloat noise( in vec2 p ) {\n    vec2 i = floor( p );\n    vec2 f = fract( p );\t\n\tvec2 u = f*f*(3.0-2.0*f);\n    return -1.0+2.0*mix( mix( hash( i + vec2(0.0,0.0) ), \n                     hash( i + vec2(1.0,0.0) ), u.x),\n                mix( hash( i + vec2(0.0,1.0) ), \n                     hash( i + vec2(1.0,1.0) ), u.x), u.y);\n}\n\nfloat diffuse(vec3 n,vec3 l,float p) { return pow(dot(n,l) * 0.4 + 0.6,p); }\nfloat specular(vec3 n,vec3 l,vec3 e,float s) {    \n\tfloat nrm = (s + 8.0) / (PI * 8.0);\n    return pow(max(dot(reflect(e,n),l),0.0),s) * nrm;\n}\n\nvec3 getSkyColor(vec3 e) {\n    e.y = max(e.y,0.0);\n    return vec3(pow(1.0-e.y,2.0), 1.0-e.y, 0.6+(1.0-e.y)*0.4);\n}\n\nfloat sea_octave(vec2 uv, float choppy) {\n\tuv += noise(uv);        \n    vec2 wv = 1.0-abs(sin(uv));\n    vec2 swv = abs(cos(uv));    \n    wv = mix(wv,swv,wv);\n    return pow(1.0-pow(wv.x * wv.y,0.65),choppy);\n}\n\nfloat map(vec3 p) {\n\tfloat freq = SEA_FREQ;\n    float amp = SEA_HEIGHT;\n    float choppy = SEA_CHOPPY;\n    vec2 uv = p.xz; uv.x *= 0.75;\n    \n    float d, h = 0.0;    \n    for(int i = 0; i < ITER_GEOMETRY; i++) {        \n    \td = sea_octave((uv+SEA_TIME)*freq,choppy);\n    \td += sea_octave((uv-SEA_TIME)*freq,choppy);\n        h += d * amp;        \n    \tuv *= octave_m; freq *= 1.9; amp *= 0.22;\n        choppy = mix(choppy,1.0,0.2);\n    }\n    return p.y - h;\n}\n\nfloat map_detailed(vec3 p) {\n\tfloat freq = SEA_FREQ;\n    float amp = SEA_HEIGHT;\n    float choppy = SEA_CHOPPY;\n    vec2 uv = p.xz; uv.x *= 0.75;\n    \n    float d, h = 0.0;    \n    for(int i = 0; i < ITER_FRAGMENT; i++) {        \n    \td = sea_octave((uv+SEA_TIME)*freq,choppy);\n    \td += sea_octave((uv-SEA_TIME)*freq,choppy);\n        h += d * amp;        \n    \tuv *= octave_m; freq *= 1.9; amp *= 0.22;\n        choppy = mix(choppy,1.0,0.2);\n    }\n    return p.y - h;\n}\n\nvec3 getSeaColor(vec3 p, vec3 n, vec3 l, vec3 eye, vec3 dist) {  \n    float fresnel = clamp(1.0 - dot(n,-eye), 0.0, 1.0);\n    fresnel = pow(fresnel,3.0) * 0.65;\n        \n    vec3 reflected = getSkyColor(reflect(eye,n));    \n    vec3 refracted = SEA_BASE + diffuse(n,l,80.0) * SEA_WATER_COLOR * 0.12; \n    \n    vec3 color = mix(refracted,reflected,fresnel);\n    \n    float atten = max(1.0 - dot(dist,dist) * 0.001, 0.0);\n    color += SEA_WATER_COLOR * (p.y - SEA_HEIGHT) * 0.18 * atten;\n    \n    color += vec3(specular(n,l,eye,60.0));\n    \n    return color;\n}\n\nvec3 getNormal(vec3 p, float eps) {\n    vec3 n;\n    n.y = map_detailed(p);\n    n.x = map_detailed(vec3(p.x+eps,p.y,p.z)) - n.y;\n    n.z = map_detailed(vec3(p.x,p.y,p.z+eps)) - n.y;\n    n.y = eps;\n    return normalize(n);\n}\n\nfloat heightMapTracing(vec3 ori, vec3 dir, out vec3 p) {\n\tfloat tm = 0.0;\n\tfloat tx = 1000.0;    \n    float hx = map(ori + dir * tx);\n\tif(hx > 0.0) return tx;\n    float hm = map(ori + dir * tm);    \n    float tmid = 0.0;\n    for(int i = 0; i < NUM_STEPS; i++) {\n        tmid = mix(tm,tx, hm/(hm-hx));\n        p = ori + dir * tmid;                   \n    \tfloat hmid = map(p);\n\t\tif(hmid < 0.0) {\n        \ttx = tmid;\n            hx = hmid;\n        } else {\n            tm = tmid;\n            hm = hmid;\n        }\n    }\n    return tmid;\n}\n\nvoid mainImage( out vec4 fragColor, in vec2 fragCoord ) {\n\tvec2 uv = fragCoord.xy / iResolution.xy;\n    uv = uv * 2.0 - 1.0;\n    uv.x *= iResolution.x / iResolution.y;\n    float time = iTime * 0.3 + iMouse.x*0.01;\n        \n    vec3 ang = vec3(0, 0.2, 0);\n    vec3 ori = vec3(0, 3.5, -4.5);\n    vec3 dir = normalize(vec3(uv.xy,-2.0)); dir.z += length(uv) * 0.15;\n    dir = fromEuler(ang) * dir;\n    \n\tvec3 p;\n    heightMapTracing(ori,dir,p);\n    vec3 dist = p - ori;\n    vec3 n = getNormal(p, dot(dist,dist) * EPSILON_NRM);\n    vec3 light = normalize(vec3(0.0,1.0,0.8));\n             \n    vec3 color = mix(getSkyColor(dir), getSeaColor(p,n,light,dir,dist), pow(smoothstep(0.0,-0.05,dir.y),0.3));\n        \n\tfragColor = vec4(pow(color,vec3(0.75)), 1.0);\n}`,
        presetBg3: `const float cloudscale = 1.1;\nconst float speed = 0.03;\nconst float clouddark = 0.5;\nconst float cloudlight = 0.3;\nconst float cloudcover = 0.2;\nconst float cloudalpha = 8.0;\nconst float skytint = 0.5;\nconst vec3 skycolour1 = vec3(0.2, 0.4, 0.6);\nconst vec3 skycolour2 = vec3(0.4, 0.7, 1.0);\n\nconst mat2 m = mat2( 1.6,  1.2, -1.2,  1.6 );\n\nvec2 hash( vec2 p )\n{\n\tp = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)));\n\treturn -1.0 + 2.0*fract(sin(p)*43758.5453123);\n}\n\nfloat noise( in vec2 p )\n{\n    const float K1 = 0.366025404;\n    const float K2 = 0.211324865;\n\tvec2 i = floor(p + (p.x+p.y)*K1);\t\n    vec2 a = p - i + (i.x+i.y)*K2;\n    vec2 o = (a.x>a.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);\n    vec2 b = a - o + K2;\n\tvec2 c = a - 1.0 + 2.0*K2;\n    vec3 h = max(0.5-vec3(dot(a,a), dot(b,b), dot(c,c) ), 0.0 );\n\tvec3 n = h*h*h*h*vec3( dot(a,hash(i+0.0)), dot(b,hash(i+o)), dot(c,hash(i+1.0)));\n    return dot(n, vec3(70.0));\t\n}\n\nfloat fbm(vec2 n) {\n\tfloat total = 0.0, amplitude = 0.1;\n\tfor (int i = 0; i < 7; i++) {\n\t\ttotal += noise(n) * amplitude;\n\t\tn = m * n;\n\t\tamplitude *= 0.4;\n\t}\n\treturn total;\n}\n\nvoid mainImage( out vec4 fragColor, in vec2 fragCoord ) {\n    vec2 p = fragCoord.xy / iResolution.xy;\n\tvec2 uv = p*vec2(iResolution.x/iResolution.y,1.0);\n    float time = iTime * speed;\n    float r = 0.0;\n\tuv *= cloudscale;\n    float q = fbm(uv * cloudscale);\n    float f = fbm(uv+q +time);\n    r = fbm(uv+f+vec2(1.2,1.2)+time);\n    float c = fbm(uv+r-time);\n    vec3 cloudcolour = vec3(0.0);\n    cloudcolour = mix(skycolour1, skycolour2, max(0.0,q)*skytint );\n    cloudcolour = mix(cloudcolour, vec3(1.0), min(max(r,0.0),1.0)*cloudlight); \n    cloudcolour = mix(cloudcolour, vec3(0.0), min(max(c,0.0),1.0)*clouddark); \n\tfloat cloudfinal = r + c;\n\tcloudcolour = mix(skycolour2, cloudcolour, smoothstep(0.0,1.0,cloudfinal));\n    fragColor = vec4(cloudcolour, 1.0);\n}`,
        'presetBg4': `// From https://www.shadertoy.com/view/4tVXRV\n#define TAU 6.283184\n\nfloat cos01(float x) { return (cos(x)+1.0)*0.5; }\n\nfloat arc(float r, vec2 uv, float orientation, float radius, float section)\n{\n    uv = mat2(cos(orientation), -sin(orientation), sin(orientation), cos(orientation)) * uv;\n    float theta = atan(uv.x, uv.y) / TAU;\n    float angularSharpness = 20.0 * section;\n    float distanceFromRadius = abs(r - radius);\n    float falloffRadius = 0.01;\n    float radialIntensity = pow(max(0.0, 1.0 - (distanceFromRadius / falloffRadius)), 2.0);\n    float angularIntensity = pow(0.001 / abs(theta / angularSharpness), angularSharpness / 1.0);\n    return min(radialIntensity, 1.0) * min(angularIntensity, 1.0);\n}\n\nfloat radial(float r, vec2 uv, float orientation, float radius, float section)\n{\n    uv = mat2(cos(orientation), -sin(orientation), sin(orientation), cos(orientation)) * uv;\n    float theta = atan(uv.x, uv.y)/TAU;\n    float t = 100. * section;\n    return min(1.0, 0.00025 / abs(theta)) * min(1.0, pow(0.005 / abs((r - radius) / t),t / 2.));\n}\n\nvoid mainImage( out vec4 fragColor, in vec2 fragCoord )\n{\n    float bars = 48.0;\n    vec2 uv = (2.0*fragCoord-iResolution.xy)/iResolution.y;\n    uv -= 0.5;\n    \n    float r = length(uv);\n    float value = 0.;\n    float amplitude = iAudioLow * 2.0;\n    \n    for(float i=1.;i<bars;i+=1.)\n    {\n        float fSample = sin(float(i)/bars * TAU * 4.0 + iTime*2.0) * iAudioLow * 0.5 + iAudioMid * 0.3;\n        fSample = abs(fSample);\n\n        float radius = 0.1+0.001*amplitude+0.2*fSample;\n        float orientation = 0.5*TAU+float(i)/(bars)*TAU;\n        float ringsection = 0.15*fSample; \n        value += arc(r, uv, orientation, radius, ringsection);\n        \n        float raysection = 0.15*fSample;\n        value += radial(r, uv, orientation, radius, raysection);    \n    }\n    \n    vec3 color = vec3(cos01(iTime),cos01(2.0*iTime+1.0),cos01(3.0*iTime+2.0));\n    fragColor = vec4(vec3(0.0), 1.0);\n    fragColor += vec4(color * value, 1.0);\n}`,
        'presetBg5': `// From https://www.shadertoy.com/view/MddGzf\nvoid mainImage( out vec4 fragColor, in vec2 fragCoord )\n{\n    vec2 uv = fragCoord/iResolution.xy;\n    vec3 col = 0.5 + 0.5*cos(iTime+uv.xyx+vec3(0,2,4));\n    col *= 0.5 + 0.5 * iAudioLow;\n    fragColor = vec4(col,1.0);\n}`,
        'presetBg6': `// Simple audio visualizer\nvoid mainImage( out vec4 fragColor, in vec2 fragCoord )\n{\n    vec2 uv = fragCoord.xy / iResolution.xy;\n    float audio = iAudioLow * 0.5 + iAudioMid * 0.3 + iAudioHigh * 0.2;\n    vec3 color = vec3(audio, uv.x * audio, uv.y * audio);\n    fragColor = vec4(color, 1.0);\n}`
    },
    vizSettings: {},

    UIManager: UIManager,
    ButterchurnManager: ButterchurnManager,
    AudioProcessor: AudioProcessor,
    CameraManager: CameraManager,
    ShaderManager: ShaderManager,
    SceneManager: SceneManager,
    BackgroundManager: BackgroundManager,
    ImagePlaneManager: ImagePlaneManager,
    ModelManager: ModelManager,
    ComputeManager: ComputeManager,
    GPGPUDebugger: GPGPUDebugger,

    defaultVisualizerSettings: {
        activeControl: 'landscape',
        landscapeAutopilotOn: false,
        modelAutopilotOn: false,
        activeLandscapePreset: null,
        activeModelPreset: null,
        manualLandscapePosition: new THREE.Vector3(0, 0, -5),
        manualModelPosition: new THREE.Vector3(0, 5, 5),
        landscapeScale: 1.0,
        modelScale: 1.0,
        landscapeAutopilotSpeed: 1.0,
        modelAutopilotSpeed: 1.0,
        enableModel: true,
        enableModelSpin: false,
        modelSpinSpeed: 0.0,
        enableModelDistancePlus: false,
        enableModelDistanceMinus: false,
        enableLandscape: true,
        enableLandscapeSpin: false,
        landscapeSpinSpeed: 0.0,
        planeAspectRatio: '1.0',
        planeOrientation: 'xy',
        deformationStrength: 1.5,
        backgroundMode: 'shader', 
        shaderToyGLSL: "",
        enableShaderMouse: false,
        shaderAudioLink: false,
        shaderAudioSource: 'lows',
        shaderAudioStrength: 1.0,
        shaderAudioSmoothing: 0.5,
        butterchurnSpeed: 1, butterchurnAudioInfluence: 1.0, butterchurnBlendTime: 5.0,
        butterchurnTintColor: '#ffffff', butterchurnOpacity: 1.0,
        butterchurnEnableCycle: false, butterchurnCycleTime: 15,
        audioSmoothing: 0.8,
        testToneMode: 'dynamicPulse',
        metalness: 1.0,
        roughness: 0.10,
        enablePBRColor: true,
        toneMappingMode: 'Reinhard',
        toneMappingExposure: 1.0,
        enableReflections: true,
        reflectionStrength: 1.0,
        lightColor: "#ffffff",
        ambientLightColor: "#ffffff",
        lightDirectionX: 0.5, lightDirectionY: 0.8, lightDirectionZ: 0.5,
        enableLightOrbit: true, lightOrbitSpeed: 0.2, enableGuideLaser: false,
        enableGPGPUDebugger: true, 
    },

    async preloadDevAssets() {
        console.log("Attempting to preload developer assets...");
        try {
            const audioPath = '/WH21 #9 42825-music.mp3';
            const audioResponse = await fetch(audioPath);
            if (!audioResponse.ok) throw new Error(`HTTP error! Status: ${audioResponse.status}`);
            const audioBlob = await audioResponse.blob();
            const audioFile = new File([audioBlob], audioPath.split('/').pop(), { type: 'audio/mpeg' });
            this.AudioProcessor.loadAudioFile(audioFile);
            this.UIManager.updateFileNameDisplay('audio', audioPath.split('/').pop());
            console.log(`Preloaded ${audioPath} successfully.`);
        } catch (error) {
            console.warn(`Could not preload development audio: ${error.message}. App will start without it.`);
            if (this.UIManager) this.UIManager.logError(`Dev audio preload failed: ${error.message.substring(0, 100)}...`);
        }
        try {
            const imageResponse = await fetch('/Devmedia/Devimage.jpeg');
            if (!imageResponse.ok) throw new Error(`HTTP error! Status: ${imageResponse.status}`);
            const imageBlob = await imageResponse.blob();
            const imageFile = new File([imageBlob], 'Devimage.jpeg', { type: 'image/jpeg' });
            this.ImagePlaneManager.loadTexture(imageFile);
            this.UIManager.updateFileNameDisplay('image', 'Devimage.jpeg');
            console.log("Preloaded Devimage.jpeg successfully.");
        } catch (error) {
            console.warn(`Could not preload Devimage.jpeg: ${error.message}. App will start without it.`);
            if (this.UIManager) this.UIManager.logError(`Devimage.jpeg preload failed: ${error.message.substring(0, 100)}...`);
        }
    },

    init() {
        this.vizSettings = JSON.parse(JSON.stringify(this.defaultVisualizerSettings));
        this.vizSettings.manualLandscapePosition = new THREE.Vector3().copy(this.defaultVisualizerSettings.manualLandscapePosition);
        this.vizSettings.manualModelPosition = new THREE.Vector3().copy(this.defaultVisualizerSettings.manualModelPosition);
        
        window.onerror = (message, source, lineno, colno, error) => {
            console.error("Uncaught Error (Global Handler):", message, source, lineno, colno, error);
            const displayMessage = `Runtime Error: ${message.toString().substring(0, 150)}...`;
            if (this.UIManager) this.UIManager.logError(displayMessage);
            return true; 
        };

        window.onunhandledrejection = (event) => {
            console.error("Unhandled Promise Rejection (Global Handler):", event.reason);
            const displayMessage = `Promise Error: ${event.reason.message || event.reason.toString().substring(0, 150)}...`;
            if (this.UIManager) this.UIManager.logError(displayMessage);
            event.preventDefault(); 
        };

        this.renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('glCanvas'), antialias: true, powerPreference: "high-performance" });
        this.renderer.setPixelRatio(window.devicePixelRatio); this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.autoClear = false;
        const toneMappingOptions = { 'ACESFilmic': THREE.ACESFilmicToneMapping, 'Reinhard': THREE.ReinhardToneMapping, 'Linear': THREE.LinearToneMapping };
        this.renderer.toneMapping = toneMappingOptions[this.vizSettings.toneMappingMode] || THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = this.vizSettings.toneMappingExposure;

        const planeWidth = 20;
        const planeHeight = 20;
        const planeResX = 128;
        const planeResY = 128;

        this.SceneManager.init(this);
        this.CameraManager.init(this);
        this.AudioProcessor.init(this);
        this.ComputeManager.init(this, planeWidth, planeHeight, planeResX, planeResY);
        this.ImagePlaneManager.init(this, planeWidth, planeHeight, planeResX, planeResY);
        this.BackgroundManager.init(this);
        this.ModelManager.init(this);
        this.ButterchurnManager.init(this);
        this.ShaderManager.init(this);
        this.GPGPUDebugger.init(this);
        
        this.UIManager.init(this);

        
        setTimeout(() => {
            this.preloadDevAssets();
            
            const defaultShaderCode = this.shaderPresets['presetBg1'];
            if (this.vizSettings.backgroundMode === 'shader' && defaultShaderCode) {
                console.log("Loading default background shader preset...");
                const shaderToyGLSLEl = document.getElementById('shaderToyGLSL');
                if (shaderToyGLSLEl) {
                    shaderToyGLSLEl.value = defaultShaderCode;
                    this.vizSettings.shaderToyGLSL = defaultShaderCode;
                    if (this.ShaderManager) {
                        setTimeout(() => this.ShaderManager.loadUserShader(), 100); 
                    }
                }
            }

            console.log("Loading default 3D model preset...");
            const modelPreset = this.modelPresets['modelPreset3'];
            if (modelPreset && this.ModelManager) {
                this.ModelManager.loadGLTFModel(modelPreset.path);
                if (this.UIManager) this.UIManager.updateFileNameDisplay('gltf', modelPreset.name);
            }
        }, 100);


        window.addEventListener('resize', this.onWindowResize.bind(this));
        
        window.addEventListener('mousemove', (event) => {
            if (!this.vizSettings.enableShaderMouse) return;
            this.mouseState.x = event.clientX;
            this.mouseState.y = event.clientY;
        });
        window.addEventListener('mousedown', () => {
            if (!this.vizSettings.enableShaderMouse) return;
            this.mouseState.z = 1;
        });
        window.addEventListener('mouseup', () => {
            if (!this.vizSettings.enableShaderMouse) return;
            this.mouseState.z = 0;
        });
        
        this.animate();
    },

    switchActiveControl(newControlTarget) {
        if (this.vizSettings.activeControl === newControlTarget) return;
        const oldTarget = this.vizSettings.activeControl;
        if (oldTarget === 'landscape') this.ImagePlaneManager.returnToHome();
        else if (oldTarget === 'model') this.ModelManager.returnToHome();
        this.vizSettings.activeControl = newControlTarget;
        this.UIManager.updateMasterControls();
    },

    onWindowResize() {
        if (!this.camera || !this.renderer) return;
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.BackgroundManager.onWindowResize(); 
        if (this.UIManager && this.UIManager.eqCanvas) this.UIManager.setupEQCanvas();
    },

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        const delta = this.clock.getDelta();
        const cappedDelta = Math.min(delta, 1 / 30); 
        this.currentTime = this.clock.getElapsedTime(); 
        this.frame++;
        
        const S = this.vizSettings;
        
        this.AudioProcessor.updateAudioData();
        this.ComputeManager.update(cappedDelta);
        if(this.animationMixer) this.animationMixer.update(cappedDelta);
        
        this.ImagePlaneManager.update(cappedDelta);
        this.ModelManager.update(cappedDelta);
        
        let lookAtTargetPosition;
        if (S.activeControl === 'landscape') {
            lookAtTargetPosition = this.ImagePlaneManager.landscape ? this.ImagePlaneManager.landscape.position : new THREE.Vector3();
        } else {
            lookAtTargetPosition = this.ModelManager.gltfModel ? this.ModelManager.gltfModel.position : new THREE.Vector3();
        }
        this.CameraManager.setLookAt(lookAtTargetPosition);
        this.CameraManager.update(cappedDelta); 
        this.SceneManager.update(cappedDelta);
        
        this.BackgroundManager.update();
        
        this.renderer.clear();
        this.BackgroundManager.render();
        this.renderer.clearDepth();
        this.renderer.render(this.scene, this.camera);
        
        this.GPGPUDebugger.render();
    }
};

const attemptToStartApp = () => {
    if (document.getElementById('controlsPanel')) {
        console.log("DOM is ready. Initializing App.");
        App.init();
    } else {
        console.warn("DOM not ready yet, retrying in 10ms...");
        setTimeout(attemptToStartApp, 10);
    }
};

attemptToStartApp();