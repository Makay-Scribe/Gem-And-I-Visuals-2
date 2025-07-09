import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const ModelManager = {
    app: null,
    gltfModel: null,
    animationMixer: null,
    baseScale: new THREE.Vector3(1, 1, 1),
    boundingSphere: new THREE.Sphere(),
    _waypointRetryCount: 0, // Counter to prevent infinite loops
    
    autopilot: {
        active: false,
        preset: null,
        startPos: new THREE.Vector3(),
        endPos: new THREE.Vector3(),
        startQuat: new THREE.Quaternion(),
        endQuat: new THREE.Quaternion(),
        waypointProgress: 0,
        waypointTransitionDuration: 15.0,
        holdTimer: 0,
        randomBounds: null,
    },

    init(appInstance) {
        this.app = appInstance;
        console.log("ModelManager initialized.");
    },

    startAutopilot(presetId) {
        if (!this.gltfModel) return;
        this.autopilot.active = true;
        this.autopilot.preset = presetId;
        this.autopilot.waypointProgress = 0;
        this.autopilot.holdTimer = 0;

        const homePosition = this.app.vizSettings.homePositionModel;

        const boundsSize = new THREE.Vector3(40, 30, 30);
        this.autopilot.randomBounds = new THREE.Box3(
            homePosition.clone().sub(boundsSize),
            homePosition.clone().add(boundsSize)
        );

        if (presetId === 'autopilotPreset3' || presetId === 'autopilotPreset4') {
             this.autopilot.randomBounds.expandByVector(new THREE.Vector3(20, 15, 20));
        }

        this.generateNewRandomWaypoint();
        console.log(`Model Autopilot STARTED with preset: ${presetId}`);
    },

    stopAutopilot() {
        if (!this.gltfModel) return;
        this.autopilot.active = false;
        this.autopilot.preset = null;
        
        this.autopilot.startPos.copy(this.gltfModel.position);
        this.autopilot.endPos.copy(this.app.vizSettings.homePositionModel);
        this.autopilot.startQuat.copy(this.gltfModel.quaternion);
        this.autopilot.endQuat.set(0, 0, 0, 1);
        this.autopilot.waypointProgress = 0;
        this.autopilot.waypointTransitionDuration = 2.0;
        
        console.log("Model Autopilot STOPPING, returning to home position.");
    },

    generateNewRandomWaypoint() {
        const ap = this.autopilot;
        if (!this.gltfModel) return;

        ap.startPos.copy(this.gltfModel.position);
        ap.startQuat.copy(this.gltfModel.quaternion);

        ap.endPos.set(
            THREE.MathUtils.randFloat(ap.randomBounds.min.x, ap.randomBounds.max.x),
            THREE.MathUtils.randFloat(ap.randomBounds.min.y, ap.randomBounds.max.y),
            THREE.MathUtils.randFloat(ap.randomBounds.min.z, ap.randomBounds.max.z)
        );
        
        if (this.app.vizSettings.enableCollisionAvoidance && this.app.ImagePlaneManager.landscape) {
            const landscapeSphere = new THREE.Sphere();
            this.app.ImagePlaneManager.boundingBox.getBoundingSphere(landscapeSphere);
            
            landscapeSphere.radius *= 1.1;

            if (landscapeSphere.containsPoint(ap.endPos)) {
                if (this._waypointRetryCount < 1) {
                    console.log("Model waypoint collision detected. Retrying once...");
                    this._waypointRetryCount++;
                    this.generateNewRandomWaypoint(); 
                    return; 
                } else {
                    console.warn("Model waypoint collision retry failed. Allowing pass-through.");
                }
            }
        }
        this._waypointRetryCount = 0; 

        const targetLookAt = new THREE.Vector3(0,0,0);
        const tempMatrix = new THREE.Matrix4().lookAt(ap.endPos, targetLookAt, this.gltfModel.up);
        const randomRoll = (Math.random() - 0.5) * 0.8;
        const rotOffset = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, randomRoll));
        ap.endQuat.setFromRotationMatrix(tempMatrix).multiply(rotOffset);
        
        const distance = ap.startPos.distanceTo(ap.endPos);
        ap.waypointTransitionDuration = THREE.MathUtils.clamp(distance / (this.app.vizSettings.modelAutopilotSpeed * 0.5), 5, 15);
        ap.holdTimer = Math.random() * 5.0;
        ap.waypointProgress = 0;
    },
    
    updateAutopilot(delta) {
        const ap = this.autopilot;
        if (!this.gltfModel) return;
        
        if (ap.holdTimer > 0) {
            ap.holdTimer -= delta;
        } else if (ap.waypointProgress < 1.0) {
            ap.waypointProgress = Math.min(1.0, ap.waypointProgress + delta / ap.waypointTransitionDuration);
            const ease = 0.5 - 0.5 * Math.cos(ap.waypointProgress * Math.PI);
            
            this.gltfModel.position.lerpVectors(ap.startPos, ap.endPos, ease);
            this.gltfModel.quaternion.slerpQuaternions(ap.startQuat, ap.endQuat, ease);
        } else {
            if (ap.preset !== null) {
                this.generateNewRandomWaypoint();
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
                this.gltfModel.position.set(0, 0, 0); 
                
                // ** THE FIX IS HERE **: Removed the lines that forcibly switched control.
                // The app will now respect the default control set in main.js at startup.
                // this.app.switchActiveControl(null);
                // this.app.switchActiveControl('model');

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
        
        this.gltfModel.scale.copy(this.baseScale).multiplyScalar(S.modelScale);
        
        if (this.autopilot.active) {
            this.updateAutopilot(delta);
        } else if (S.enableModelSpin) {
            this.gltfModel.rotation.y += S.modelSpinSpeed * delta;
        }
    },
};