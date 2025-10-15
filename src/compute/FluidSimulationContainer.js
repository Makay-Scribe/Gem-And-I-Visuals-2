import THREE from '../three-singleton.js';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';

import sphVelocityShader from './shaders/sph_velocity.glsl?raw';
import sphPositionShader from './shaders/sph_position.glsl?raw';

export const FluidSimulationContainer = {
    app: null,
    
    // --- Simulation Properties ---
    gpuCompute: null,
    positionVariable: null,
    velocityVariable: null,
    PARTICLE_RESOLUTION: 128,
    WORLD_SIZE: 40, 
    PARTICLE_COUNT: 128 * 128,
    simulationStartTime: -1,

    isInitialized: false,

    init(appInstance) {
        this.app = appInstance;
        this.PARTICLE_COUNT = this.PARTICLE_RESOLUTION * this.PARTICLE_RESOLUTION;
        
        this.isInitialized = true;
        console.log("FluidSimulationContainer initialized (Physics only).");
    },

    _setupSimulation() {
        if (this.gpuCompute) return;

        const renderer = this.app.renderer;
        if (!renderer.capabilities.isWebGL2) {
            this.app.UIManager.logError("Fluid Simulation requires WebGL2.");
            return;
        }

        this.gpuCompute = new GPUComputationRenderer(this.PARTICLE_RESOLUTION, this.PARTICLE_RESOLUTION, renderer);

        this.simulationStartTime = this.app.currentTime;

        const dtPosition = this.gpuCompute.createTexture();
        const dtVelocity = this.gpuCompute.createTexture();
        this.fillInitialParticleData(dtPosition.image.data, dtVelocity.image.data);

        this.velocityVariable = this.gpuCompute.addVariable("textureVelocity", sphVelocityShader, dtVelocity);
        this.positionVariable = this.gpuCompute.addVariable("texturePosition", sphPositionShader, dtPosition);
        
        this.gpuCompute.setVariableDependencies(this.velocityVariable, [this.positionVariable, this.velocityVariable]);
        this.gpuCompute.setVariableDependencies(this.positionVariable, [this.positionVariable, this.velocityVariable]);
        
        const velocityUniforms = this.velocityVariable.material.uniforms;
        velocityUniforms['u_time'] = { value: 0.0 };
        velocityUniforms['u_delta'] = { value: 0.0 };
        velocityUniforms['u_planeDimensions'] = { value: this.app.ImagePlaneManager.planeDimensions };
        velocityUniforms['u_fluid_gravity'] = { value: this.app.vizSettings.fluid_gravity };


        const positionUniforms = this.positionVariable.material.uniforms;
        positionUniforms['u_delta'] = { value: 0.0 };

        const error = this.gpuCompute.init();
        if (error !== null) {
            console.error("FluidSimulation GPGPU Init Error:", error);
            this.app.UIManager.logError("Fluid GPGPU failed to init.");
        } else {
            console.log("Fluid GPGPU simulation created successfully.");
        }
    },

    _disposeSimulation() {
        if (!this.gpuCompute) return;

        const variables = [this.positionVariable, this.velocityVariable];
        variables.forEach(variable => {
            if (variable && variable.renderTargets) {
                variable.renderTargets.forEach(rt => rt.dispose());
            }
        });

        this.gpuCompute = null;
        this.positionVariable = null;
        this.velocityVariable = null;
        this.simulationStartTime = -1;
        console.log("Fluid GPGPU simulation disposed.");
    },

    fillInitialParticleData(positionData, velocityData) {
        const planeDims = this.app.ImagePlaneManager.planeDimensions;
        const halfWidth = planeDims.x / 2;
        const halfHeight = planeDims.y / 2;

        for (let i = 0; i < this.PARTICLE_COUNT; i++) {
            const k = i * 4;
            const u = (i % this.PARTICLE_RESOLUTION) / (this.PARTICLE_RESOLUTION - 1);
            const v = Math.floor(i / this.PARTICLE_RESOLUTION) / (this.PARTICLE_RESOLUTION - 1);

            const worldX = u * planeDims.x - halfWidth;
            const worldY = v * planeDims.y - halfHeight;

            positionData[k + 0] = worldX;
            positionData[k + 1] = worldY;
            positionData[k + 2] = 0.0;
            positionData[k + 3] = 1.0;
            
            velocityData[k + 0] = 0.0;
            velocityData[k + 1] = 0.0;
            velocityData[k + 2] = 0.0;
            velocityData[k + 3] = 0.0;
        }
    },
    
    setActive(isActive) {
        if (!this.isInitialized) return;

        if (isActive) {
            this._setupSimulation();
        } else {
            this._disposeSimulation();
        }
    },

    update(delta) {
        if (!this.gpuCompute) return;
        
        const simTime = this.simulationStartTime > 0 ? this.app.currentTime - this.simulationStartTime : 0;
        
        // ** THE FIX IS HERE: This manager now updates its own uniforms. **
        this.velocityVariable.material.uniforms['u_fluid_gravity'].value = this.app.vizSettings.fluid_gravity;
        this.velocityVariable.material.uniforms['u_time'].value = simTime;
        this.velocityVariable.material.uniforms['u_delta'].value = delta;
        
        this.positionVariable.material.uniforms['u_delta'].value = delta;

        this.gpuCompute.compute();
    }
};