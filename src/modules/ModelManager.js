import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const ModelManager = {
    app: null,
    gltfModel: null,
    animationMixer: null,
    baseScale: new THREE.Vector3(1, 1, 1),

    homePosition: new THREE.Vector3(0, 5, 5),
    
    transition: {
        active: false,
        start: new THREE.Vector3(),
        end: new THREE.Vector3(),
        progress: 0,
        duration: 2.0
    },

    autopilot: {
        active: false,
    },

    init(appInstance) {
        this.app = appInstance;
        this.homePosition.copy(this.app.defaultVisualizerSettings.manualModelPosition);
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
            (gltf) => {
                if (this.gltfModel) {
                    this.app.scene.remove(this.gltfModel);
                    this.stopAutopilot();
                }
                if (this.animationMixer) {
                    this.animationMixer.stopAllAction();
                    this.animationMixer = null;
                }

                this.gltfModel = gltf.scene;
                this.app.gltfModel = gltf.scene;

                const box = new THREE.Box3().setFromObject(this.gltfModel);
                const size = box.getSize(new THREE.Vector3());
                const scale = 10 / Math.max(size.x, size.y, size.z);
                this.baseScale.set(scale, scale, scale);
                this.gltfModel.scale.copy(this.baseScale);
                
                this.gltfModel.position.copy(this.homePosition);

                if (gltf.animations && gltf.animations.length) {
                    this.animationMixer = new THREE.AnimationMixer(this.gltfModel);
                    const action = this.animationMixer.clipAction(gltf.animations[0]);
                    action.play();
                    this.app.animationMixer = this.animationMixer;
                }
                
                this.app.scene.add(this.gltfModel);
                if (this.app.UIManager) this.app.UIManager.logSuccess(`Model loaded: ${path.split('/').pop()}`);
                
                this.returnToHome();
            },
            undefined, 
            (error) => {
                console.error("An error happened loading GLTF:", error);
                if (this.app.UIManager) this.app.UIManager.logError(`GLTF Load Error: ${error.message.substring(0, 100)}...`);
            }
        );
    },

    stopAutopilot() {
        this.autopilot.active = false;
    },

    returnToHome() {
        if (!this.gltfModel) {
            this.transition.active = false;
            return;
        }
        this.stopAutopilot();
        this.transition.active = true;
        this.transition.progress = 0;
        this.transition.start.copy(this.gltfModel.position);
        this.transition.end.copy(this.homePosition);
    },

    update(delta) {
        if (!this.gltfModel) return;

        const S = this.app.vizSettings;
        
        // Visibility is now controlled only by its master switch.
        this.gltfModel.visible = S.enableModel;

        if (!this.gltfModel.visible) {
            if(this.autopilot.active) this.stopAutopilot();
            return;
        }
        
        this.gltfModel.scale.copy(this.baseScale).multiplyScalar(S.modelScale);

        if (S.modelAutopilotOn) {
            // Autopilot logic will go here
        } else {
            // Only respond to sliders if it's the active control target
            if (S.activeControl === 'model') {
                 if (this.transition.active) {
                    this.transition.progress = Math.min(1.0, this.transition.progress + delta / this.transition.duration);
                    const ease = 0.5 - 0.5 * Math.cos(this.transition.progress * Math.PI);
                    this.gltfModel.position.lerpVectors(this.transition.start, this.transition.end, ease);
                    if (this.transition.progress >= 1.0) {
                        this.transition.active = false;
                    }
                } else {
                    this.gltfModel.position.copy(S.manualModelPosition);
                }
            }
        }

        if (S.enableModelSpin && !S.modelAutopilotOn) {
            this.gltfModel.rotation.y += S.modelSpinSpeed * delta;
        }
    }
};