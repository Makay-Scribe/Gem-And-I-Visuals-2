import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const PRESET_DEFAULT_SPEEDS = {
    autopilotPreset1: 1.0, 
    autopilotPreset2: 1.0,
    autopilotPreset3: 1.0,
    autopilotPreset4: 1.0
};

export const ModelManager = {
    app: null,
    gltfModel: null,
    animationMixer: null,
    baseScale: new THREE.Vector3(1, 1, 1),
    boundingSphere: new THREE.Sphere(),
    _waypointRetryCount: 0, 
    
    state: {
        isUnderManualControl: false,
        targetPosition: new THREE.Vector3(),
        targetQuaternion: new THREE.Quaternion(),
        homePosition: new THREE.Vector3(),
        homeQuaternion: new THREE.Quaternion()
    },
    
    autopilot: {
        active: false,
        preset: null,
        isTransitioningToHome: false, 
        nextPresetId: null, 
        waypointProgress: 1.0, 
        waypointTransitionDuration: 10.0,
        holdTimer: 0,
        randomBounds: null,
        startPos: new THREE.Vector3(),
        endPos: new THREE.Vector3(),
        startQuat: new THREE.Quaternion(),
        endQuat: new THREE.Quaternion(),
    },

    init(appInstance) {
        this.app = appInstance;
        this.state.homePosition.copy(this.app.defaultVisualizerSettings.homePositionModel);
        this.state.targetPosition.copy(this.state.homePosition);
        console.log("ModelManager initialized.");
    },

    startAutopilot(presetId) {
        if (!this.gltfModel) return;
        const ap = this.autopilot;
        const S = this.app.vizSettings;

        ap.active = true;
        ap.preset = presetId;
        ap.isTransitioningToHome = false;

        S.modelAutopilotSpeed = PRESET_DEFAULT_SPEEDS[presetId] || 1.0;
        
        if (this.app.UIManager) {
            this.app.UIManager.updateMasterControls();
        }

        ap.waypointProgress = 1.0; 
        ap.holdTimer = 0;
        
        const home = this.state.homePosition;

        switch(presetId) {
            case 'autopilotPreset1': 
                ap.randomBounds = new THREE.Box3(
                    new THREE.Vector3(home.x - 20, home.y - 15, -20), 
                    new THREE.Vector3(home.x + 20, home.y + 15, 32)   
                );
                break;
            case 'autopilotPreset2': 
                ap.randomBounds = new THREE.Box3(
                    new THREE.Vector3(home.x - 40, home.y, -50),
                    new THREE.Vector3(home.x + 40, home.y + 30, 32)
                );
                break;
            case 'autopilotPreset3': 
                ap.randomBounds = new THREE.Box3(
                    new THREE.Vector3(home.x - 60, home.y - 10, -70),
                    new THREE.Vector3(home.x + 60, home.y + 10, 32)
                );
                break;
            case 'autopilotPreset4': 
                ap.randomBounds = new THREE.Box3(
                    new THREE.Vector3(home.x - 80, home.y - 40, -100),
                    new THREE.Vector3(home.x + 80, home.y + 40, 32)
                );
                break;
        }

        console.log(`Model Autopilot STARTED with preset: ${presetId}.`);
        this.generateNewRandomWaypoint();
    },
    
    initiateReturnToHome(nextPreset = null) {
        if (!this.gltfModel) return;
        const ap = this.autopilot;
        
        ap.isTransitioningToHome = true;
        ap.nextPresetId = nextPreset;
        ap.active = true; 
        ap.preset = null; 

        ap.startPos.copy(this.state.targetPosition);
        ap.startQuat.copy(this.state.targetQuaternion);

        ap.endPos.copy(this.state.homePosition);
        ap.endQuat.copy(this.state.homeQuaternion); 
        ap.waypointProgress = 0;

        ap.waypointTransitionDuration = 6.0;
        
        console.log(`Model: Initiating return to home. Next preset: ${nextPreset}`);
    },

    stopAutopilot() {
        // ** THE FIX IS HERE **
        // This now correctly calls the timed return-to-home sequence.
        this.initiateReturnToHome(null);
        console.log("Model Autopilot STOP triggered. Starting transition to home.");
    },

    generateNewRandomWaypoint() {
        const ap = this.autopilot;
        if (!this.gltfModel || !ap.randomBounds) return;

        ap.startPos.copy(this.state.targetPosition);
        ap.startQuat.copy(this.state.targetQuaternion);
        
        ap.endPos.set(
            THREE.MathUtils.randFloat(ap.randomBounds.min.x, ap.randomBounds.max.x),
            THREE.MathUtils.randFloat(ap.randomBounds.min.y, ap.randomBounds.max.y),
            THREE.MathUtils.randFloat(ap.randomBounds.min.z, ap.randomBounds.max.z)
        );
        
        if (this.app.vizSettings.enableCollisionAvoidance && this.app.ImagePlaneManager.landscape) {
            const direction = new THREE.Vector3().subVectors(ap.endPos, ap.startPos);
            const distance = direction.length();
            direction.normalize();

            this.app.raycaster.set(ap.startPos, direction);
            const intersects = this.app.raycaster.intersectObject(this.app.ImagePlaneManager.landscape, false);

            if (intersects.length > 0 && intersects[0].distance < distance) {
                console.log(`Path collision detected by Raycaster. Retrying waypoint.`);
                if (this._waypointRetryCount < 5) { 
                    this._waypointRetryCount++;
                    this.generateNewRandomWaypoint(); 
                    return; 
                } else { 
                    console.warn("Model path collision retry failed after 5 attempts. Allowing path.");
                }
            }
        }

        this._waypointRetryCount = 0; 

        const randomRot = new THREE.Euler( (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * Math.PI, (Math.random() - 0.5) * 0.4 );
        ap.endQuat.setFromEuler(randomRot);
        
        const totalDistance = ap.startPos.distanceTo(ap.endPos);
        const speed = this.app.vizSettings.modelAutopilotSpeed;
        ap.waypointTransitionDuration = THREE.MathUtils.clamp(totalDistance / (speed * 4), 8, 20);
        ap.holdTimer = Math.random() * 5.0 + 2.0;
        ap.waypointProgress = 0;
    },
    
    runMovementLogic(delta) {
        const ap = this.autopilot;
        
        ap.waypointProgress = Math.min(1.0, ap.waypointProgress + delta / ap.waypointTransitionDuration);
        const ease = 0.5 - 0.5 * Math.cos(ap.waypointProgress * Math.PI);
        
        this.state.targetPosition.lerpVectors(ap.startPos, ap.endPos, ease);
        this.state.targetQuaternion.copy(ap.startQuat).slerp(ap.endQuat, ease);

        if (ap.waypointProgress >= 1.0) {
            if (ap.isTransitioningToHome) {
                ap.isTransitioningToHome = false;
                if (ap.nextPresetId) {
                    this.startAutopilot(ap.nextPresetId);
                } else {
                    ap.active = false;
                    ap.preset = null;
                }
            } else {
                 ap.holdTimer = Math.random() * 5.0 + 2.0;
            }
        }
    },
    
    updateAutopilot(delta) {
        const ap = this.autopilot;
        
        if (ap.isTransitioningToHome) {
            this.runMovementLogic(delta);
            return;
        }
        
        if (ap.preset) {
            if (ap.waypointProgress >= 1.0 && ap.holdTimer > 0) {
                ap.holdTimer -= delta;
            } else if (ap.waypointProgress >= 1.0 && ap.holdTimer <= 0) {
                this.generateNewRandomWaypoint();
            }
            
            if (ap.waypointProgress < 1.0) {
                 this.runMovementLogic(delta);
            }
        }
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
                
                this.app.scene.add(this.gltfModel);

                this.gltfModel.position.copy(this.state.homePosition);
                this.state.targetPosition.copy(this.state.homePosition);
                
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
                
                if (this.app.UIManager) this.app.UIManager.logSuccess(`Model loaded: ${path.split('/').pop()}`);
                
                this.gltfModel.scale.multiplyScalar(this.app.defaultVisualizerSettings.modelScale);
                
            },
            undefined, 
            (error) => {
                console.error("An error happened loading GLTF:", error);
                if (this.app.UIManager) this.app.UIManager.logError(`GLTF Load Error: ${error.message.substring(0, 100)}...`);
            }
        );
    },

    update(delta) {
        if (!this.gltfModel) return;
        const S = this.app.vizSettings;
        
        if (!S.enableModel) {
             this.gltfModel.visible = false;
             return;
        }
        this.gltfModel.visible = true;
        
        if (this.autopilot.active) {
            this.updateAutopilot(delta);
        } else if (this.state.isUnderManualControl) {
            // Do nothing. The mouse/sliders are controlling the target state directly.
        } else {
            this.state.targetPosition.lerp(this.state.homePosition, 0.02);
            this.state.targetQuaternion.slerp(this.state.homeQuaternion, 0.02);
        }
        
        this.gltfModel.position.lerp(this.state.targetPosition, 0.05);
        this.gltfModel.quaternion.slerp(this.state.targetQuaternion, 0.05);
        
        if (!this.autopilot.active && !this.state.isUnderManualControl && S.enableModelSpin) {
            this.gltfModel.rotation.y += S.modelSpinSpeed * delta;
        }
    },
};