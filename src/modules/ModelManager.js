import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const ModelManager = {
    app: null,
    gltfModel: null,
    animationMixer: null,
    baseScale: new THREE.Vector3(1, 1, 1),
    boundingSphere: new THREE.Sphere(),
    
    positionTransition: {
        active: false,
        velocity: new THREE.Vector3(),
        stiffness: 0.08,
        damping: 0.15,
    },

    autopilot: {
        active: false,
        isTransitioningIn: false,
        transitionStartPos: new THREE.Vector3(),
        transitionStartQuat: new THREE.Quaternion(),
        transitionProgress: 0,
        transitionDuration: 10.0,
        
        mode: null,
        subMode: null, 
        randomBounds: null,
        startPosition: new THREE.Vector3(),
        targetPosition: new THREE.Vector3(),
        startQuaternion: new THREE.Quaternion(),
        targetQuaternion: new THREE.Quaternion(),
        waypointTransitionDuration: 15.0,
        holdTimer: 0,
        holdDuration: 2.0,
    },

    init(appInstance) {
        this.app = appInstance;
        console.log("ModelManager initialized.");
    },

    stopAllTransitions() {
        this.positionTransition.active = false;
        this.positionTransition.velocity.set(0,0,0);
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
                
                this.app.scene.add(this.gltfModel);
                if (this.app.UIManager) this.app.UIManager.logSuccess(`Model loaded: ${path.split('/').pop()}`);
                
                this.gltfModel.scale.multiplyScalar(this.app.defaultVisualizerSettings.modelScale);
                // On load, place the model directly at its "home" position defined in vizSettings.
                this.gltfModel.position.copy(this.app.vizSettings.manualModelPosition);
                this.app.UIManager.syncManualSliders();

            },
            undefined, 
            (error) => {
                console.error("An error happened loading GLTF:", error);
                if (this.app.UIManager) this.app.UIManager.logError(`GLTF Load Error: ${error.message.substring(0, 100)}...`);
            }
        );
    },

    startAutopilot(presetId) {
        if (!this.gltfModel) return;
        this.stopAllTransitions(); 
        const ap = this.autopilot;
        
        ap.isTransitioningIn = true;
        ap.transitionProgress = 0;
        ap.transitionStartPos.copy(this.gltfModel.position);
        ap.transitionStartQuat.copy(this.gltfModel.quaternion);
        ap.active = false;
        ap.mode = presetId;
        ap.subMode = null;

        const boundsSize = new THREE.Vector3(30, 20, 20);
        const homePosition = this.app.vizSettings.manualModelPosition;
        ap.randomBounds = new THREE.Box3(
            homePosition.clone().sub(boundsSize),
            homePosition.clone().add(boundsSize)
        );

        if (presetId === 'autopilotPreset1') {
            ap.randomBounds.min.z = this.app.camera.position.z - 5;
            ap.randomBounds.max.z = homePosition.z + 20;
        } else if (presetId === 'autopilotPreset2') {
            ap.subMode = 'roaming';
        } else if (presetId === 'autopilotPreset3' || presetId === 'autopilotPreset4') {
             ap.randomBounds.expandByVector(new THREE.Vector3(15, 10, 15));
        }
        console.log(`Model autopilot started with preset: ${presetId}`);
    },
    
    returnToHome() {
        if (!this.gltfModel) return;
        this.positionTransition.active = true;
    },

    update(delta) {
        if (!this.gltfModel) return;

        const S = this.app.vizSettings;
        const pt = this.positionTransition;
        
        if (!S.enableModel) {
             if (this.autopilot.active || this.autopilot.isTransitioningIn) this.stopAutopilot();
             this.gltfModel.visible = false;
             return;
        }
        this.gltfModel.visible = true;
        
        this.gltfModel.scale.copy(this.baseScale).multiplyScalar(S.modelScale);
        
        if (pt.active) {
            // The sacred "home" position from vizSettings is the target.
            const targetPosition = S.manualModelPosition;
            const displacement = new THREE.Vector3().subVectors(targetPosition, this.gltfModel.position);
            
            const springForce = displacement.multiplyScalar(pt.stiffness);
            const dampingForce = pt.velocity.clone().multiplyScalar(-pt.damping);
            const acceleration = new THREE.Vector3().addVectors(springForce, dampingForce);
            
            pt.velocity.add(acceleration.multiplyScalar(delta));
            this.gltfModel.position.add(pt.velocity.clone().multiplyScalar(delta));

            if (displacement.lengthSq() < 0.001 && pt.velocity.lengthSq() < 0.001) {
                this.stopAllTransitions();
                this.gltfModel.position.copy(targetPosition);
            }
        } else if (S.modelAutopilotOn) {
            // Autopilot logic would go here
        } else {
            // If not animating and not being dragged, stay where you are.
            // The drag action directly manipulates model.position now.
            // If sliders are used, vizSettings changes, and this snaps to it.
            if (this.app.dragState.targetObject !== this.gltfModel) {
                this.gltfModel.position.copy(S.manualModelPosition);
            }
        }

        if (S.enableModelSpin && !S.modelAutopilotOn) {
            this.gltfModel.rotation.y += S.modelSpinSpeed * delta;
        }
    },
    
    // Unchanged helper functions
    generateNewRandomWaypoint(options = {}) {
        // ...
    },
    generateObserveWaypoint() {
        // ...
    },
    stopAutopilot() {
        if (!this.autopilot.active && !this.autopilot.isTransitioningIn) return;
        this.autopilot.active = false;
        this.autopilot.isTransitioningIn = false;
        this.autopilot.mode = null;
        this.returnToHome();
        console.log("Model autopilot stopped.");
    },

};