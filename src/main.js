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
    dragState: {
        isDragging: false,
        targetObject: null,
        plane: new THREE.Plane(),
        offset: new THREE.Vector3(),
        intersection: new THREE.Vector3(),
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

    defaultVisualizerSettings: {
        // Master Controls
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

        // Landscape-Specific
        enableLandscape: true,
        enableLandscapeSpin: false,
        landscapeSpinSpeed: 0.0,
        planeAspectRatio: '1.0',
        planeOrientation: 'xy',
        deformationStrength: 1.5,
        
        enablePeel: false,
        peelAmount: 0.2,
        peelCurl: 0.4,
        peelAnimationStyle: 1,
        peelDrift: 0.05,
        peelTextureAmount: 0.0,
        peelAudioSource: 'onBeat',
        
        warpMode: 'none',
        sagAmount: 2.0,
        sagFalloffSharpness: 1.5,
        sagAudioMod: 0.2,

        droopAmount: 0.3,
        droopAudioMod: 1.0,
        droopFalloffSharpness: 2.5,
        droopSupportedWidthFactor: 0.6,
        droopSupportedDepthFactor: 0.5,

        cylinderRadius: 5.0,
        cylinderHeightScale: 1.0,
        cylinderAxisAlignment: "y",
        cylinderArcAngle: 360,
        cylinderArcOffset: 0,

        bendAngle: 0.0,
        bendAudioMod: 0.0,
        bendFalloffSharpness: 1.0,
        bendAxis: 'primary',
        
        foldAngle: 0.0,
        foldDepth: 0.2,
        foldRoundness: 0.0,
        foldAudioMod: 0.0,
        foldNudge: 0.0,
        enableFoldCrease: false,
        foldCreaseDepth: -0.15,
        foldCreaseSharpness: 3.0,
        enableFoldTuck: false,
        foldTuckAmount: 0.0,
        foldTuckReach: 0.15,

        // Background
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
        
        // Audio
        audioSmoothing: 0.8,
        testToneMode: 'dynamicPulse',

        // Material & Lighting
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
        
        // GPGPU Debug
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

        const canvas = document.getElementById('glCanvas');
        window.addEventListener('resize', this.onWindowResize.bind(this));
        
        canvas.addEventListener('mousemove', (event) => {
            if (this.dragState.isDragging) return;
            if (!this.vizSettings.enableShaderMouse) return;
            this.mouseState.x = event.clientX;
            this.mouseState.y = event.clientY;
        });
        canvas.addEventListener('mousedown', () => {
             if (this.dragState.isDragging) return;
             if (!this.vizSettings.enableShaderMouse) return;
             this.mouseState.z = 1;
        });
        canvas.addEventListener('mouseup', () => {
            this.mouseState.z = 0;
        });
        
        canvas.addEventListener('pointerdown', this.onPointerDown.bind(this));
        canvas.addEventListener('pointermove', this.onPointerMove.bind(this));
        canvas.addEventListener('pointerup', this.onPointerUp.bind(this));

        this.animate();
    },

    onPointerDown(event) {
        if (!this.vizSettings.enableShaderMouse) return;
        if (this.vizSettings.landscapeAutopilotOn || this.vizSettings.modelAutopilotOn) return;

        const S = this.vizSettings;
        const DS = this.dragState;

        const mouse = new THREE.Vector2(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1
        );
        this.raycaster.setFromCamera(mouse, this.camera);
        
        let intersects;
        if (S.activeControl === 'landscape' && this.ImagePlaneManager.landscape) {
             intersects = this.raycaster.intersectObject(this.ImagePlaneManager.landscape);
             if (intersects.length > 0) DS.targetObject = this.ImagePlaneManager.landscape;
        } else if (S.activeControl === 'model' && this.ModelManager.gltfModel) {
            intersects = this.raycaster.intersectObject(this.ModelManager.gltfModel, true);
            if (intersects.length > 0) DS.targetObject = this.ModelManager.gltfModel;
        } else {
            return;
        }
        
        if (intersects.length > 0 && DS.targetObject) {
            DS.isDragging = true;
            DS.plane.setFromNormalAndCoplanarPoint(this.camera.getWorldDirection(DS.plane.normal), intersects[0].point);
            DS.offset.copy(intersects[0].point).sub(DS.targetObject.position);
        }
    },
    
    onPointerMove(event) {
        if (!this.dragState.isDragging) return;

        const mouse = new THREE.Vector2(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1
        );
        this.raycaster.setFromCamera(mouse, this.camera);

        if (this.raycaster.ray.intersectPlane(this.dragState.plane, this.dragState.intersection)) {
            const newPos = this.dragState.intersection.sub(this.dragState.offset);
            
            if (this.vizSettings.activeControl === 'landscape') {
                this.vizSettings.manualLandscapePosition.copy(newPos);
            } else if (this.vizSettings.activeControl === 'model') {
                this.vizSettings.manualModelPosition.copy(newPos);
            }
            this.UIManager.syncManualSliders();
        }
    },

    onPointerUp(event) {
        this.dragState.isDragging = false;
        this.dragState.targetObject = null;
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
        if(this.animationMixer) this.animationMixer.update(cappedDelta);
        
        this.ImagePlaneManager.update(cappedDelta);
        this.ModelManager.update(cappedDelta);
        
        // ** THE FIX IS HERE **
        let lookAtTargetPosition;
        if (S.activeControl === 'landscape') {
            // If dragging, look directly at the target position. Otherwise, use the object's current position.
            lookAtTargetPosition = this.dragState.isDragging ? S.manualLandscapePosition : (this.ImagePlaneManager.landscape ? this.ImagePlaneManager.landscape.position : new THREE.Vector3());
        } else {
            lookAtTargetPosition = this.dragState.isDragging ? S.manualModelPosition : (this.ModelManager.gltfModel ? this.ModelManager.gltfModel.position : new THREE.Vector3());
        }
        this.CameraManager.setLookAt(lookAtTargetPosition);
        this.CameraManager.update(cappedDelta); 
        
        this.SceneManager.update(cappedDelta);
        this.BackgroundManager.update();
        this.GPGPUDebugger.update();

        if (this.vizSettings.backgroundMode === 'greenscreen') {
            this.renderer.setClearColor('#00ff00');
        } else {
            this.renderer.setClearColor('#000000');
        }
        
        this.renderer.clear(true, true);

        this.BackgroundManager.render();
        
        this.renderer.clearDepth();

        this.renderer.render(this.scene, this.camera);
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