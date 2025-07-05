import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Debugger } from './Debugger.js';

export const ModelManager = {
    app: null,
    gltfModel: null,
    animationMixer: null,
    initialScale: null,
    homePosition: null,
    modelPivot: null, 

    autopilot: {
        active: false,
        speed: 0.1, 
        progress: 0,
        startPosition: null,
        targetPosition: null,
        constraints: {
            distance: { min: 10.0, max: 40.0 },
            height: { min: -10.0, max: 20.0 },
        } 
    },

    init(appInstance) {
        this.app = appInstance;
        const THREE = this.app.THREE;
        this.autopilot.startPosition = new THREE.Vector3();
        this.autopilot.targetPosition = new THREE.Vector3();
        this.initialScale = new THREE.Vector3(1, 1, 1);
        this.homePosition = new THREE.Vector3(0, -10, 15); 
        this.modelPivot = new THREE.Group();
        this.app.scene.add(this.modelPivot); // Add pivot to scene at init
    },

    reparentModel(newParent) {
        if (!this.gltfModel || !this.gltfModel.parent) return;
        newParent.attach(this.gltfModel);
    },

    setPositionFromSliders(distance, height) {
        if (!this.gltfModel) return;
        const THREE = this.app.THREE;

        if (this.gltfModel.parent !== this.app.scene) {
            this.reparentModel(this.app.scene);
        }
        
        const newPos = new THREE.Vector3(this.gltfModel.position.x, height, distance);
        this.gltfModel.position.copy(newPos);
    },

    returnToHome() {
        if (!this.gltfModel) return;
        if (this.gltfModel.parent !== this.app.scene) {
            this.reparentModel(this.app.scene);
        }
        this.autopilot.startPosition.copy(this.gltfModel.position);
        this.autopilot.targetPosition.copy(this.homePosition);
        this.autopilot.progress = 0;
        this.autopilot.active = true;
    },

    generateNewWaypoint() {
        if (!this.gltfModel) return;
        if (this.gltfModel.parent !== this.app.scene) {
            this.reparentModel(this.app.scene);
        }
        const THREE = this.app.THREE;
        const { constraints } = this.autopilot;
        this.autopilot.startPosition.copy(this.gltfModel.position);
        const distance = THREE.MathUtils.randFloat(constraints.distance.min, constraints.distance.max);
        const height = THREE.MathUtils.randFloat(constraints.height.min, constraints.height.max);
        const safeDistance = Math.max(distance, Math.abs(height) + 0.1);
        const horizontalRadius = Math.sqrt(safeDistance * safeDistance - height * height);
        const angle = Math.random() * Math.PI * 2; 
        const x = horizontalRadius * Math.cos(angle);
        const z = horizontalRadius * Math.sin(angle);
        this.autopilot.targetPosition.set(x, height, z);
        this.autopilot.progress = 0;
        this.autopilot.active = true;
    },

    loadGLTFModel(fileOrPath) {
        const THREE = this.app.THREE;
        const loader = new GLTFLoader();
        
        const onModelLoad = (gltf) => {
            if (this.gltfModel) {
                this.gltfModel.removeFromParent();
            }
            if (this.animationMixer) {
                this.animationMixer.stopAllAction();
                this.animationMixer = null;
            }
            const model = gltf.scene;
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            const largestDim = Math.max(size.x, size.y, size.z);
            const targetSize = 20.0;
            const scale = largestDim > 0 ? targetSize / largestDim : 1.0;
            model.scale.set(scale, scale, scale);
            
            model.position.copy(this.homePosition);
            model.position.sub(center.multiplyScalar(scale));
            
            if (gltf.animations && gltf.animations.length) {
                this.animationMixer = new THREE.AnimationMixer(model);
                const action = this.animationMixer.clipAction(gltf.animations[0]);
                action.play();
                this.app.animationMixer = this.animationMixer;
            }
            
            this.gltfModel = model;
            this.app.gltfModel = model;
            this.app.scene.add(this.gltfModel); // Start as a child of the scene
            this.gltfModel.visible = this.app.vizSettings.enableModel;
            document.getElementById('enableModel').checked = this.app.vizSettings.enableModel;
            this.app.SceneManager.updateEnvironment();
            this.app.UIManager.logSuccess(`Model loaded: ${fileOrPath.name || fileOrPath}`);
        };
        const onModelError = (error) => {
            console.error('An error happened loading GLTF:', error);
            this.app.UIManager.logError('Failed to load GLTF.');
        };

        if (typeof fileOrPath === 'string') {
            loader.load(fileOrPath, onModelLoad, undefined, onModelError);
        } else {
            const objectURL = URL.createObjectURL(fileOrPath);
            loader.load(objectURL, (gltf) => {
                onModelLoad(gltf);
                URL.revokeObjectURL(objectURL);
            }, undefined, onModelError);
        }
    },

    updateLiveSliders() {
        if (!this.gltfModel) return;
        const THREE = this.app.THREE;
        const worldPosition = new THREE.Vector3();
        this.gltfModel.getWorldPosition(worldPosition);
        const distance = worldPosition.length();
        const height = worldPosition.y;
        document.getElementById('modelLiveDistance').value = distance;
        document.getElementById('modelLiveHeight').value = height;
        this.app.UIManager.updateRangeDisplay('modelLiveDistance', distance);
        this.app.UIManager.updateRangeDisplay('modelLiveHeight', height);
    },

    update(cappedDelta) {
        if (!this.gltfModel) return;

        const S = this.app.vizSettings;
        this.gltfModel.visible = S.enableModel;

        if (!this.gltfModel.visible) return;

        this.updateLiveSliders();
        
        const isPosingWithSliders = S.cameraTarget === 'model' && S.cameraControlMode === 'manual';
        const isOverridingDistance = S.enableModelDistancePlus || S.enableModelDistanceMinus;

        // --- Distance Override (Continuous Dolly) ---
        if (isOverridingDistance) {
            if (this.gltfModel.parent !== this.app.scene) {
                this.reparentModel(this.app.scene);
            }
            
            const dollySpeed = 10.0;
            let dollyAmount = 0;

            if (S.enableModelDistancePlus) {
                dollyAmount = -1 * dollySpeed * cappedDelta; 
            } else if (S.enableModelDistanceMinus) {
                dollyAmount = 1 * dollySpeed * cappedDelta;
            }
            
            this.gltfModel.position.z += dollyAmount;
        }

        if (S.enableModelSpin) {
            this.gltfModel.rotateY(S.modelSpinSpeed * cappedDelta);
        }
        
        // Autopilot should be paused if we are posing with sliders or overriding distance
        if (isPosingWithSliders || isOverridingDistance) {
             this.autopilot.active = false;
        }
        
        if (isPosingWithSliders) {
            if (this.gltfModel.parent !== this.app.scene) {
                this.reparentModel(this.app.scene);
            }
            this.setPositionFromSliders(S.cameraDistance, S.cameraHeight);
            return; 
        }

        if (S.enableModelAutopilot && S.modelAutopilotMode === 'orbitCenter') {
            // Ensure model is parented to the pivot for orbiting
            if (this.gltfModel.parent !== this.modelPivot) {
                this.reparentModel(this.modelPivot);
            }
            const orbitSpeed = S.modelAutopilotSpeed * 0.5;
            this.modelPivot.rotation.y += orbitSpeed * cappedDelta;

        } else if (this.autopilot.active) {
            // Ensure model is parented to the scene for waypoint travel
            if (this.gltfModel.parent !== this.app.scene) {
                this.reparentModel(this.app.scene);
            }
            this.autopilot.speed = S.modelAutopilotSpeed;
            const distanceToTarget = this.autopilot.startPosition.distanceTo(this.autopilot.targetPosition);
            if (distanceToTarget > 0.01) {
                this.autopilot.progress += (this.autopilot.speed * 2.0 * cappedDelta) / distanceToTarget;
            } else {
                this.autopilot.progress = 1.0;
            }
            if (this.autopilot.progress >= 1.0) {
                this.gltfModel.position.copy(this.autopilot.targetPosition);
                this.autopilot.active = false;
            } else {
                const easedProgress = 1 - Math.pow(1 - Math.min(1.0, this.autopilot.progress), 3);
                this.gltfModel.position.lerpVectors(this.autopilot.startPosition, this.autopilot.targetPosition, easedProgress);
            }
        } else if (S.enableModelAutopilot) {
            if (S.modelAutopilotMode === 'random') {
                this.generateNewWaypoint();
            } else if (S.modelAutopilotMode === 'returnHome') {
                if (this.gltfModel.position.distanceTo(this.homePosition) > 0.1) {
                    this.returnToHome();
                }
            }
        }
    }
};