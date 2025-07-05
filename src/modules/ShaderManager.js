import * as THREE from 'three';

export const ShaderManager = {
    app: null,
    
    init(appInstance) {
        this.app = appInstance;
        console.log("ShaderManager initialized.");
    },

    loadUserShader() {
        const userFragmentShader = this.app.vizSettings.shaderToyGLSL;
        if (!userFragmentShader) {
            console.warn("No ShaderToy GLSL provided.");
            return;
        }
        
        // The responsibility of ShaderManager is now just to pass the loaded GLSL
        // to the BackgroundManager, which controls its own material.
        if (this.app.BackgroundManager) {
            this.app.BackgroundManager.updateShader(userFragmentShader);
            console.log("ShaderManager passed new GLSL to BackgroundManager.");
        } else {
            console.error("ShaderManager: BackgroundManager not found to update shader.");
        }
    },
};