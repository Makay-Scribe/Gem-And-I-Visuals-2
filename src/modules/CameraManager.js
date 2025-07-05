import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const CameraManager = {
    app: null,
    _controls: null,
    _autopilot: {
        active: false,
        mode: 'stage',
        speed: 1.0,
        targetPosition: new THREE.Vector3(),
        targetLookAt: new THREE.Vector3()
    },
    _masterReturnTransition: {
        active: false,
        targetPos: new THREE.Vector3(0, 0, 30),
        targetLook: new THREE.Vector3(0, 0, 0)
    },
    
    init(appInstance) {
        this.app = appInstance;
        
        // --- FIX: Create the camera FIRST ---
        // Create the main camera and add it to the app instance.
        const fov = this.app.vizSettings.cameraFOV;
        const aspect = window.innerWidth / window.innerHeight;
        const near = 0.1;
        const far = 2000;
        this.app.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        this.app.camera.position.set(0, 0, 30); // Set initial position
        this.app.scene.add(this.app.camera); // Add camera to the scene

        console.log("Camera created and added to the scene.");

        // --- Now create the controls, using the camera we just made ---
        this._controls = new OrbitControls(this.app.camera, this.app.renderer.domElement);
        this._controls.enableDamping = true;
        this._controls.dampingFactor = 0.05;
        this._controls.screenSpacePanning = false;
        this._controls.minDistance = 1;
        this._controls.maxDistance = 1000;
        this._controls.target.set(0, 0, 0);

        this.setMode(this.app.vizSettings.cameraControlMode);
        console.log("CameraManager initialized with OrbitControls.");
    },

    setMode(mode) {
        if (!this._controls) return;
        this.app.vizSettings.cameraControlMode = mode;
        switch (mode) {
            case 'manual':
                this._controls.enabled = true;
                this._autopilot.active = false;
                break;
            case 'autopilot':
                this._controls.enabled = false;
                this._autopilot.active = true;
                break;
            // Add other cases as needed
        }
    },

    update(delta) {
        if (this._autopilot.active) {
            // Autopilot logic will go here
        }
        
        if (this._masterReturnTransition.active) {
            const posArrived = this.app.camera.position.distanceTo(this._masterReturnTransition.targetPos) < 0.1;
            const lookArrived = this._controls.target.distanceTo(this._masterReturnTransition.targetLook) < 0.1;

            if (posArrived && lookArrived) {
                this._masterReturnTransition.active = false;
                console.log("Camera has returned to home position.");
            } else {
                this.app.camera.position.lerp(this._masterReturnTransition.targetPos, 0.05);
                this._controls.target.lerp(this._masterReturnTransition.targetLook, 0.05);
            }
        }
        
        if (this._controls.enabled) {
            this._controls.update();
        }
    },

    returnToHome() {
        this._masterReturnTransition.active = true;
        this._masterReturnTransition.targetPos.set(0, this.app.vizSettings.cameraHeight, this.app.vizSettings.cameraDistance);
        // --- FIX: Corrected typo from _masteroposition to _masterReturnTransition ---
        this._masterReturnTransition.targetLook.set(0, this.app.vizSettings.cameraLookAtY, 0);
        this.setMode('manual');
        this._controls.enabled = false; // Disable user control during transition
    }
};