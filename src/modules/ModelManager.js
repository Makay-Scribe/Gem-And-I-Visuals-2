import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const ModelManager = {
    app: null,
    gltfModel: null,
    animationMixer: null,
    baseScale: new THREE.Vector3(1, 1, 1),
    boundingSphere: new THREE.Sphere(),
    
    init(appInstance) {
        this.app = appInstance;
        console.log("ModelManager initialized.");
    },

    stopAllTransitions() {
        // This manager no longer handles its own transitions.
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
                    this.gltfModel.removeFromParent();
                }
                if (this.animationMixer) {
                    this.animationMixer.stopAllAction();
                    this.animationMixer = null;
                }

                this.gltfModel = gltf.scene;
                this.app.gltfModel = gltf.scene;

                const box = new THREE.Box3().setFromObject(this.gltfModel);
                box.getBoundingSphere(this.boundingSphere);
                
                const size = box.getSize(new THREE.Vector3());
                const scale = 10 / Math.max(size.x, size.y, size.z);
                this.baseScale.set(scale, scale, scale);
                this.gltfModel.scale.copy(this.baseScale);
                
                this.boundingSphere.radius *= scale;

                if (gltf.animations && gltf.animations.length) {
                    this.animationMixer = new THREE.AnimationMixer(this.gltfModel);
                    const action = this.animationMixer.clipAction(gltf.animations[0]);
                    action.play();
                    this.app.animationMixer = this.animationMixer;
                }
                
                this.app.worldPivot.add(this.gltfModel);
                if (this.app.UIManager) this.app.UIManager.logSuccess(`Model loaded: ${path.split('/').pop()}`);
                
                this.gltfModel.scale.multiplyScalar(this.app.defaultVisualizerSettings.modelScale);
                // Set initial position to (0,0,0) relative to the pivot.
                // The pivot's position will place it correctly in the world.
                this.gltfModel.position.set(0, 0, 0); 
                
                // Trigger a control switch to correctly position the new model
                this.app.switchActiveControl(null); // Force a reset
                this.app.switchActiveControl('model');

            },
            undefined, 
            (error) => {
                console.error("An error happened loading GLTF:", error);
                if (this.app.UIManager) this.app.UIManager.logError(`GLTF Load Error: ${error.message.substring(0, 100)}...`);
            }
        );
    },

    returnToHome() {
        // This is handled globally.
    },

    update(delta) {
        if (!this.gltfModel) return;

        const S = this.app.vizSettings;
        
        if (!S.enableModel) {
             this.gltfModel.visible = false;
             return;
        }
        this.gltfModel.visible = true;
        
        // Apply scale based on UI controls.
        this.gltfModel.scale.copy(this.baseScale).multiplyScalar(S.modelScale);
        
        // REMOVED: The logic that reset the position is gone.
        // The model's position is now entirely determined by its parent (either the worldPivot or the scene).

        if (S.enableModelSpin) {
            this.gltfModel.rotation.y += S.modelSpinSpeed * delta;
        }
    },
};