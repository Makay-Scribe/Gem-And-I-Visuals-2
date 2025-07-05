import * as THREE from 'three';

export const SceneManager = {
    app: null,

    init(appInstance) {
        this.app = appInstance;
        this.app.scene = new THREE.Scene();
        
        // FIX: Set the main scene's background to null (transparent).
        // This prevents it from drawing a solid color over our dedicated background scene.
        this.app.scene.background = null;

        // The scene's lighting environment will now be set by the BackgroundManager
        // which will handle loading the HDRI for reflections.
        this.app.scene.environment = null; 
        console.log("SceneManager initialized. Main scene background is transparent.");
    },

    update(delta) {
        // Any scene-specific updates can go here
    }
};