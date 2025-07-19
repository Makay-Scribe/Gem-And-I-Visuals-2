// REMOVED: import * as THREE from 'three';
// OrbitControls is no longer needed.
// import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const CameraManager = {
    app: null,
    // The OrbitControls instance is no longer needed.
    // _controls: null,
    
    // The viewer's eye is now fixed. This is its permanent position.
    CAMERA_POSITION: null, // Initialized in init now

    init(appInstance) {
        this.app = appInstance;
        // Initialize THREE-dependent properties in init
        this.CAMERA_POSITION = new this.app.THREE.Vector3(0, 0, 35);

        const fov = 75;
        const aspect = window.innerWidth / window.innerHeight;
        // ** THE FIX IS HERE: Changed 'near' from 0.1 to 0.001 **
        const near = 0.001;
        const far = 2000;
        this.app.camera = new this.app.THREE.PerspectiveCamera(fov, aspect, near, far); // Use app.THREE
        
        // Lock the camera's position to its permanent "home".
        this.app.camera.position.copy(this.CAMERA_POSITION);
        // The camera's default look-at is (0,0,0), which is exactly what we want.
        this.app.scene.add(this.app.camera);

        // All OrbitControls setup is removed.
    },
    
    update(delta) {
        // This function is now empty. The camera is completely static and managed
        // by its initial setup. No per-frame updates are needed for the camera itself.
    }
};