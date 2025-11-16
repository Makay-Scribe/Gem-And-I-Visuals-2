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
    
    // --- Interaction State ---
    _splatQueue: [],
    _splatColorVec4: new THREE.Vector4(), // Reusable vector to avoid creating new objects in the loop

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
        const placeholderShader = `void main() { gl_FragColor = vec4(0.0); }`;
        this.densityVariable = this.gpuCompute.addVariable('textureDensity', placeholderShader, densityTexture);
        this.velocityVariable = this.gpuCompute.addVariable('textureVelocity', placeholderShader, velocityTexture);
        this.pressureVariable = this.gpuCompute.addVariable('texturePressure', placeholderShader, pressureTexture);
        this.divergenceVariable = this.gpuCompute.addVariable('textureDivergence', placeholderShader, divergenceTexture);

        this.gpuCompute.setVariableDependencies(this.densityVariable, []);
        this.gpuCompute.setVariableDependencies(this.velocityVariable, []);
        this.gpuCompute.setVariableDependencies(this.pressureVariable, []);
        this.gpuCompute.setVariableDependencies(this.divergenceVariable, []);
        
        // --- Manually Create EVERY Material We Will Use ---
        // ** THE FIX IS HERE: u_color is now a vec4 for better data integrity **
        this.splatMaterial = this._createShaderMaterial(splatShader, { u_target: { value: null }, u_aspectRatio: { value: 1.0 }, u_color: { value: new THREE.Vector4() }, u_point: { value: new THREE.Vector2() }, u_radius: { value: 0.0 } });
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
    
    applySplat(point, color, radius) {
        // console.log(`Applying splat: UV(${point.x.toFixed(2)}, ${point.y.toFixed(2)}), Color(${color.x.toFixed(2)}, ${color.y.toFixed(2)}, ${color.z.toFixed(2)}), Radius(${radius})`);
        this._splatQueue.push({
            point: point.clone(),
            color: color.clone(),
            radius: radius,
            isForce: false
        });
    },

    applyForceSplat(point, force, radius) {
        // console.log(`Applying force: UV(${point.x.toFixed(2)}, ${point.y.toFixed(2)}), Force(${force.x.toFixed(2)}, ${force.y.toFixed(2)}), Radius(${radius})`);
        this._splatQueue.push({
            point: point.clone(),
            color: force.clone(), // color uniform is used for force vector
            radius: radius,
            isForce: true
        });
    },
    
    update(delta) {
        if (!this.gpuCompute) return;
        
        const renderer = this.app.renderer;
        const currentRenderTarget = renderer.getRenderTarget();
    
        // 1. Advection Pass (move existing velocity and density through the velocity field)
        let velSource = this.gpuCompute.getCurrentRenderTarget(this.velocityVariable);
        let velDest = this.gpuCompute.getAlternateRenderTarget(this.velocityVariable);
        this.advectMaterial.uniforms.u_velocity.value = velSource.texture;
        this.advectMaterial.uniforms.u_source.value = velSource.texture;
        this.advectMaterial.uniforms.u_dissipation.value = 0.99; // Velocity dissipates slowly
        this.advectMaterial.uniforms.u_deltaTime.value = delta;
        this.gpuCompute.doRenderTarget(this.advectMaterial, velDest);

        let densitySource = this.gpuCompute.getCurrentRenderTarget(this.densityVariable);
        let densityDest = this.gpuCompute.getAlternateRenderTarget(this.densityVariable);
        this.advectMaterial.uniforms.u_velocity.value = velDest.texture; // Use the newly advected velocity
        this.advectMaterial.uniforms.u_source.value = densitySource.texture;
        this.advectMaterial.uniforms.u_dissipation.value = 0.998; // Density dissipates very slowly
        this.gpuCompute.doRenderTarget(this.advectMaterial, densityDest);
    
        // Swap buffers so the results of advection are now the "source" for the next steps
        this.gpuCompute.swapBuffers(this.velocityVariable);
        this.gpuCompute.swapBuffers(this.densityVariable);
        

        // 2. Splatting Pass (add new forces and density from the queue)
        // ** THE FIX IS HERE: Refactored splatting to be correct and more efficient. **
        const splatUniforms = this.splatMaterial.uniforms;
        
        // Process force splats on the velocity texture
        this._splatQueue.forEach(splat => {
            if (!splat.isForce) return;

            splatUniforms.u_point.value.copy(splat.point);
            splatUniforms.u_radius.value = splat.radius;
            this._splatColorVec4.set(splat.color.x, splat.color.y, splat.color.z, 0.0); // Set w to 0 for forces
            splatUniforms.u_color.value.copy(this._splatColorVec4);
            
            let source = this.gpuCompute.getCurrentRenderTarget(this.velocityVariable);
            let dest = this.gpuCompute.getAlternateRenderTarget(this.velocityVariable);
            splatUniforms.u_target.value = source.texture;
            this.gpuCompute.doRenderTarget(this.splatMaterial, dest);
            this.gpuCompute.swapBuffers(this.velocityVariable);
        });

        // Process color splats on the density texture
        this._splatQueue.forEach(splat => {
            if (splat.isForce) return;
            
            splatUniforms.u_point.value.copy(splat.point);
            splatUniforms.u_radius.value = splat.radius;
            this._splatColorVec4.set(splat.color.x, splat.color.y, splat.color.z, 1.0); // Set w to 1 for colors
            splatUniforms.u_color.value.copy(this._splatColorVec4);

            let source = this.gpuCompute.getCurrentRenderTarget(this.densityVariable);
            let dest = this.gpuCompute.getAlternateRenderTarget(this.densityVariable);
            splatUniforms.u_target.value = source.texture;
            this.gpuCompute.doRenderTarget(this.splatMaterial, dest);
            this.gpuCompute.swapBuffers(this.densityVariable);
        });

        this._splatQueue = []; // Clear the queue after processing

        // After splatting, get the final source textures for the next steps
        let finalVelSource = this.gpuCompute.getCurrentRenderTarget(this.velocityVariable);
        
        // 4. Divergence Pass (calculate how much velocity is expanding/converging)
        this.divergenceMaterial.uniforms.u_velocity.value = finalVelSource.texture;
        this.gpuCompute.doRenderTarget(this.divergenceMaterial, this.gpuCompute.getCurrentRenderTarget(this.divergenceVariable));
    
        // 5. Pressure Solver (Jacobi iterations to find pressure from divergence)
        const pressureIterations = parseInt(document.getElementById('hydro_pressureIterations')?.value) || 20;
        let pSource = this.gpuCompute.getCurrentRenderTarget(this.pressureVariable);
        let pDest = this.gpuCompute.getAlternateRenderTarget(this.pressureVariable);
        this.jacobiMaterial.uniforms.u_divergence.value = this.gpuCompute.getCurrentRenderTarget(this.divergenceVariable).texture;
        for (let i = 0; i < pressureIterations; i++) {
            this.jacobiMaterial.uniforms.u_pressure.value = pSource.texture;
            this.gpuCompute.doRenderTarget(this.jacobiMaterial, pDest);
            [pSource, pDest] = [pDest, pSource]; // Efficiently swap pointers
        }
    
        // 6. Gradient Subtraction (use pressure to make velocity field incompressible)
        let finalVelDest = this.gpuCompute.getAlternateRenderTarget(this.velocityVariable);
        this.gradientMaterial.uniforms.u_pressure.value = pSource.texture;
        this.gradientMaterial.uniforms.u_velocity.value = finalVelSource.texture;
        this.gpuCompute.doRenderTarget(this.gradientMaterial, finalVelDest);
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
    [variable.renderTargets[0], variable.renderTargets[1]] = [variable.renderTargets[1], variable.renderTargets[0]];
    variable.wrapS = this.wrapS;
    variable.wrapT = this.wrapT;
    variable.minFilter = this.minFilter;
    variable.magFilter = this.magFilter;
};