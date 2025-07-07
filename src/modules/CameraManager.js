import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const CameraManager = {
    app: null,
    _controls: null,
    
    // The viewer's eye is now fixed. This is its permanent position.
    CAMERA_POSITION: new THREE.Vector3(0, 0, 35),

    init(appInstance) {
        this.app = appInstance;
        
        const fov = 75;
        const aspect = window.innerWidth / window.innerHeight;
        const near = 0.1;
        const far = 2000;
        this.app.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        
        // Lock the camera's position to its permanent "home".
        this.app.camera.position.copy(this.CAMERA_POSITION);
        this.app.scene.add(this.app.camera);

        this._controls = new OrbitControls(this.app.camera, this.app.renderer.domElement);
        this._controls.enableDamping = true;
        this._controls.dampingFactor = 0.1;

        // The controls are disabled for user input. They are only used
        // programmatically for smooth damping of the lookAt target.
        this._controls.enabled = false;
    },
    
    // The setLookAt function is removed. The main animate loop will now directly control the lerp.

    update(delta) {
        // The only remaining job is to update the controls for damping,
        // which gives the "lookAt" movement a smooth feeling.
        this._controls.update();
    }
};