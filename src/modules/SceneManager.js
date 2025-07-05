import * as THREE from 'three';

export const SceneManager = {
    app: null,

    init(appInstance) {
        this.app = appInstance;
        this.app.scene = new THREE.Scene();
        
        // FIX: Set the main scene's background to null (transparent).
        // This prevents it from drawing a solid color over our dedicated background scene.
        this.app.scene.background = null;

        // Basic lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.app.scene.add(ambientLight);

        this.app.directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        this.app.directionalLight.position.set(5, 10, 7.5);
        this.app.scene.add(this.app.directionalLight);
        
        // Environment map loading is temporarily disabled to prevent WebGL warnings.
        // We will re-enable this in a more controlled way later.
        this.app.scene.environment = null; 
        console.log("SceneManager initialized. Main scene background is transparent.");
    },

    update(delta) {
        // Any scene-specific updates can go here
    }
};