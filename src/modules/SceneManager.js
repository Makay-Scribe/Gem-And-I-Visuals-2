import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { Debugger } from './Debugger.js';

export const SceneManager = {
    app: null, // Will be set on init

    init(appInstance) {
        this.app = appInstance;
        const THREE = this.app.THREE;

        this.app.scene = new THREE.Scene();
        this.app.camera = new THREE.PerspectiveCamera(this.app.defaultVisualizerSettings.cameraFOV, window.innerWidth / window.innerHeight, 0.1, 1000);
        
        // **FIX**: Create a robust placeholder CubeTexture the correct way
        this.app.placeholderEnvMap = new THREE.CubeTexture();
        this.app.placeholderEnvMap.format = THREE.RGBAFormat; // Define format
        this.app.placeholderEnvMap.type = THREE.UnsignedByteType; // Define type
        this.app.placeholderEnvMap.generateMipmaps = false; // CRITICAL: Disable mipmaps for the placeholder
        this.app.placeholderEnvMap.minFilter = THREE.LinearFilter;
        this.app.placeholderEnvMap.magFilter = THREE.LinearFilter;
        this.app.placeholderEnvMap.needsUpdate = true;


        // Initialize camera manager after camera is created
        if (this.app.CameraManager) {
            this.app.CameraManager.init(this.app);
        } else {
            console.error("SceneManager: CameraManager not available at init.");
        }
        
        // Set the initial environment to the placeholder
        this.app.hdrTexture = this.app.placeholderEnvMap;
        this.updateEnvironment(); // Apply the placeholder initially
        
        this.loadHDRI('/hdri/venice_sunset_1k.hdr');

        // Main scene lighting
        this.app.ambientLight = new THREE.AmbientLight(this.app.vizSettings.ambientLightColor, 1);
        this.app.scene.add(this.app.ambientLight);
        this.app.directionalLight = new THREE.DirectionalLight(this.app.vizSettings.lightColor, 3.0);
        this.app.scene.add(this.app.directionalLight);

        // Initialize audio texture with a placeholder. It's used by multiple managers.
        const placeholderAudioData = new Uint8Array(256).fill(0);
        this.app.audioTexture = new THREE.DataTexture(placeholderAudioData, 256, 1, THREE.RedFormat);
        this.app.audioTexture.needsUpdate = true;
        
        // --- Create the guide laser for lighting direction ---
        const laserMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.5 });
        const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)];
        const laserGeometry = new THREE.BufferGeometry().setFromPoints(points);
        this.app.guideLaser = new THREE.Line(laserGeometry, laserMaterial);
        this.app.guideLaser.visible = false;
        this.app.scene.add(this.app.guideLaser);
    },

    updateEnvironment() {
        const S = this.app.vizSettings;
        let activeEnvMap = this.app.placeholderEnvMap; // Default to placeholder

        if (S.enableReflections && this.app.hdrTexture) {
            activeEnvMap = this.app.hdrTexture;
        }

        if (this.app.scene.environment !== activeEnvMap) {
            this.app.scene.environment = activeEnvMap;
            
            // Update ImagePlane's material specifically
            if (this.app.ImagePlaneManager && this.app.ImagePlaneManager.landscapeMaterial) {
                // For custom shaders, we pass the env map as a uniform
                this.app.ImagePlaneManager.landscapeMaterial.uniforms.t_envMap.value = activeEnvMap;
                this.app.ImagePlaneManager.landscapeMaterial.uniforms.u_envMapIntensity.value = S.reflectionStrength;
            }
            // And traverse for any other models like the GLTF
            this.app.scene.traverse(obj => {
                if(obj.isMesh && obj.material.isMeshStandardMaterial) {
                    // Exclude the landscape which is already handled, and update others (like the model)
                    if (!this.app.ImagePlaneManager || obj !== this.app.ImagePlaneManager.landscape) {
                        obj.material.envMap = activeEnvMap; // Set envMap for standard materials
                        obj.material.envMapIntensity = S.reflectionStrength;
                        obj.material.needsUpdate = true;
                    }
                }
            });
        }
    },

    loadHDRI(fileOrUrl) {
        const THREE = this.app.THREE;
        const pmremGenerator = new THREE.PMREMGenerator(this.app.renderer);
        
        const onHdrLoad = (texture) => {
            if (this.app.hdrTexture && this.app.hdrTexture !== this.app.placeholderEnvMap) { 
                this.app.hdrTexture.dispose(); 
            }
            this.app.hdrTexture = pmremGenerator.fromEquirectangular(texture).texture;
            pmremGenerator.dispose();
            texture.dispose();
            this.updateEnvironment(); // Update all materials with the new, real env map
            if (this.app.UIManager) this.app.UIManager.logSuccess('HDRI environment loaded.');
        };

        const onHdrError = (err) => {
            console.error('Failed to load HDR environment.', err);
            if (this.app.UIManager) this.app.UIManager.logError('Failed to load HDRI.');
            // Revert to placeholder if loading fails
            this.app.hdrTexture = this.app.placeholderEnvMap;
            this.updateEnvironment();
        };

        const loader = new RGBELoader();
        if (typeof fileOrUrl === 'string') {
            loader.load(fileOrUrl, onHdrLoad, undefined, onHdrError);
        } else {
            const reader = new FileReader();
            reader.onload = (e) => {
                loader.parse(e.target.result, onHdrLoad, onHdrError);
            };
            reader.readAsArrayBuffer(fileOrUrl);
        }
    },

    createAudioTexture() {
        const THREE = this.app.THREE;
        if (this.app.AudioProcessor && this.app.AudioProcessor.frequencyData) {
            if (this.app.audioTexture) {
                this.app.audioTexture.image.data = this.app.AudioProcessor.frequencyData;
                this.app.audioTexture.needsUpdate = true;
            } else {
                this.app.audioTexture = new THREE.DataTexture(this.app.AudioProcessor.frequencyData, this.app.AudioProcessor.frequencyData.length, 1, THREE.RedFormat);
                this.app.audioTexture.needsUpdate = true;
            }
        }
    },

    update(cappedDelta) {
        const S = this.app.vizSettings;
        
        // --- Lighting Update ---
        this.updateEnvironment();
        if (S.enableLightOrbit) {
            const orbitTime = this.app.currentTime * S.lightOrbitSpeed;
            S.lightDirectionX = Math.cos(orbitTime);
            S.lightDirectionZ = Math.sin(orbitTime);
            if (this.app.UIManager) {
                this.app.UIManager.updateRangeDisplay('lightDirectionX', S.lightDirectionX);
                this.app.UIManager.updateRangeDisplay('lightDirectionZ', S.lightDirectionZ);
                const lightDirXEl = document.getElementById('lightDirectionX');
                const lightDirZEl = document.getElementById('lightDirectionZ');
                if (lightDirXEl) lightDirXEl.value = S.lightDirectionX;
                if (lightDirZEl) lightDirZEl.value = S.lightDirectionZ;
            }
        }
        if (this.app.ambientLight) this.app.ambientLight.color.set(S.ambientLightColor);
        if (this.app.directionalLight) {
            this.app.directionalLight.color.set(S.lightColor);
            this.app.directionalLight.position.set(S.lightDirectionX, S.lightDirectionY, S.lightDirectionZ).normalize();
            this.app.directionalLight.intensity = 3.0;
        }
        if (this.app.ambientLight) this.app.ambientLight.intensity = 0.5;

        // --- Guide Laser Update ---
        if (this.app.guideLaser) { 
            this.app.guideLaser.visible = S.enableGuideLaser; 
            if (this.app.guideLaser.visible) { 
                const positions = this.app.guideLaser.geometry.attributes.position; 
                const laserStart = this.app.directionalLight.position.clone().multiplyScalar(-50); 
                positions.setXYZ(0, laserStart.x, laserStart.y, laserStart.z); 
                positions.setXYZ(1, 0, 0, 0); 
                positions.needsUpdate = true; 
            } 
        }
    }
};