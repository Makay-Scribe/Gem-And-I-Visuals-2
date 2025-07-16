import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const PRESET_DEFAULT_SPEEDS = {
    autopilotPreset1: 1.0, 
    autopilotPreset2: 1.0,
    autopilotPreset3: 1.0,
    autopilotPreset4: 1.0,
    autopilotPreset5: 1.2 
};

export const ModelManager = {
    app: null,
    gltfModel: null,
    animationMixer: null,
    activePresetId: null,
    baseScale: new THREE.Vector3(1, 1, 1),
    boundingSphere: new THREE.Sphere(),
    _waypointRetryCount: 0, 
    
    state: {
        isUnderManualControl: false,
        manualControlReleaseTime: -1, 
        manualControlTimeoutId: null,
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

        S.modelAutopilotOn = true;
        S.activeModelPreset = presetId;
        
        if (this.app.UIManager) {
            this.app.UIManager.updateMasterControls();
        }

        ap.waypointProgress = 1.0; 
        ap.holdTimer = 0;
        
        const home = this.state.targetPosition; 

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
            case 'autopilotPreset5': 
                ap.randomBounds = new THREE.Box3(
                    new THREE.Vector3(home.x - 120, home.y - 5, -10),
                    new THREE.Vector3(home.x + 120, home.y + 5, 25)
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
        if (this.activePresetId && this.app.modelPresets[this.activePresetId]?.homeOffset) {
            ap.endPos.add(this.app.modelPresets[this.activePresetId].homeOffset);
        }

        ap.endQuat.copy(this.state.homeQuaternion); 
        ap.waypointProgress = 0;

        ap.waypointTransitionDuration = 6.0;
        
        console.log(`Model: Initiating return to home. Next preset: ${nextPreset}`);
    },

    stopAutopilot() {
        if (this.app.vizSettings.modelAutopilotOn) {
            this.app.vizSettings.modelAutopilotOn = false;
            this.initiateReturnToHome(null);
            if (this.app.UIManager) this.app.UIManager.updateMasterControls();
            console.log("Model Autopilot STOP triggered. Starting transition to home.");
        }
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
        this.state.targetQuaternion.slerp(ap.startQuat, ap.endQuat, ease);

        if (ap.waypointProgress >= 1.0) {
            if (ap.isTransitioningToHome) {
                ap.isTransitioningToHome = false;
                if (ap.nextPresetId) {
                    this.startAutopilot(ap.nextPresetId);
                } else {
                    ap.active = false;
                    ap.preset = null;
                    if (this.app.UIManager) this.app.UIManager.updateMasterControls();
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

    loadGLTFModel(preset) {
        if (!preset || !preset.path) {
            console.error("No valid GLTF model preset provided.");
            if (this.app.UIManager) this.app.UIManager.logError("Cannot load model: Invalid preset.");
            return;
        }
        this.stopAutopilot();

        this.activePresetId = preset.id;
        if (this.app.UIManager) this.app.UIManager.updateModelPresetGlow();

        const loader = new GLTFLoader();
        loader.load(
            preset.path,
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
                
                const finalHomePos = new THREE.Vector3().copy(this.state.homePosition);
                if (preset.homeOffset) {
                    finalHomePos.add(preset.homeOffset);
                }
                this.gltfModel.position.copy(finalHomePos);
                this.state.targetPosition.copy(finalHomePos);
                
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
                
                if (this.app.UIManager) this.app.UIManager.logSuccess(`Model loaded: ${preset.name}`);
                
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
        
        const state = this.state;
        const now = this.app.currentTime;
        const manualHoldTime = 0.5;
        const inGracePeriod = state.manualControlReleaseTime > 0 && (now - state.manualControlReleaseTime < manualHoldTime);

        // ** THE FIX IS HERE: The same logic from ImagePlaneManager is now applied **
        if (state.isUnderManualControl || inGracePeriod) {
            // Do nothing, let manual inputs persist for the grace period.
        } else if (this.autopilot.active) {
            this.updateAutopilot(delta);
        } else {
            // Idle state: return to home.
            const finalHomePos = new THREE.Vector3().copy(this.state.homePosition);
            if (this.activePresetId && this.app.modelPresets[this.activePresetId]?.homeOffset) {
                finalHomePos.add(this.app.modelPresets[this.activePresetId].homeOffset);
            }
            // ** This now smoothly interpolates rotation back to home **
            state.targetPosition.lerp(finalHomePos, 0.02);
            state.targetQuaternion.slerp(this.state.homeQuaternion, 0.02);
        }
        
        if (S.enableModelSpin) {
            const spinQuaternion = new THREE.Quaternion();
            const spinAxis = new THREE.Vector3(0, 1, 0); 
            spinQuaternion.setFromAxisAngle(spinAxis, S.modelSpinSpeed * delta);
            state.targetQuaternion.multiply(spinQuaternion);
        }

        this.gltfModel.position.lerp(state.targetPosition, 0.05);
        this.gltfModel.quaternion.slerp(state.targetQuaternion, 0.05);
    },
};