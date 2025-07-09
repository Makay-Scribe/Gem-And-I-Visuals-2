import * as THREE from 'three';
// OrbitControls is no longer needed.
// import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const CameraManager = {
    app: null,
    // The OrbitControls instance is no longer needed.
    // _controls: null,
    
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
        // The camera's default look-at is (0,0,0), which is exactly what we want.
        this.app.scene.add(this.app.camera);

        // All OrbitControls setup is removed.
    },
    
    update(delta) {
        // This function is now empty. The camera is completely static and managed
        // by its initial setup. No per-frame updates are needed for the camera itself.
    }
};