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
    PARTICLE_RESOLUTION: 0,
    WORLD_SIZE: 40, 
    PARTICLE_COUNT: 0,
    simulationStartTime: -1,

    // ** THE FIX IS HERE: State is now a string for more descriptive control **
    physicsState: 'stopped', // 'stopped', 'running', 'resetting'
    resetStartTime: -1,
    RESET_DURATION: 6.0, // 6 seconds for a smooth reset animation

    isInitialized: false,

    init(appInstance) {
        this.app = appInstance;
        this.PARTICLE_RESOLUTION = this.app.vizSettings.particle_resolution;
        this.PARTICLE_COUNT = this.PARTICLE_RESOLUTION * this.PARTICLE_RESOLUTION;
        
        this.isInitialized = true;
        console.log("FluidSimulationContainer initialized (Physics only).");
    },

    // --- Public Control Methods ---
    startPhysics() {
        if (this.physicsState === 'running') return;
        this.physicsState = 'running';
        // Reset the simulation clock every time we start from a full stop
        if (this.simulationStartTime < 0) {
            this.simulationStartTime = this.app.currentTime;
        }
    },

    stopPhysics() {
        this.physicsState = 'stopped';
    },

    resetToCanvas() {
        if (this.physicsState === 'resetting') return;
        this.physicsState = 'resetting';
        this.resetStartTime = this.app.currentTime;
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
        
        // ** THE FIX IS HERE: Uniforms for state management and director control **
        velocityUniforms['u_physicsState'] = { value: 0 }; // 0:stopped, 1:running, 2:resetting
        velocityUniforms['u_resetProgress'] = { value: 0.0 };
        velocityUniforms['u_gravity'] = { value: new THREE.Vector3(0, 0, 0) };
        velocityUniforms['u_pressureStrength'] = { value: 0.0 };
        velocityUniforms['u_attractionStrength'] = { value: 0.0 };
        velocityUniforms['u_targetState'] = { value: 0 }; // 0: Canvas, 1: 3D Model
        
        // Textures for target positions
        velocityUniforms['u_initialPosition'] = { value: null }; // Will be populated after init
        velocityUniforms['u_modelPosition'] = { value: this.app.ComputeManager.particleModelPositionTexture };


        const positionUniforms = this.positionVariable.material.uniforms;
        positionUniforms['u_delta'] = { value: 0.0 };

        const error = this.gpuCompute.init();
        if (error !== null) {
            console.error("FluidSimulation GPGPU Init Error:", error);
            this.app.UIManager.logError("Fluid GPGPU failed to init.");
        } else {
            // Populate the initial position texture uniform *after* init
            this.velocityVariable.material.uniforms.u_initialPosition.value = this.gpuCompute.createTexture();
            this.fillInitialParticleData(this.velocityVariable.material.uniforms.u_initialPosition.value.image.data, []);
            console.log("Fluid GPGPU simulation created successfully.");
        }
    },

    _disposeSimulation() {
        if (!this.gpuCompute) return;

        if (this.velocityVariable.material.uniforms.u_initialPosition.value) {
            this.velocityVariable.material.uniforms.u_initialPosition.value.dispose();
        }

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
        this.physicsState = 'stopped';
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
            
            if(velocityData.length > 0) {
                velocityData[k + 0] = 0.0;
                velocityData[k + 1] = 0.0;
                velocityData[k + 2] = 0.0;
                velocityData[k + 3] = 0.0;
            }
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
        const uniforms = this.velocityVariable.material.uniforms;

        // Gravity is now controlled by the director, so we remove the direct update from here.
        // uniforms.u_fluid_gravity.value = this.app.vizSettings.fluid_gravity; 
        
        uniforms.u_time.value = simTime;
        uniforms.u_delta.value = delta;
        this.positionVariable.material.uniforms['u_delta'].value = delta;

        // ** THE FIX IS HERE: Handle the new state logic **
        switch(this.physicsState) {
            case 'stopped':
                uniforms.u_physicsState.value = 0;
                break;
            case 'running':
                uniforms.u_physicsState.value = 1;
                break;
            case 'resetting':
                uniforms.u_physicsState.value = 2;
                let progress = (this.app.currentTime - this.resetStartTime) / this.RESET_DURATION;
                progress = Math.min(progress, 1.0);
                uniforms.u_resetProgress.value = 1.0 - Math.pow(1.0 - progress, 4.0); // Ease out
                
                if (progress >= 1.0) {
                    this.physicsState = 'stopped';
                }
                break;
        }

        this.gpuCompute.compute();
    }
};