import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const ModelManager = {
    app: null,
    gltfModel: null,
    animationMixer: null,
    baseScale: new THREE.Vector3(1, 1, 1),
    boundingSphere: new THREE.Sphere(), // For collision detection

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
                box.getBoundingSphere(this.boundingSphere); // Calculate the bounding sphere for collision detection
                
                const size = box.getSize(new THREE.Vector3());
                const scale = 10 / Math.max(size.x, size.y, size.z);
                this.baseScale.set(scale, scale, scale);
                this.gltfModel.scale.copy(this.baseScale);
                
                this.boundingSphere.radius *= scale; // Scale the sphere radius too

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

    startAutopilot(presetId) {
        if (!this.gltfModel) return;
        const ap = this.autopilot;
        
        ap.isTransitioningIn = true;
        ap.transitionProgress = 0;
        ap.transitionStartPos.copy(this.gltfModel.position);
        ap.transitionStartQuat.copy(this.gltfModel.quaternion);
        ap.active = false;
        ap.mode = presetId;
        ap.subMode = null;

        const boundsSize = new THREE.Vector3(30, 20, 20);
        ap.randomBounds = new THREE.Box3(
            this.homePosition.clone().sub(boundsSize),
            this.homePosition.clone().add(boundsSize)
        );

        if (presetId === 'autopilotPreset1') {
            ap.randomBounds.min.z = this.app.camera.position.z - 5;
            ap.randomBounds.max.z = this.homePosition.z + 20;
        } else if (presetId === 'autopilotPreset2') {
            ap.subMode = 'roaming';
        } else if (presetId === 'autopilotPreset3' || presetId === 'autopilotPreset4') {
             ap.randomBounds.expandByVector(new THREE.Vector3(15, 10, 15));
        }
        console.log(`Model autopilot started with preset: ${presetId}`);
    },
    
    generateNewRandomWaypoint(options = {}) {
        const { aerobatics = false, audioReactive = false } = options;
        const ap = this.autopilot;
        const audio = this.app.AudioProcessor;

        ap.startPosition.copy(this.gltfModel.position);
        ap.startQuaternion.copy(this.gltfModel.quaternion);
        
        ap.targetPosition.set(
            THREE.MathUtils.randFloat(ap.randomBounds.min.x, ap.randomBounds.max.x),
            THREE.MathUtils.randFloat(ap.randomBounds.min.y, ap.randomBounds.max.y),
            THREE.MathUtils.randFloat(ap.randomBounds.min.z, ap.randomBounds.max.z)
        );

        const tempMatrix = new THREE.Matrix4();
        tempMatrix.lookAt(ap.targetPosition, ap.startPosition, this.gltfModel.up);
        ap.targetQuaternion.setFromRotationMatrix(tempMatrix);

        if (aerobatics) {
            let rollAmount = (Math.random() - 0.5) * Math.PI;
            if (audioReactive && audio.triggers.beat) {
                rollAmount = (Math.random() > 0.5 ? 1 : -1) * Math.PI * 2.5;
            }
            const rollQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rollAmount);
            ap.targetQuaternion.multiply(rollQuat);
        }
        
        ap.transitionProgress = 0;
        
        if(audioReactive) {
            ap.waypointTransitionDuration = Math.max(1, 15 / (1 + audio.energy.overall * 5));
            ap.holdTimer = Math.max(0, ap.holdDuration / (1 + audio.energy.overall * 3));
        } else {
            ap.waypointTransitionDuration = 15.0;
            ap.holdTimer = ap.holdDuration * Math.random();
        }
    },

    generateObserveWaypoint() {
        const ap = this.autopilot;
        ap.startPosition.copy(this.gltfModel.position);
        ap.startQuaternion.copy(this.gltfModel.quaternion);

        const landscapePos = this.app.ImagePlaneManager.landscape.position;
        const offset = new THREE.Vector3((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 10 - 5);
        ap.targetPosition.copy(landscapePos).add(offset);
        
        const tempMatrix = new THREE.Matrix4();
        tempMatrix.lookAt(landscapePos, ap.startPosition, this.gltfModel.up);
        ap.targetQuaternion.setFromRotationMatrix(tempMatrix);

        ap.transitionProgress = 0;
        ap.holdTimer = ap.holdDuration * (1 + Math.random());
    },

    stopAutopilot() {
        this.autopilot.active = false;
        this.autopilot.isTransitioningIn = false;
        this.autopilot.mode = null;
        console.log("Model autopilot stopped.");
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
        const ap = this.autopilot;
        const landscapeBox = this.app.ImagePlaneManager.boundingBox;
        
        this.gltfModel.visible = S.enableModel;
        if (!this.gltfModel.visible) {
            if(ap.active) this.stopAutopilot();
            return;
        }
        
        this.gltfModel.scale.copy(this.baseScale).multiplyScalar(S.modelScale);
        const speed = S.modelAutopilotSpeed;
        const finalPosition = new THREE.Vector3(); // A temporary vector for calculations

        if (ap.isTransitioningIn) {
            ap.transitionProgress = Math.min(1.0, ap.transitionProgress + (delta * speed) / ap.transitionDuration);
            const ease = 0.5 - 0.5 * Math.cos(ap.transitionProgress * Math.PI);
            finalPosition.lerpVectors(ap.transitionStartPos, this.homePosition, ease);
            this.gltfModel.quaternion.slerpQuaternions(ap.transitionStartQuat, new THREE.Quaternion(), ease);
            if (ap.transitionProgress >= 1.0) {
                ap.isTransitioningIn = false;
                ap.active = true;
                this.generateNewRandomWaypoint({ aerobatics: (ap.mode === 'autopilotPreset3' || ap.mode === 'autopilotPreset4'), audioReactive: ap.mode === 'autopilotPreset4' });
            }
        } else if (S.modelAutopilotOn && ap.active) {
            if (ap.holdTimer > 0) {
                ap.holdTimer -= delta;
            } else if (ap.transitionProgress < 1.0) {
                const duration = Math.max(0.1, ap.waypointTransitionDuration);
                ap.transitionProgress = Math.min(1.0, ap.transitionProgress + (delta * speed) / duration);
                const easeProgress = 0.5 - 0.5 * Math.cos(ap.transitionProgress * Math.PI);
                
                finalPosition.lerpVectors(ap.startPosition, ap.targetPosition, easeProgress);
                const modelSphereAtNextPos = this.boundingSphere.clone().set(finalPosition, this.boundingSphere.radius * S.modelScale);
                
                if (this.app.ImagePlaneManager.landscape.visible && landscapeBox.intersectsSphere(modelSphereAtNextPos)) {
                    console.log("Collision Detected! Deflecting...");
                    this.generateNewRandomWaypoint({ aerobatics: (ap.mode === 'autopilotPreset3' || ap.mode === 'autopilotPreset4'), audioReactive: ap.mode === 'autopilotPreset4' });
                } else {
                    this.gltfModel.quaternion.slerpQuaternions(ap.startQuaternion, ap.targetQuaternion, easeProgress);
                }
            } else {
                 if (ap.mode === 'autopilotPreset1' || ap.mode === 'autopilotPreset3' || ap.mode === 'autopilotPreset4') {
                    this.generateNewRandomWaypoint({ aerobatics: (ap.mode === 'autopilotPreset3' || ap.mode === 'autopilotPreset4'), audioReactive: ap.mode === 'autopilotPreset4' });
                } else if (ap.mode === 'autopilotPreset2') {
                    ap.subMode = (ap.subMode === 'roaming') ? 'observing' : 'roaming';
                    if (ap.subMode === 'roaming') this.generateNewRandomWaypoint({ aerobatics: false });
                    else this.generateObserveWaypoint();
                }
            }
        } else {
            if (S.activeControl === 'model') {
                 if (this.transition.active) {
                    this.transition.progress = Math.min(1.0, this.transition.progress + delta / this.transition.duration);
                    const ease = 0.5 - 0.5 * Math.cos(this.transition.progress * Math.PI);
                    finalPosition.lerpVectors(this.transition.start, this.transition.end, ease);
                    if (this.transition.progress >= 1.0) {
                        this.transition.active = false;
                    }
                } else {
                    finalPosition.copy(S.manualModelPosition);
                }
            }
        }

        // Apply final position
        if(!S.modelAutopilotOn || (S.modelAutopilotOn && !ap.holdTimer > 0)) {
             this.gltfModel.position.copy(finalPosition);
        }

        if (S.enableModelSpin && !S.modelAutopilotOn) {
            this.gltfModel.rotation.y += S.modelSpinSpeed * delta;
        }
    }
};