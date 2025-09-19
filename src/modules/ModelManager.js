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
    baseScale: null, // Initialized in init
    boundingSphere: null, // Initialized in init
    _waypointRetryCount: 0, 
    
    state: {
        isUnderManualControl: false,
        manualControlReleaseTime: -1, 
        manualControlTimeoutId: null,
        returnEaseFactor: 0.0,
        targetPosition: null, // Initialized in init
        targetQuaternion: null, // Initialized in init
        homePosition: null, // Initialized in init
        homeQuaternion: null // Initialized in init
    },
    
    autopilot: {
        active: false,
        preset: null,
        isTransitioningToHome: false, 
        isHoldingAtHome: false, 
        homeHoldTimer: 0, 
        nextPresetId: null, 
        waypointProgress: 1.0, 
        waypointTransitionDuration: 10.0,
        holdTimer: 0,
        randomBounds: null, // Initialized in startAutopilot
        startPos: null, // Initialized in init
        endPos: null, // Initialized in init
        startQuat: null, // Initialized in init
        endQuat: null, // Initialized in init
    },

    init(appInstance) {
        this.app = appInstance;
        // Initialize Three.js dependent properties here
        this.baseScale = new this.app.THREE.Vector3(1, 1, 1);
        this.boundingSphere = new this.app.THREE.Sphere();

        this.state.homePosition = new this.app.THREE.Vector3();
        this.state.targetPosition = new this.app.THREE.Vector3();
        this.state.targetQuaternion = new this.app.THREE.Quaternion();
        this.state.homeQuaternion = new this.app.THREE.Quaternion();
        
        this.autopilot.startPos = new this.app.THREE.Vector3();
        this.autopilot.endPos = new this.app.THREE.Vector3();
        this.autopilot.startQuat = new this.app.THREE.Quaternion();
        this.autopilot.endQuat = new this.app.THREE.Quaternion();


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
        ap.isHoldingAtHome = false; // Ensure hold is off when starting fresh

        S.modelAutopilotOn = true;
        S.activeModelPreset = presetId;
        
        if (this.app.UIManager) {
            this.app.UIManager.updateMasterControls();
        }

        ap.waypointProgress = 1.0; 
        ap.holdTimer = 0;
        
        const home = this.state.targetPosition; 

        // Use this.app.THREE.Box3
        switch(presetId) {
            case 'autopilotPreset1': 
                ap.randomBounds = new this.app.THREE.Box3(
                    new this.app.THREE.Vector3(home.x - 20, home.y - 15, -20), 
                    new this.app.THREE.Vector3(home.x + 20, home.y + 15, 32)   
                );
                break;
            case 'autopilotPreset2': 
                ap.randomBounds = new this.app.THREE.Box3(
                    new this.app.THREE.Vector3(home.x - 40, home.y, -50),
                    new this.app.THREE.Vector3(home.x + 40, home.y + 30, 32)
                );
                break;
            case 'autopilotPreset3': 
                ap.randomBounds = new this.app.THREE.Box3(
                    new this.app.THREE.Vector3(home.x - 60, home.y - 10, -70),
                    new this.app.THREE.Vector3(home.x + 60, home.y + 10, 32)
                );
                break;
            case 'autopilotPreset4': 
                ap.randomBounds = new this.app.THREE.Box3(
                    new this.app.THREE.Vector3(home.x - 80, home.y - 40, -100),
                    new this.app.THREE.Vector3(home.x + 80, home.y + 40, 32)
                );
                break;
            case 'autopilotPreset5': 
                ap.randomBounds = new this.app.THREE.Box3(
                    new this.app.THREE.Vector3(home.x - 120, home.y - 5, -10),
                    new this.app.THREE.Vector3(home.x + 120, home.y + 5, 25)
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
        ap.isHoldingAtHome = false; // Ensure hold is off
        ap.nextPresetId = nextPreset;
        ap.active = true; 
        ap.preset = null; 

        ap.startPos.copy(this.state.targetPosition);
        ap.startQuat.copy(this.state.targetQuaternion);

        ap.endPos.copy(this.state.homePosition);
        // Use this.app.THREE.Vector3 for homeOffset if it exists
        if (this.activePresetId && this.app.modelPresets[this.activePresetId]?.homeOffset) {
            ap.endPos.add(this.app.modelPresets[this.activePresetId].homeOffset);
        }

        ap.endQuat.copy(this.state.homeQuaternion); 
        ap.waypointProgress = 0;

        ap.waypointTransitionDuration = 6.0;
        
        console.log(`Model: Initiating return to home. Next preset: ${nextPreset}`);
    },

    stopAutopilot() {
        this.app.vizSettings.modelAutopilotOn = false;
        this.initiateReturnToHome(null);
        if (this.app.UIManager) this.app.UIManager.updateMasterControls();
        console.log("Model Autopilot STOP triggered. Starting transition to home.");
    },

    generateNewRandomWaypoint() {
        const ap = this.autopilot;
        if (!this.gltfModel || !ap.randomBounds) return;

        const visitHomeChance = 0.2; 
        if (Math.random() < visitHomeChance) {
            console.log("Model Autopilot: Decided to visit home.");
            this.initiateReturnToHome(ap.preset); 
            return; 
        }

        ap.startPos.copy(this.state.targetPosition);
        ap.startQuat.copy(this.state.targetQuaternion);
        
        ap.endPos.set(
            this.app.THREE.MathUtils.randFloat(ap.randomBounds.min.x, ap.randomBounds.max.x),
            this.app.THREE.MathUtils.randFloat(ap.randomBounds.min.y, ap.randomBounds.max.y),
            this.app.THREE.MathUtils.randFloat(ap.randomBounds.min.z, ap.randomBounds.max.z)
        );

        const direction = new this.app.THREE.Vector3().subVectors(ap.endPos, ap.startPos);
        const distance = direction.length();

        if (distance < 0.001) {
            console.warn("Model Autopilot: Generated a zero-movement waypoint. Holding position for this cycle.");
            ap.waypointProgress = 1.0; 
            return; 
        }

        if (this.app.vizSettings.enableCollisionAvoidance && this.app.ImagePlaneManager.landscape) {
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

        const randomRot = new this.app.THREE.Euler( (this.app.THREE.MathUtils.randFloat(0,1) - 0.5) * 0.8, (this.app.THREE.MathUtils.randFloat(0,1) - 0.5) * Math.PI, (this.app.THREE.MathUtils.randFloat(0,1) - 0.5) * 0.4 );
        ap.endQuat.setFromEuler(randomRot);
        
        const totalDistance = ap.startPos.distanceTo(ap.endPos);
        const speed = this.app.vizSettings.modelAutopilotSpeed;
        
        const baseSpeedFactor = 3.0; // Lower is faster
        const baseDuration = totalDistance / (speed * baseSpeedFactor);
        const randomVariation = this.app.THREE.MathUtils.randFloat(0.8, 1.2);
        ap.waypointTransitionDuration = Math.max(2.0, baseDuration * randomVariation); // Ensure duration is at least 2 seconds
        
        ap.holdTimer = 0.5; 
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
                console.log("Model has arrived home. Starting hold timer.");
                ap.isTransitioningToHome = false;
                ap.isHoldingAtHome = true;
                ap.homeHoldTimer = 0.5;
            } else {
                 ap.holdTimer = 0.5;
            }
        }
    },
    
    updateAutopilot(delta) {
        const ap = this.autopilot;
        
        if (ap.isHoldingAtHome) {
            ap.homeHoldTimer -= delta;
            if (ap.homeHoldTimer <= 0) {
                console.log("Home hold finished.");
                ap.isHoldingAtHome = false;
                if (ap.nextPresetId) {
                    console.log(`Resuming autopilot on preset: ${ap.nextPresetId}`);
                    this.startAutopilot(ap.nextPresetId);
                } else {
                    console.log("No next preset. Autopilot stopping fully.");
                    ap.active = false;
                    ap.preset = null;
                    if (this.app.UIManager) this.app.UIManager.updateMasterControls();
                }
            }
            return;
        }
        
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

    // ** THE FIX IS HERE: Converted to an async function that returns a Promise **
    loadGLTFModel(preset) {
        return new Promise((resolve, reject) => {
            if (!preset || !preset.path) {
                const errorMsg = "No valid GLTF model preset provided.";
                console.error(errorMsg);
                if (this.app.UIManager) this.app.UIManager.logError("Cannot load model: Invalid preset.");
                reject(new Error(errorMsg));
                return;
            }

            // Stop any current autopilot
            const ap = this.autopilot;
            ap.active = false;
            ap.preset = null;
            ap.nextPresetId = null;
            ap.isTransitioningToHome = false;
            ap.isHoldingAtHome = false;
            this.app.vizSettings.modelAutopilotOn = false;
            if (this.app.UIManager) {
                this.app.UIManager.updateMasterControls();
            }

            this.activePresetId = preset.id;
            if (this.app.UIManager) this.app.UIManager.updateModelPresetGlow();

            const loader = new GLTFLoader();
            loader.load(
                preset.path,
                (gltf) => {
                    // Cleanup old model
                    if (this.gltfModel) {
                        this.gltfModel.removeFromParent();
                    }
                    if (this.animationMixer) {
                        this.animationMixer.stopAllAction();
                        this.animationMixer = null;
                    }

                    // Setup new model
                    this.gltfModel = gltf.scene;
                    this.app.gltfModel = gltf.scene;
                    
                    this.app.scene.add(this.gltfModel);
                    
                    // Set home position, scale, and bounding sphere
                    const finalHomePos = new this.app.THREE.Vector3().copy(this.state.homePosition);
                    if (preset.homeOffset) {
                        finalHomePos.add(preset.homeOffset);
                    }
                    this.gltfModel.position.copy(finalHomePos);
                    this.state.targetPosition.copy(finalHomePos);
                    
                    const box = new this.app.THREE.Box3().setFromObject(this.gltfModel);
                    box.getBoundingSphere(this.boundingSphere);
                    
                    const size = box.getSize(new this.app.THREE.Vector3());
                    const scale = 10 / Math.max(size.x, size.y, size.z);
                    this.baseScale.set(scale, scale, scale);
                    this.gltfModel.scale.copy(this.baseScale);
                    
                    this.boundingSphere.radius *= scale;

                    // Setup animation
                    if (gltf.animations && gltf.animations.length) {
                        this.animationMixer = new this.app.THREE.AnimationMixer(this.gltfModel);
                        const action = this.animationMixer.clipAction(gltf.animations[0]);
                        action.play();
                        this.app.animationMixer = this.animationMixer;
                    }
                    
                    if (this.app.UIManager) this.app.UIManager.logSuccess(`Model loaded: ${preset.name}`);
                    
                    this.gltfModel.scale.multiplyScalar(this.app.defaultVisualizerSettings.modelScale);

                    // ** Resolve the promise on successful load **
                    resolve(this.gltfModel);
                },
                undefined, 
                (error) => {
                    const errorMsg = `GLTF Load Error: ${error.message.substring(0, 100)}...`;
                    console.error("An error happened loading GLTF:", error);
                    if (this.app.UIManager) this.app.UIManager.logError(errorMsg);
                    // ** Reject the promise on failure **
                    reject(error);
                }
            );
        });
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

        if (state.isUnderManualControl || inGracePeriod) {
            state.returnEaseFactor = 0;
        } else if (this.autopilot.active) {
            state.returnEaseFactor = 0;
            this.updateAutopilot(delta);
        } else {
            const finalHomePos = new this.app.THREE.Vector3().copy(this.state.homePosition);
            if (this.activePresetId && this.app.modelPresets[this.activePresetId]?.homeOffset) {
                finalHomePos.add(this.app.modelPresets[this.activePresetId].homeOffset);
            }
            
            const maxEase = 0.02;
            const easeIncrement = 0.0005;
            state.returnEaseFactor = Math.min(state.returnEaseFactor + easeIncrement, maxEase);
            
            state.targetPosition.lerp(finalHomePos, state.returnEaseFactor);
            state.targetQuaternion.slerp(this.state.homeQuaternion, state.returnEaseFactor);
        }
        
        if (S.enableModelSpin) {
            const spinQuaternion = new this.app.THREE.Quaternion();
            const spinAxis = new this.app.THREE.Vector3(0, 1, 0);
            spinQuaternion.setFromAxisAngle(spinAxis, S.modelSpinSpeed * delta);
            state.targetQuaternion.multiply(spinQuaternion);
        }

        this.gltfModel.position.lerp(state.targetPosition, 0.05);
        this.gltfModel.quaternion.slerp(state.targetQuaternion, 0.05);
    },
};