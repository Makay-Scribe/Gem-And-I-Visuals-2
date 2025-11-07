import './style.css';
import THREE from './three-singleton.js';
import { UIManager } from './modules/UIManager.js';
import { ButterchurnManager } from './modules/ButterchurnManager.js';
import { Debugger } from './modules/Debugger.js';
import { shaderPresets } from './modules/shaderPresets.js';
import { AudioProcessor } from './modules/AudioProcessor.js';
import { CameraManager } from './modules/CameraManager.js';
import { SceneManager } from './modules/SceneManager.js';
import { BackgroundManager } from './modules/BackgroundManager.js';
import { ImagePlaneManager } from './modules/ImagePlaneManager.js';
import { ModelManager } from './modules/ModelManager.js';
import { ComputeManager } from './compute/ComputeManager.js';
import { GPGPUDebugger } from './modules/GPGPUDebugger.js';
import { CubeWallManager } from './modules/CubeWallManager.js';
import { DirectorManager } from './modules/DirectorManager.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ParticleTransitions } from './modules/ParticleTransitions.js';
import { FluidSimulationContainer } from './compute/FluidSimulationContainer.js';
import { FluidDirector } from './compute/FluidDirector.js';


const App = {
    THREE: THREE, 
    renderer: null, camera: null, scene: null, 
    gltfModel: null, animationMixer: null,
    raycaster: new THREE.Raycaster(),

    mouseInteraction: {
        isDragging: false,
        isRotating: false,
        startMouse: new THREE.Vector2(),
        rotationSpeed: 0.005,
        panSpeed: 0.15,
        zoomSpeed: 0.5,
    },

    modelPresets: {
        'modelPreset1': { id: 'modelPreset1', name: 'Banana Gun', path: '/3dmodel/converted/Banana Gun with Scope.glb', homeOffset: new THREE.Vector3(0, 0, -10) },
        'modelPreset2': { id: 'modelPreset2', name: 'Bee', path: '/3dmodel/converted/Bee.glb', homeOffset: new THREE.Vector3(0, 0, -10) },
        'modelPreset3': { id: 'modelPreset3', name: 'Dancing Planet', path: '/3dmodel/converted/Dancing planet.glb', homeOffset: new THREE.Vector3(0, 0, -10) },
        'modelPreset4': { id: 'modelPreset4', name: 'Flying Bee', path: '/3dmodel/converted/Flying bee.glb', homeOffset: new THREE.Vector3(0, -1, -10) },
        'modelPreset5': { id: 'modelPreset5', name: 'Flying pterodactyl', path: '/3dmodel/converted/Flying pterodactyl.glb', homeOffset: new THREE.Vector3(0, 0, 0) },
        'modelPreset6': { id: 'modelPreset6', name: 'Martial arts character', path: '/3dmodel/converted/Martial arts character.glb', homeOffset: new THREE.Vector3(0, 0, -10) },
        'modelPreset7': { id: 'modelPreset7', name: 'Retro UFO', path: '/3dmodel/converted/Retro UFO.glb', homeOffset: new THREE.Vector3(0, 0, -10) },
        'modelPreset8': { id: 'modelPreset8', name: 'Rose', path: '/3dmodel/converted/Rose.glb', homeOffset: new THREE.Vector3(0, 0, -10) },
        'modelPreset9': { id: 'modelPreset9', name: 'School of fish', path: '/3dmodel/converted/School of fish.glb', homeOffset: new THREE.Vector3(-5, 0, -10) },
        'modelPreset10': { id: 'modelPreset10', name: 'Steampunk Dirigible', path: '/3dmodel/converted/Steampunk Dirigible with Ship.glb', homeOffset: new THREE.Vector3(3, 0, -10) },
        'modelPreset11': { id: 'modelPreset11', name: 'Swimming shark', path: '/3dmodel/converted/Swimming shark.glb', homeOffset: new THREE.Vector3(0, 0, -10) },
        'modelPreset12': { id: 'modelPreset12', name: 'Walking astronaut', path: '/3dmodel/converted/Walking astronaut.glb', homeOffset: new THREE.Vector3(0, -3, -10) },
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
    isDemoModeActive: false,
    
    // ** NEW FIX TRACKER **
    isDefaultSculptureBaked: false,

    // --- MANAGERS ---
    UIManager: UIManager,
    ButterchurnManager: ButterchurnManager,
    AudioProcessor: AudioProcessor,
    CameraManager: CameraManager,
    SceneManager: SceneManager,
    BackgroundManager: BackgroundManager,
    ImagePlaneManager: ImagePlaneManager,
    ModelManager: ModelManager,
    ComputeManager: ComputeManager,
    GPGPUDebugger: GPGPUDebugger,
    CubeWallManager: CubeWallManager,
    Debugger: Debugger, // ** FIX: Corrected typo from Debugber **
    DirectorManager: DirectorManager,
    ParticleTransitions: ParticleTransitions,
    FluidSimulationContainer: FluidSimulationContainer,
    FluidDirector: FluidDirector,

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
        enableCollisionAvoidance: true, 
        enableLandscape: true,
        enableLandscapeSpin: false,
        landscapeSpinSpeed: 0.0,
        planeAspectRatio: '1.0',
        planeOrientation: 'xy',
        imageEffect_enableBalloon: false,
        imageEffect_pointX: 0.5,
        imageEffect_pointY: 0.5,
        imageEffect_strength: 0.5,
        imageEffect_radius: 0.3,
        imageEffect_audioInfluence: 0.5,
        imageEffect_enableJolt: false,
        imageEffect_joltStrength: 0.1,
        imageEffect_joltSpeed: 10.0,
        imageEffect_joltAudioInfluence: 1.0,
        // --- GPGPU SETTINGS ---
        gpgpuGeometryMode: 'particles',
        gpgpu_enableWaterRipple: false,
        gpgpu_rippleSpeed: 0.5,
        gpgpu_rippleStrength: 1.0,
        gpgpu_rippleFrequency: 15.0,
        gpgpu_enableEqRipple: false,
        gpgpu_eqRippleStrength: 2.0,
        gpgpu_eqRippleSmoothing: 0.5,
        gpgpu_eqRippleBarCount: 64,
        gpgpu_eqRippleBarWidth: 0.8,
        gpgpu_eqRippleRangeStart: 0.0,
        gpgpu_eqRippleRangeEnd: 1.0,
        gpgpu_eqRippleStyle: 'Left',
        gpgpu_enableCloth: false,
        gpgpu_clothDamping: 0.98,
        gpgpu_clothStiffness: 0.8,
        gpgpu_clothAudioForce: 900.0,
        gpgpu_clothForceRadius: 0.3,
        gpgpu_clothIterations: 5,
        gpgpu_clothPinMode: "corners",
        gpgpu_tetherStrength: 82.0,
        gpgpu_ambientWindStrength: 4.0,
        gpgpu_ambientWindSpeed: 0.3,
        gpgpu_ambientWindScale: 2.0,
        gpgpu_directionalWindX: 0.0,
        gpgpu_directionalWindY: 1.6,
        gpgpu_directionalWindZ: 5.8,
        gpgpu_clothBlendTime: 9.6,
        gpgpu_enableFold: false,
        gpgpu_foldAngle: 20,
        gpgpu_foldDepth: 0.38,
        gpgpu_foldRoundness: 0.05,
        gpgpu_foldAudioMod: 31,
        gpgpu_foldNudge: 0.60,
        gpgpu_enableFoldCrease: true,
        gpgpu_foldCreaseDepth: 1.60,
        gpgpu_foldCreaseSharpness: 1.0,
        gpgpu_enableFoldTuck: true,
        gpgpu_foldTuckAmount: -1.0,
        gpgpu_foldTuckReach: 0.40,
        gpgpu_enableCylinder: false,
        gpgpu_cylinderRadius: 5.0,
        gpgpu_cylinderHeightScale: 1.0,
        gpgpu_cylinderAxisAlignment: "y",
        gpgpu_cylinderArcAngle: 360,
        gpgpu_cylinderArcOffset: 0,
        gpgpu_enableSag: false,
        gpgpu_sagAmount: 2.0,
        gpgpu_sagFalloffSharpness: 1.5,
        gpgpu_sagAudioMod: 0.2,
        gpgpu_enableDroop: false,
        gpgpu_droopAmount: 0.3,
        gpgpu_droopAudioMod: 1.0,
        gpgpu_droopFalloffSharpness: 2.5,
        gpgpu_droopSupportedWidthFactor: 0.6,
        gpgpu_droopSupportedDepthFactor: 0.5,
        gpgpu_enablePeel: false,
        gpgpu_peelAmount: 0.59,
        gpgpu_peelCurl: 0.83,
        gpgpu_peelEnableAudio: true,
        gpgpu_peelDrift: 0.09,
        gpgpu_peelTextureAmount: 0.14,
        
        particle_resolution: 512,
        particle_base_size: 3.0,
        particle_min_size: 0.0,
        particle_size_mix: 0.0,
        particle_twinkleIntensity: 0.0,
        particle_flowScale: 0.1,
        particle_flowSpeed: 0.0,
        particle_flowStrength: 0.0,
        particle_attractionStrength: 0.1,
        particle_morphProgress: 0.0, 
        particle_target: 'flat', 
        
        fluid_curlStrength: 0.0,
        fluid_curlScale: 0.05,
        fluid_curlSpeed: 0.3,

        // --- CUBEWALL SETTINGS ---
        gpgpu_cubeWallGridSize: 10,
        playerCube_enabled: true,
        gpgpu_cubeWallMorph: 0.0,
        gpgpu_cubeWallUseImageTexture: true,
        gpgpu_cubeWallSideColor: '#4a586a',
        gpgpu_cubeWallBevelWidth: 0.02,
        gpgpu_cubeWallBevelIntensity: 0.5,
        fluid_gravity: 0.0,
        // --- END GPGPU SETTINGS ---
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
        metalness: 0.0,
        roughness: 1.0,
        enablePBRColor: true,
        toneMappingMode: 'ACESFilmic',
        toneMappingExposure: 1.0,
        enableReflections: true,
        reflectionStrength: 1.0,
        lightColor: "#FF80C0",
        ambientLightColor: "#DBDBDB",
        lightDirectionX: 0.5, lightDirectionY: 0.8, lightDirectionZ: 0.5,
        enableLightOrbit: true, lightOrbitSpeed: 0.2, enableGuideLaser: false,
        enableGPGPUDebugger: true, 
        enableOnScreenDebugger: true,
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

    async preloadDefaultSculpture() {
        console.log("Preloading default sculpture model (/Devmedia/Devmodel.glb)...");
        const loader = new GLTFLoader();
        try {
            const gltf = await loader.loadAsync('/Devmedia/Devmodel.glb');
            let bestMesh = null;
            gltf.scene.traverse(child => { if (child.isMesh) bestMesh = child; });

            if (bestMesh) {
                this.UIManager.particleModelMesh = bestMesh;
                if (bestMesh.material && bestMesh.material.map) {
                    this.UIManager.particleModelTexture = bestMesh.material.map;
                } else {
                    this.UIManager.particleModelTexture = null;
                }
                
                // ** FIX: Perform the bake and explicitly flag success **
                this.ComputeManager.bakeToTexture(bestMesh, this.ComputeManager.particleModelPositionTexture);
                this.isDefaultSculptureBaked = true; // Flag the success
                
                // ** CRITICAL FIX: Tell the Fluid Sim the model is ready and update its uniform **
                this.FluidSimulationContainer.setBakedModelTexture(this.ComputeManager.particleModelPositionTexture);
                
                this.UIManager.logSuccess("Default sculpture baked.");
                this.UIManager.updateFileNameDisplay('particleModel', 'Devmodel.glb (Default)');
            } else {
                throw new Error("No mesh found in Devmodel.glb");
            }
        } catch (error) {
            console.error("Failed to preload and bake default sculpture:", error);
            this.UIManager.logError("Default sculpture /Devmedia/Devmodel.glb failed. 3D Model features disabled until a model is baked.");
        }
    },

    onWindowResize() {
        if (!this.camera || !this.renderer) return;
    
        const canvas = this.renderer.domElement;
        const pixelRatio = window.devicePixelRatio;
    
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
    
        const targetWidth = Math.floor(width * pixelRatio);
        const targetHeight = Math.floor(height * pixelRatio);
    
        if (this.renderer.domElement.width !== targetWidth || this.renderer.domElement.height !== targetHeight) {
            this.renderer.setSize(width, height, false);
        }
    
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    
        this.BackgroundManager.onWindowResize(); 
        if (this.GPGPUDebugger && this.GPGPUDebugger.onWindowResize) this.GPGPUDebugger.onWindowResize();
        if (this.UIManager && this.UIManager.eqCanvas) this.UIManager.setupEQCanvas();
    },

    _getActiveManager() {
        if (this.vizSettings.activeControl === 'landscape') {
            return this.ImagePlaneManager;
        } else if (this.vizSettings.activeControl === 'model') {
            return this.ModelManager;
        }
        return null;
    },
    
    _startManualControlTimeout(activeManager) {
        if (activeManager.state.manualControlTimeoutId) {
            clearTimeout(activeManager.state.manualControlTimeoutId);
        }
        activeManager.state.manualControlTimeoutId = setTimeout(() => {
            if (activeManager.state) {
                activeManager.state.isUnderManualControl = false;
                activeManager.state.manualControlReleaseTime = this.currentTime;
                activeManager.state.manualControlTimeoutId = null;
            }
        }, 250);
    },

    onMouseWheel(event) {
        event.preventDefault();
        const activeManager = this._getActiveManager();
        if (!activeManager || !activeManager.state) return;

        activeManager.state.isUnderManualControl = true;
        const delta = -Math.sign(event.deltaY);
        activeManager.state.targetPosition.z += delta * this.mouseInteraction.zoomSpeed;
        
        this._startManualControlTimeout(activeManager);
    },

    onPointerDown(event) {
        const MI = this.mouseInteraction;
        const activeManager = this._getActiveManager();
        if (!activeManager || !activeManager.state) return;
        
        if (activeManager.state.manualControlTimeoutId) {
            clearTimeout(activeManager.state.manualControlTimeoutId);
            activeManager.state.manualControlTimeoutId = null;
        }

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
        const activeManager = this._getActiveManager();
        
        if (activeManager && activeManager.state.isUnderManualControl) {
            this._startManualControlTimeout(activeManager);
        }

        MI.isRotating = false;
        MI.isDragging = false;
    },

    async init() {
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
        
        this.renderer.autoClear = false;

        const toneMappingOptions = { 'ACESFilmic': THREE.ACESFilmicToneMapping, 'Reinhard': THREE.ReinhardToneMapping, 'Linear': THREE.LinearToneMapping };
        this.renderer.toneMapping = toneMappingOptions[this.vizSettings.toneMappingMode] || THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = this.vizSettings.toneMappingExposure;

        // Phase 1: Initialize all managers (minimal THREE/config dependencies)
        this.SceneManager.init(this);
        this.BackgroundManager.init(this);
        this.CameraManager.init(this);
        this.AudioProcessor.init(this);
        this.ButterchurnManager.init(this);
        this.ModelManager.init(this);
        this.Debugger.init(this);
        this.CubeWallManager.init(this);
        this.DirectorManager.init(this);
        this.ParticleTransitions.init(this);
        this.FluidDirector.init(this);
        this.ImagePlaneManager.init(this); 
        this.FluidSimulationContainer.init(this); 

        this.ComputeManager.init(this, 
            this.ImagePlaneManager.planeDimensions.x, 
            this.ImagePlaneManager.planeDimensions.y, 
            this.ImagePlaneManager.planeResolution.x, 
            this.ImagePlaneManager.planeResolution.y
        );
        this.GPGPUDebugger.init(this);
        this.ComputeManager.initParticleSystem(); // Sets up particle/cube GPGPU environment (before Fluid Sim uses textures)

        this.UIManager.init(this); 
        
        this.ambientLight = new THREE.AmbientLight(this.vizSettings.ambientLightColor, 1.0);
        this.scene.add(this.ambientLight);

        this.directionalLight = new THREE.DirectionalLight(this.vizSettings.lightColor, 1.0);
        this.directionalLight.position.set(
            this.vizSettings.lightDirectionX,
            this.vizSettings.lightDirectionY,
            this.vizSettings.lightDirectionZ
        ).normalize();
        this.scene.add(this.directionalLight);

        const laserMaterial = new THREE.LineBasicMaterial({ color: 0xffff00 });
        const laserPoints = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)];
        const laserGeometry = new THREE.BufferGeometry().setFromPoints(laserPoints);
        this.guideLaser = new THREE.Line(laserGeometry, laserMaterial);
        this.guideLaser.frustumCulled = false;
        this.guideLaser.visible = this.vizSettings.enableGuideLaser;
        this.scene.add(this.guideLaser);


        // Phase 2: Parallel asset loading and waiting
        
        // ** STRUCTURAL FIX: Load audio/image in parallel, and load/bake sculpture AFTER **
        const assetLoadingPromise = this.preloadDevAssets(); 

        // Load the model and BAKE its position data *after* all managers are instantiated
        const sculptureLoadingPromise = this.preloadDefaultSculpture();
        
        // ** Await ALL major loading before moving to final render setup **
        await Promise.all([assetLoadingPromise, sculptureLoadingPromise]);

        
        // Phase 3: Final structural setup and initial rendering
        
        // 1. Create all geometry based on final settings and baked data
        this.ImagePlaneManager.createDefaultLandscape(); 
        
        // 2. Activate FluidSim GPGPU if it's the starting mode.
        // This MUST happen AFTER the model is baked (in preloadDefaultSculpture).
        if (this.vizSettings.gpgpuGeometryMode === 'fluidsim') {
             this.FluidSimulationContainer.setActive(true);
        }
        
        // 3. Render and final touches
        this.BackgroundManager.render(); 
        this.GPGPUDebugger.update(); 
        
        const defaultShaderId = 'presetBg6';
        const defaultShaderCode = this.shaderPresets[defaultShaderId];
        if (this.vizSettings.backgroundMode === 'shader' && defaultShaderCode) {
            console.log("Loading default background shader preset...");
            const shaderToyGLSLEl = document.getElementById('shaderToyGLSL');
            if (shaderToyGLSLEl) {
                shaderToyGLSLEl.value = defaultShaderCode;
                this.vizSettings.shaderToyGLSL = defaultShaderCode;
                if (this.UIManager) {
                    this.UIManager.loadUserShader(defaultShaderId); 
                }
            }
        }

        console.log("Loading default 3D model preset...");
        const modelPreset = this.modelPresets['modelPreset5'];
        if (modelPreset && this.ModelManager) {
            this.ModelManager.loadGLTFModel(modelPreset);
            if (this.UIManager) this.UIManager.updateFileNameDisplay('gltf', modelPreset.name);
        }

        window.addEventListener('resize', this.onWindowResize.bind(this));
        this.onWindowResize(); 
        
        window.addEventListener('mousemove', (event) => {
            if (this.vizSettings.enableShaderMouse && this.vizSettings.backgroundMode === 'shader') {
                this.mouseState.x = event.clientX;
                this.mouseState.y = event.clientY;
            }
            if (this.GPGPUDebugger) {
                this.GPGPUDebugger.handleMouseMove(event);
            }
        });
        
        const canvas = this.renderer.domElement;
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

        const directorButton = document.getElementById('directorModeButton');
        if (directorButton) {
            directorButton.addEventListener('click', () => {
                if (this.DirectorManager.isActive) {
                    this.DirectorManager.stop();
                    directorButton.textContent = "Start Director Mode";
                    directorButton.classList.remove('button-solid-glow');
                } else {
                    this.DirectorManager.start();
                    directorButton.textContent = "Stop Director Mode";
                    directorButton.classList.add('button-solid-glow');
                }
            });
        }

        this.animate();
    },

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        const delta = this.clock.getDelta();
        const cappedDelta = Math.min(delta, 1 / 30); 
        this.currentTime = this.clock.getElapsedTime(); 
        this.frame++;

        const S = this.vizSettings;
        if (S.enableLightOrbit) {
            const orbitTime = this.currentTime * S.lightOrbitSpeed;
            const newX = Math.cos(orbitTime);
            const newZ = Math.sin(orbitTime);

            this.directionalLight.position.x = newX;
            this.directionalLight.position.z = newZ;
            
            S.lightDirectionX = newX;
            S.lightDirectionZ = newZ;
            
            const sliderX = document.getElementById('lightDirectionX');
            const sliderZ = document.getElementById('lightDirectionZ');
            if (sliderX && sliderZ) {
                sliderX.value = newX;
                sliderZ.value = newZ;
                this.UIManager.updateRangeDisplay('lightDirectionX', newX);
                this.UIManager.updateRangeDisplay('lightDirectionZ', newZ);
            }
        }
        
        this.guideLaser.visible = S.enableGuideLaser;
        if (S.enableGuideLaser) {
            const laserStart = new THREE.Vector3().copy(this.directionalLight.position).multiplyScalar(100);
            const laserEnd = new THREE.Vector3(0,0,0);
            const positions = this.guideLaser.geometry.attributes.position.array;
            positions[0] = laserStart.x;
            positions[1] = laserStart.y;
            positions[2] = laserStart.z;
            positions[3] = laserEnd.x;
            positions[4] = laserEnd.y;
            positions[5] = laserEnd.z;
            this.guideLaser.geometry.attributes.position.needsUpdate = true;
        }
        
        this.AudioProcessor.updateAudioData();
        if(this.animationMixer) this.animationMixer.update(cappedDelta);
        
        // ** THE FIX IS HERE: The update order has been corrected. **
        // The Director must run FIRST to set the rules for the frame.
        // The Simulation Containers then run SECOND to execute those rules.
        this.FluidDirector.update();
        this.FluidSimulationContainer.update(cappedDelta);
        this.ComputeManager.update(cappedDelta);

        this.DirectorManager.update(cappedDelta);
        this.ImagePlaneManager.update(cappedDelta);
        this.ModelManager.update(cappedDelta);
        this.CubeWallManager.update();
        this.ParticleTransitions.update();
        
        this.CameraManager.update(cappedDelta); 
        
        this.SceneManager.update(cappedDelta);
        this.BackgroundManager.update();
        this.GPGPUDebugger.update();
        this.Debugger.update();

        this.UIManager.syncManualSlidersFromState();

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