import THREE from '../three-singleton.js';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';

import advectDensityShader from './shaders/hydro/advect.glsl?raw';
import advectVelocityShader from './shaders/hydro/advect_velocity.glsl?raw';
import divergenceShader from './shaders/hydro/divergence.glsl?raw';
import jacobiShader from './shaders/hydro/jacobi.glsl?raw';
import gradientShader from './shaders/hydro/gradient.glsl?raw';
import splatFromTextureShader from './shaders/hydro/splat_from_texture.glsl?raw';

export const HydroSimManager = {
    app: null,
    gpuCompute: null,
    
    densityVariable: null,
    velocityVariable: null,
    pressureVariable: null,
    divergenceVariable: null,
    velocityFinalVariable: null,
    
    seedMaterial: null, 
    
    SIM_RESOLUTION: 512, // Lowered to 512 for safer initialization on more GPUs

    isBurning: false,
    
    init(appInstance) {
        this.app = appInstance;
        const renderer = this.app.renderer;
        console.log("Initializing Hydro Sim Manager...");

        if (!renderer) {
            console.error("HydroSimManager: Renderer not found.");
            return;
        }

        this.gpuCompute = new GPUComputationRenderer(this.SIM_RESOLUTION, this.SIM_RESOLUTION, renderer);

        if (this.app.renderer.capabilities.isWebGL2 === false) {
            this.gpuCompute.setDataType(THREE.HalfFloatType);
        }

        const densityTexture = this.gpuCompute.createTexture();
        const velocityTexture = this.gpuCompute.createTexture();
        const divergenceTexture = this.gpuCompute.createTexture();
        const pressureTexture = this.gpuCompute.createTexture();
        const velocityFinalTexture = this.gpuCompute.createTexture();
        
        this.densityVariable = this.gpuCompute.addVariable('textureDensity', advectDensityShader, densityTexture);
        this.velocityVariable = this.gpuCompute.addVariable('textureVelocity', advectVelocityShader, velocityTexture);
        this.divergenceVariable = this.gpuCompute.addVariable('textureDivergence', divergenceShader, divergenceTexture);
        this.pressureVariable = this.gpuCompute.addVariable('texturePressure', jacobiShader, pressureTexture);
        this.velocityFinalVariable = this.gpuCompute.addVariable('textureVelocityFinal', gradientShader, velocityFinalTexture);

        this.gpuCompute.setVariableDependencies(this.densityVariable, [this.densityVariable, this.velocityFinalVariable]);
        this.gpuCompute.setVariableDependencies(this.velocityVariable, [this.velocityVariable, this.velocityFinalVariable]);
        this.gpuCompute.setVariableDependencies(this.divergenceVariable, [this.velocityVariable]);
        this.gpuCompute.setVariableDependencies(this.pressureVariable, [this.pressureVariable, this.divergenceVariable]);
        this.gpuCompute.setVariableDependencies(this.velocityFinalVariable, [this.velocityVariable, this.pressureVariable]);
        
        const allVars = [this.densityVariable, this.velocityVariable, this.divergenceVariable, this.pressureVariable, this.velocityFinalVariable];
        allVars.forEach(v => {
            v.material.uniforms.u_time = { value: 0.0 };
            v.material.uniforms.u_deltaTime = { value: 0.0 };
            v.material.uniforms.u_texelSize = { value: new THREE.Vector2(1.0/this.SIM_RESOLUTION, 1.0/this.SIM_RESOLUTION) };
        });

        [this.densityVariable, this.velocityVariable].forEach(v => {
            v.material.uniforms.u_dissipation = { value: (v === this.densityVariable) ? 1.0 : 0.98 };
            v.material.uniforms.u_splatColor = { value: new THREE.Vector4(0,0,0,0) };
            v.material.uniforms.u_point = { value: new THREE.Vector2() };
            v.material.uniforms.u_radius = { value: 0.0 };
            v.material.uniforms.u_aspectRatio = { value: 1.0 };
            v.material.uniforms.u_fireActive = { value: false };
            v.material.uniforms.u_time = { value: 0.0 };
        });

        this.pressureVariable.material.uniforms.u_alpha = { value: -1.0 };
        this.pressureVariable.material.uniforms.u_rbeta = { value: 0.25 };

        const error = this.gpuCompute.init();
        if (error !== null) { 
            console.error("HydroSimManager Init Error:", error); 
        } else {
            console.log("HydroSimManager GPGPU Initialized.");
        }

        this.seedMaterial = new THREE.ShaderMaterial({
            uniforms: {
                u_splatTexture: { value: null },
                u_target: { value: null },
                resolution: { value: new THREE.Vector2(this.SIM_RESOLUTION, this.SIM_RESOLUTION) }
            },
            vertexShader: `void main() { gl_Position = vec4( position, 1.0 ); }`,
            fragmentShader: splatFromTextureShader
        });
    },

    seedSimulation(sourceTexture) {
        if (!this.gpuCompute || !sourceTexture) return;
        
        console.log("Seeding HydroSim...");
        this.isBurning = false;
        this.densityVariable.material.uniforms.u_dissipation.value = 1.0;
        this.velocityVariable.material.uniforms.u_dissipation.value = 0.98; 
        this.velocityVariable.material.uniforms.u_fireActive.value = false;

        const currentRenderTarget = this.gpuCompute.getCurrentRenderTarget(this.densityVariable);
        const alternateRenderTarget = this.gpuCompute.getAlternateRenderTarget(this.densityVariable);

        this.seedMaterial.uniforms.u_splatTexture.value = sourceTexture;
        this.seedMaterial.uniforms.u_target.value = currentRenderTarget.texture;
        
        this.gpuCompute.doRenderTarget(this.seedMaterial, alternateRenderTarget);
        this.densityVariable.renderTargets.reverse();
    },

    startBurn() {
        if (this.isBurning) return;
        console.log("IGNITION: Starting fire simulation.");
        this.isBurning = true;
        this.densityVariable.material.uniforms.u_dissipation.value = 0.995; 
    },
    
    _currentSplat: null,
    applySplat(point, color, radius) { this._currentSplat = { point, color: new THREE.Vector4(color.r, color.g, color.b, 1.0), radius, isForce: false }; },
    applyForceSplat(point, force, radius) { this._currentSplat = { point, color: new THREE.Vector4(force.x, force.y, force.z, 0.0), radius, isForce: true }; },

    update(delta) {
        if (!this.gpuCompute) return;

        this.gpuCompute.variables.forEach(v => {
            v.material.uniforms.u_deltaTime.value = delta;
            v.material.uniforms.u_time.value = this.app.currentTime;
            if (v.material.uniforms.u_fireActive) {
                v.material.uniforms.u_fireActive.value = this.isBurning;
            }
        });

        const zeroVec = new THREE.Vector4(0,0,0,0);
        this.densityVariable.material.uniforms.u_splatColor.value.copy(zeroVec);
        this.velocityVariable.material.uniforms.u_splatColor.value.copy(zeroVec);

        if (this._currentSplat) {
            const targetVar = this._currentSplat.isForce ? this.velocityVariable : this.densityVariable;
            targetVar.material.uniforms.u_splatColor.value.copy(this._currentSplat.color);
            targetVar.material.uniforms.u_point.value.copy(this._currentSplat.point);
            targetVar.material.uniforms.u_radius.value = this._currentSplat.radius;
            this._currentSplat = null;
        }

        this.gpuCompute.compute(); 
        
        const pressureIterations = 20;
        const pressureMat = this.pressureVariable.material;
        
        for (let i = 0; i < pressureIterations; i++) {
            const source = this.gpuCompute.getCurrentRenderTarget(this.pressureVariable);
            const dest = this.gpuCompute.getAlternateRenderTarget(this.pressureVariable);
            pressureMat.uniforms.texturePressure.value = source.texture; 
            this.gpuCompute.doRenderTarget(pressureMat, dest);
            this.pressureVariable.renderTargets.reverse();
        }
        
        const gradientMat = this.velocityFinalVariable.material;
        const pressureResult = this.gpuCompute.getCurrentRenderTarget(this.pressureVariable);
        const velAdvectedResult = this.gpuCompute.getCurrentRenderTarget(this.velocityVariable);
        const velFinalDest = this.gpuCompute.getCurrentRenderTarget(this.velocityFinalVariable);
        
        gradientMat.uniforms.texturePressure.value = pressureResult.texture;
        gradientMat.uniforms.textureVelocity.value = velAdvectedResult.texture;
        
        this.gpuCompute.doRenderTarget(gradientMat, velFinalDest);
    },

    getOutputTexture() {
        if (!this.gpuCompute || !this.densityVariable) return null;
        return this.gpuCompute.getCurrentRenderTarget(this.densityVariable).texture;
    },

    dispose() { if (this.gpuCompute) { this.gpuCompute.dispose(); this.gpuCompute = null; } }
};