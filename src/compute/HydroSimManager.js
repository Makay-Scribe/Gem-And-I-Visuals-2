import THREE from '../three-singleton.js';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';

// Import all our shaders
import splatShader from './shaders/hydro/splat.glsl?raw';
import advectShader from './shaders/hydro/advect.glsl?raw';
import divergenceShader from './shaders/hydro/divergence.glsl?raw';
import jacobiShader from './shaders/hydro/jacobi.glsl?raw';
import gradientShader from './shaders/hydro/gradient.glsl?raw';

export const HydroSimManager = {
    app: null,
    gpuCompute: null,
    
    // --- GPGPU Variables (Data Containers ONLY) ---
    densityVariable: null,
    velocityVariable: null,
    pressureVariable: null,
    divergenceVariable: null,

    // --- Shader Materials (Our Hand Tools) ---
    splatMaterial: null,
    advectMaterial: null,
    divergenceMaterial: null,
    jacobiMaterial: null,
    gradientMaterial: null,
    
    // --- Simulation Constants ---
    SIM_RESOLUTION: 256,

    init(appInstance) {
        this.app = appInstance;
        const renderer = this.app.renderer;

        console.log("Initializing Hydro Sim Manager (Grass Roots Architecture)...");

        this.gpuCompute = new GPUComputationRenderer(this.SIM_RESOLUTION, this.SIM_RESOLUTION, renderer);

        // --- Create Textures ---
        const densityTexture = this.gpuCompute.createTexture();
        const velocityTexture = this.gpuCompute.createTexture();
        const pressureTexture = this.gpuCompute.createTexture();
        const divergenceTexture = this.gpuCompute.createTexture();
        
        // --- Create GPGPU Variables (as "Dumb" Texture Holders) ---
        // We give them a placeholder shader because addVariable requires one,
        // but we will NEVER use the material attached to these variables.
        const placeholderShader = `void main() { gl_FragColor = vec4(0.0); }`;
        this.densityVariable = this.gpuCompute.addVariable('textureDensity', placeholderShader, densityTexture);
        this.velocityVariable = this.gpuCompute.addVariable('textureVelocity', placeholderShader, velocityTexture);
        this.pressureVariable = this.gpuCompute.addVariable('texturePressure', placeholderShader, pressureTexture);
        this.divergenceVariable = this.gpuCompute.addVariable('textureDivergence', placeholderShader, divergenceTexture);

        // We explicitly state that these variables have no automatic dependencies.
        this.gpuCompute.setVariableDependencies(this.densityVariable, []);
        this.gpuCompute.setVariableDependencies(this.velocityVariable, []);
        this.gpuCompute.setVariableDependencies(this.pressureVariable, []);
        this.gpuCompute.setVariableDependencies(this.divergenceVariable, []);
        
        // --- Manually Create EVERY Material We Will Use ---
        // This guarantees every uniform exists from the start.
        this.splatMaterial = this._createShaderMaterial(splatShader, { u_target: { value: null }, u_aspectRatio: { value: 1.0 }, u_color: { value: new THREE.Vector3() }, u_point: { value: new THREE.Vector2(-1, -1) }, u_radius: { value: 0.0 } });
        this.advectMaterial = this._createShaderMaterial(advectShader, { u_velocity: { value: null }, u_source: { value: null }, u_dissipation: { value: 0.0 } });
        this.divergenceMaterial = this._createShaderMaterial(divergenceShader, { u_velocity: { value: null } });
        this.gradientMaterial = this._createShaderMaterial(gradientShader, { u_pressure: { value: null }, u_velocity: { value: null } });
        this.jacobiMaterial = this._createShaderMaterial(jacobiShader, { u_pressure: { value: null }, u_divergence: { value: null }, u_alpha: { value: -1.0 }, u_rbeta: { value: 0.25 } });
        
        const error = this.gpuCompute.init();
        if (error !== null) {
            console.error("HydroSimManager GPGPU Init Error:", error);
        } else {
            console.log("HydroSimManager GPGPU Initialized Successfully.");
        }
    },

    _createShaderMaterial(fragmentShader, uniforms = {}) {
        return new THREE.ShaderMaterial({
            uniforms: {
                resolution: { value: new THREE.Vector2(this.SIM_RESOLUTION, this.SIM_RESOLUTION) },
                u_texelSize: { value: new THREE.Vector2(1.0 / this.SIM_RESOLUTION, 1.0 / this.SIM_RESOLUTION) },
                u_deltaTime: { value: 0.0 },
                ...uniforms
            },
            vertexShader: `void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
            fragmentShader: fragmentShader,
        });
    },

    // These functions now only set uniforms on our manually created splatMaterial.
    applySplat(point, color, radius) {
        this.splatMaterial.uniforms.u_point.value.copy(point);
        this.splatMaterial.uniforms.u_color.value.copy(color);
        this.splatMaterial.uniforms.u_radius.value = radius;
    },

    applyForceSplat(point, force, radius) {
        this.splatMaterial.uniforms.u_point.value.copy(point);
        this.splatMaterial.uniforms.u_color.value.copy(force);
        this.splatMaterial.uniforms.u_radius.value = radius;
    },
    
    update(delta) {
        if (!this.gpuCompute) return;
        
        const renderer = this.app.renderer;
        const currentRenderTarget = renderer.getRenderTarget();
    
        // --- 1. Advection Pass ---
        let velSource = this.gpuCompute.getCurrentRenderTarget(this.velocityVariable);
        let velDest = this.gpuCompute.getAlternateRenderTarget(this.velocityVariable);
        this.advectMaterial.uniforms.u_velocity.value = velSource.texture;
        this.advectMaterial.uniforms.u_source.value = velSource.texture;
        this.advectMaterial.uniforms.u_dissipation.value = 0.99;
        this.advectMaterial.uniforms.u_deltaTime.value = delta;
        this.gpuCompute.doRenderTarget(this.advectMaterial, velDest);

        let densitySource = this.gpuCompute.getCurrentRenderTarget(this.densityVariable);
        let densityDest = this.gpuCompute.getAlternateRenderTarget(this.densityVariable);
        this.advectMaterial.uniforms.u_velocity.value = velDest.texture;
        this.advectMaterial.uniforms.u_source.value = densitySource.texture;
        this.advectMaterial.uniforms.u_dissipation.value = 0.998;
        this.gpuCompute.doRenderTarget(this.advectMaterial, densityDest);
    
        // --- 2. Splatting Pass ---
        const splatUniforms = this.splatMaterial.uniforms;
        if (splatUniforms.u_point.value.x > -0.5) {
            // Splat force onto the advected velocity
            splatUniforms.u_target.value = velDest.texture;
            splatUniforms.u_color.value = this.splatMaterial.uniforms.u_color.value; // Ensure correct color/force
            this.gpuCompute.doRenderTarget(this.splatMaterial, velSource); // Result in velSource

            // Splat color onto the advected density
            splatUniforms.u_target.value = densityDest.texture;
            splatUniforms.u_color.value = this.splatMaterial.uniforms.u_color.value;
            this.gpuCompute.doRenderTarget(this.splatMaterial, densitySource); // Result in densitySource
            
            splatUniforms.u_point.value.set(-1, -1);
        } else {
             // If no splat, copy results back
             this.gpuCompute.doRenderTarget(densityDest, densitySource);
             this.gpuCompute.doRenderTarget(velDest, velSource);
        }
        
        // --- 4. Divergence Pass ---
        this.divergenceMaterial.uniforms.u_velocity.value = velSource.texture;
        this.gpuCompute.doRenderTarget(this.divergenceMaterial, this.gpuCompute.getCurrentRenderTarget(this.divergenceVariable));
    
        // --- 5. Pressure Solver ---
        const pressureIterations = parseInt(document.getElementById('hydro_pressureIterations')?.value) || 20;
        let pSource = this.gpuCompute.getCurrentRenderTarget(this.pressureVariable);
        let pDest = this.gpuCompute.getAlternateRenderTarget(this.pressureVariable);
        this.jacobiMaterial.uniforms.u_divergence.value = this.gpuCompute.getCurrentRenderTarget(this.divergenceVariable).texture;
        for (let i = 0; i < pressureIterations; i++) {
            this.jacobiMaterial.uniforms.u_pressure.value = pSource.texture;
            this.gpuCompute.doRenderTarget(this.jacobiMaterial, pDest);
            let temp = pSource;
            pSource = pDest;
            pDest = temp;
        }
    
        // --- 6. Gradient Subtraction ---
        this.gradientMaterial.uniforms.u_pressure.value = pSource.texture;
        this.gradientMaterial.uniforms.u_velocity.value = velSource.texture;
        this.gpuCompute.doRenderTarget(this.gradientMaterial, velDest);
        
        // --- Final Buffer Swaps ---
        this.gpuCompute.swapBuffers(this.densityVariable);
        this.gpuCompute.swapBuffers(this.velocityVariable);
        
        renderer.setRenderTarget(currentRenderTarget);
    },

    getOutputTexture() {
        if (!this.gpuCompute || !this.densityVariable) return null;
        return this.gpuCompute.getCurrentRenderTarget(this.densityVariable).texture;
    },

    dispose() {
        if (this.gpuCompute) {
            this.gpuCompute.dispose();
            this.gpuCompute = null;
            console.log("HydroSimManager disposed.");
        }
    }
};

GPUComputationRenderer.prototype.swapBuffers = function(variable) {
    variable.currentTextureIndex = 1 - variable.currentTextureIndex;
};