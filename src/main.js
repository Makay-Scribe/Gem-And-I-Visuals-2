import './style.css';
import * as THREE from 'three';
import { UIManager } from './modules/UIManager.js';
import { ButterchurnManager } from './modules/ButterchurnManager.js';
import { Debugger } from './modules/Debugger.js';
import { shaderPresets } from './modules/shaderPresets.js';
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
    raycaster: new THREE.Raycaster(),

    // NEW: State for unlocking media
    mediaUnlocked: false,

    mouseInteraction: {
        isDragging: false,
        isRotating: false,
        startMouse: new THREE.Vector2(),
        rotationSpeed: 0.005,
        panSpeed: 0.05,
        zoomSpeed: 0.5,
    },

    modelPresets: {
        'modelPreset1': { name: 'Dancing Planet', path: '/3dmodel/converted/Dancing planet.glb' },
        'modelPreset2': { name: 'Swimming Shark', path: '/3dmodel/converted/Swimming shark.glb' },
        'modelPreset3': { name: 'Flying Pterodactyl', path: '/3dmodel/converted/Flying pterodactyl.glb' },
        'modelPreset4': { name: 'School of Fish', path: '/3dmodel/converted/School of fish.glb' },
        'modelPreset5': { name: 'Walking Astronaut', path: '/3dmodel/converted/Walking astronaut.glb' },
        'modelPreset6': { name: 'Banana Gun', path: '/3dmodel/converted/Banana Gun with Scope.glb' },
        'modelPreset7': { name: 'Dancing Planet', path: '/3dmodel/converted/Dancing planet.glb' },
        'modelPreset8': { name: 'Swimming Shark', path: '/3dmodel/converted/Swimming shark.glb' },
        'modelPreset9': { name: 'Flying Pterodactyl', path: '/3dmodel/converted/Flying pterodactyl.glb' },
        'modelPreset10': { name: 'School of Fish', path: '/3dmodel/converted/School of fish.glb' },
        'modelPreset11': { name: 'Walking Astronaut', path: '/3dmodel/converted/Walking astronaut.glb' },
        'modelPreset12': { name: 'Banana Gun', path: '/3dmodel/converted/Banana Gun with Scope.glb' },
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
    shaderPresets: shaderPresets,
    vizSettings: {},

    // --- MANAGERS ---
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
    Debugger: Debugger,

    defaultVisualizerSettings: {
        activeControl: 'landscape',
        landscapeAutopilotOn: false,
        modelAutopilotOn: false,
        activeLandscapePreset: null,
        activeModelPreset: null,
        homePositionLandscape: new THREE.Vector3(0, 0, 0),
        homePositionModel: new THREE.Vector3(0, -5, 30),
        landscapeScale: 1.0,
        modelScale: 1.0,
        landscapeAutopilotSpeed: 1.0,
        modelAutopilotSpeed: 1.0,
        enableModel: true,
        enableModelSpin: false,
        modelSpinSpeed: 0.0,
        enableCollisionAvoidance: false, 
        enableLandscape: true,
        enableLandscapeSpin: false,
        landscapeSpinSpeed: 0.0,
        planeAspectRatio: '1.0',
        planeOrientation: 'xy',
        deformationStrength: 1.5,
        morphMix: 0.0,
        morphDuration: 8.0,
        morphTargetSelect: 'flat',
        clothStiffness: 0.8,
        clothDamping: 0.05,
        clothGravity: 9.8,
        clothAudioWind: 0.0,
        paintEnable: false,
        paintSplatStrength: 1.0,
        paintFadeSpeed: 0.5,
        fxLabCodeEditor: `// Example: Sine wave based on Y position and time
vec3 userDeformation(vec3 initialPos, vec2 uv, float time, sampler2D audioTexture) {
    vec3 p = initialPos;
    p.z += sin(p.y * 0.5 + time) * 2.0;
    return p;
}`,
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
            const audioPath = '/Devmedia/Devaudio.mp3';
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
            const videoPath = '/Devmedia/Devvideo.mp4';
            const videoResponse = await fetch(videoPath);
            if (!videoResponse.ok) throw new Error(`HTTP error! Status: ${videoResponse.status}`);
            const videoBlob = await videoResponse.blob();
            const videoFile = new File([videoBlob], 'Devvideo.mp4', { type: 'video/mp4' });
            this.ImagePlaneManager.loadTexture(videoFile);
            this.UIManager.updateFileNameDisplay('video', 'Devvideo.mp4');
            console.log("Preloaded Devvideo.mp4 successfully.");
        } catch (error) {
            console.warn(`Could not preload Devvideo.mp4: ${error.message}. App will start without it.`);
            if (this.UIManager) this.UIManager.logError(`Devvideo.mp4 preload failed: ${error.message.substring(0, 100)}...`);
        }
    },

    init() {
        this.vizSettings = JSON.parse(JSON.stringify(this.defaultVisualizerSettings));
        
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

        this.SceneManager.init(this);
        this.CameraManager.init(this);
        this.AudioProcessor.init(this);
        this.ImagePlaneManager.init(this);
        this.BackgroundManager.init(this);
        this.ModelManager.init(this);
        this.ButterchurnManager.init(this);
        this.ShaderManager.init(this);
        this.UIManager.init(this);
        this.GPGPUDebugger.init(this);
        this.Debugger.init(this);
        
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

        // **THE FIX IS HERE**
        // Add a one-time event listener to unlock media on the first click.
        const unlockMedia = () => {
            if (this.mediaUnlocked) return;
            console.log("User gesture detected. Unlocking media playback.");
            this.mediaUnlocked = true;
            this.AudioProcessor.unlockMedia();
            document.body.removeEventListener('click', unlockMedia);
            document.body.removeEventListener('keydown', unlockMedia);
        };
        document.body.addEventListener('click', unlockMedia, { once: true });
        document.body.addEventListener('keydown', unlockMedia, { once: true });

        const canvas = document.getElementById('glCanvas');
        window.addEventListener('resize', this.onWindowResize.bind(this));
        
        canvas.addEventListener('mousemove', (event) => {
            if (this.vizSettings.enableShaderMouse && this.vizSettings.backgroundMode === 'shader') {
                this.mouseState.x = event.clientX;
                this.mouseState.y = event.clientY;
            }
        });
        canvas.addEventListener('mousedown', (event) => {
             if (event.target !== canvas) return;
             if (this.vizSettings.enableShaderMouse && this.vizSettings.backgroundMode === 'shader') {
                this.mouseState.z = 1;
             }
        });
        canvas.addEventListener('mouseup', () => {
            this.mouseState.z = 0;
        });
        
        canvas.addEventListener('pointerdown', this.onPointerDown.bind(this));
        canvas.addEventListener('pointermove', this.onPointerMove.bind(this));
        canvas.addEventListener('pointerup', this.onPointerUp.bind(this));
        
        canvas.addEventListener('wheel', this.onMouseWheel.bind(this), { passive: false });

        canvas.addEventListener('contextmenu', e => e.preventDefault());

        this.animate();
    },

    _getActiveManager() {
        if (this.vizSettings.activeControl === 'landscape') {
            return this.ImagePlaneManager;
        } else if (this.vizSettings.activeControl === 'model') {
            return this.ModelManager;
        }
        return null;
    },
    
    onMouseWheel(event) {
        event.preventDefault();
        const activeManager = this._getActiveManager();
        if (!activeManager || !activeManager.state) return;
        
        const delta = -Math.sign(event.deltaY);
        activeManager.state.targetPosition.z += delta * this.mouseInteraction.zoomSpeed;
    },

    onPointerDown(event) {
        const MI = this.mouseInteraction;
        const activeManager = this._getActiveManager();
        if (!activeManager || !activeManager.state) return;
        
        activeManager.state.isUnderManualControl = true;

        if (event.button === 0) {
            MI.isRotating = true;
        } else if (event.button === 2) {
            event.preventDefault();
            MI.isDragging = true;
        }
        MI.startMouse.set(event.clientX, event.clientY);
    },
    
    onPointerMove(event) {
        const MI = this.mouseInteraction;
        const activeManager = this._getActiveManager();
        if (!activeManager || !activeManager.state) return;
        
        if (!MI.isDragging && !MI.isRotating) return; 

        if (MI.isDragging) {
            const deltaX = event.clientX - MI.startMouse.x;
            const deltaY = event.clientY - MI.startMouse.y;
            
            const distanceFactor = Math.abs(activeManager.state.targetPosition.z / 100) + 0.1;

            activeManager.state.targetPosition.x += deltaX * MI.panSpeed * distanceFactor;
            activeManager.state.targetPosition.y -= deltaY * MI.panSpeed * distanceFactor;

            MI.startMouse.set(event.clientX, event.clientY);
        } else if (MI.isRotating) {
            const deltaX = event.clientX - MI.startMouse.x;
            const deltaY = event.clientY - MI.startMouse.y;

            const targetEuler = new THREE.Euler().setFromQuaternion(activeManager.state.targetQuaternion, 'YXZ');
            targetEuler.y += deltaX * MI.rotationSpeed;
            targetEuler.x += deltaY * MI.rotationSpeed;
            targetEuler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, targetEuler.x));
            activeManager.state.targetQuaternion.setFromEuler(targetEuler);

            MI.startMouse.set(event.clientX, event.clientY);
        }
    },

    onPointerUp(event) {
        const MI = this.mouseInteraction;
        if (this.ImagePlaneManager.state) this.ImagePlaneManager.state.isUnderManualControl = false;
        if (this.ModelManager.state) this.ModelManager.state.isUnderManualControl = false;

        MI.isRotating = false;
        MI.isDragging = false;
    },
    
    onWindowResize() {
        if (!this.camera || !this.renderer) return;
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.BackgroundManager.onWindowResize(); 
        if (this.GPGPUDebugger && this.GPGPUDebugger.onWindowResize) this.GPGPUDebugger.onWindowResize();
        if (this.UIManager && this.UIManager.eqCanvas) this.UIManager.setupEQCanvas();
    },

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        const delta = this.clock.getDelta();
        const cappedDelta = Math.min(delta, 1 / 30); 
        this.currentTime = this.clock.getElapsedTime(); 
        this.frame++;
        
        this.AudioProcessor.updateAudioData();
        
        // ** THE FIX IS HERE **
        // The GPGPU simulation must be updated every frame to calculate physics and effects.
        this.ComputeManager.update(cappedDelta);
        
        if(this.animationMixer) this.animationMixer.update(cappedDelta);
        
        this.ImagePlaneManager.update(cappedDelta);
        this.ModelManager.update(cappedDelta);
        
        this.CameraManager.update(cappedDelta); 
        
        this.SceneManager.update(cappedDelta);
        this.BackgroundManager.update();
        this.GPGPUDebugger.update();
        this.Debugger.update();

        this.UIManager.syncManualSlidersFromState();

        if (this.vizSettings.backgroundMode === 'greenscreen') {
            this.renderer.setClearColor('#00ff00');
        } else {
            this.renderer.setClearColor('#000000');
        }
        
        this.renderer.clear(true, true);
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