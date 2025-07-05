import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const ModelManager = {
    app: null,
    gltfModel: null,
    animationMixer: null,
    autopilot: {
        active: false,
        mode: 'random',
        speed: 0.1,
        targetPosition: new THREE.Vector3()
    },

    init(appInstance) {
        this.app = appInstance;
        console.log("ModelManager initialized.");
    },

    loadGLTFModel(path) {
        if (!path) {
            console.error("No GLTF model path provided.");
            if (this.app.UIManager) this.app.UIManager.logError("Cannot load model: No path specified.");
            return;
        }

        const loader = new GLTFLoader();
        loader.load(
            path,
            // onSuccess
            (gltf) => {
                this.onModelLoad(gltf);
            },
            // onProgress (optional)
            (xhr) => {
                const percentComplete = (xhr.loaded / xhr.total) * 100;
                // console.log(`Model loading: ${Math.round(percentComplete)}%`);
                if (this.app.UIManager) {
                    // Avoid spamming the log
                    if (percentComplete === 100) {
                        this.app.UIManager.logSuccess(`Model '${path.split('/').pop()}' processed.`);
                    }
                }
            },
            // onError
            (error) => {
                console.error("An error happened loading GLTF:", error);
                if (this.app.UIManager) this.app.UIManager.logError(`GLTF Load Error: ${error.message.substring(0, 100)}...`);
            }
        );
    },
    
    onModelLoad(gltf) {
        // First, dispose of the old model if it exists
        if (this.gltfModel) {
            this.app.scene.remove(this.gltfModel);
            // Proper disposal would go here (geometry, material)
        }

        this.gltfModel = gltf.scene;

        // Scale and position the model
        const box = new THREE.Box3().setFromObject(this.gltfModel);
        const size = box.getSize(new THREE.Vector3());
        const scale = 10 / Math.max(size.x, size.y, size.z);
        this.gltfModel.scale.set(scale, scale, scale);
        
        this.gltfModel.position.set(0, 0, 0); // Center it initially

        // Set up animations
        if (gltf.animations && gltf.animations.length) {
            this.app.animationMixer = new THREE.AnimationMixer(this.gltfModel);
            const action = this.app.animationMixer.clipAction(gltf.animations[0]);
            action.play();
        } else {
            this.app.animationMixer = null;
        }

        // Apply custom material settings
        this.gltfModel.traverse((child) => {
            if (child.isMesh) {
                child.material.metalness = this.app.vizSettings.metalness;
                child.material.roughness = this.app.vizSettings.roughness;
                
                // This is a good place for other material adjustments
            }
        });
        
        // FIX: The function updateEnvironment was removed from SceneManager.
        // This call is no longer needed as we are not using PBR environment maps for now.
        // this.app.SceneManager.updateEnvironment(this.gltfModel);

        this.app.scene.add(this.gltfModel);
        console.log("GLTF Model loaded and added to scene.");

        if (this.app.UIManager) {
            this.app.UIManager.logSuccess("3D Model loaded successfully.");
        }
    },

    update(delta) {
        if (this.app.vizSettings.enableModelSpin && this.gltfModel) {
            this.gltfModel.rotation.y += this.app.vizSettings.modelSpinSpeed * delta;
        }
        // Autopilot logic will go here...
    },

    returnToHome() {
        this.autopilot.active = false;
        if (this.gltfModel) {
            // Simple return for now, can be a transition later
            this.gltfModel.position.set(0, 0, 0);
            this.gltfModel.rotation.set(0, 0, 0);
        }
    }
};