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
        
        const fov = this.app.vizSettings.cameraFOV;
        const aspect = window.innerWidth / window.innerHeight;
        const near = 0.1;
        const far = 2000;
        this.app.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        this.app.camera.position.set(0, 0, 30); 
        this.app.scene.add(this.app.camera); 

        console.log("Camera created and added to the scene.");

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
        this._autopilot.active = false; 
        
        switch (mode) {
            case 'manual':
            case 'autopilot':
                // In these modes, the camera is passive. The mouse should not control it.
                this._controls.enabled = false;
                break;
            case 'freelook':
                // In this mode, the mouse has full control.
                this._controls.enabled = true;
                break;
        }
    },

    update(delta) {
        const S = this.app.vizSettings;
        
        // This manager no longer moves the camera based on sliders.
        // It only handles freelook updates, master transitions, and autopilot.

        if (S.cameraControlMode === 'freelook') {
            if(this.app.UIManager) this.app.UIManager.updateFreeLookSlidersFromCamera();
        } else if (this._autopilot.active) {
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
        
        // Always update controls to apply damping.
        this._controls.update();
    },

    returnToHome() {
        this._masterReturnTransition.active = true;
        // Use a fixed home position, not one derived from sliders.
        this._masterReturnTransition.targetPos.set(0, 0, 30);
        this._masterReturnTransition.targetLook.set(0, 0, 0);
        this.setMode('manual');
        this._controls.enabled = false;
    }
};