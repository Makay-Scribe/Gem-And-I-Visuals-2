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
    WORLD_SIZE: 60, 
    PARTICLE_COUNT: 0,
    simulationStartTime: -1,

    physicsState: 'stopped', // 'stopped', 'running'

    isInitialized: false,

    init(appInstance) {
        this.app = appInstance;
        this.PARTICLE_RESOLUTION = this.app.vizSettings.particle_resolution;
        this.PARTICLE_COUNT = this.PARTICLE_RESOLUTION * this.PARTICLE_RESOLUTION;
        
        this.isInitialized = true;
        console.log("FluidSimulationContainer initialized (Physics only).");
        
        // ** FIX 1: Set an initial fallback texture to prevent crash **
        // This is necessary because some code paths may try to create the FluidSim
        // before ComputeManager has had a chance to set up.
        this._modelPositionTexture = this._createFallbackTexture();
    },

    // Helper to create a fallback 1x1 black/empty data texture
    _createFallbackTexture() {
        const emptyData = new Float32Array([0, 0, 0, 0]);
        const texture = new THREE.DataTexture(emptyData, 1, 1, THREE.RGBAFormat, THREE.FloatType);
        texture.needsUpdate = true;
        return texture;
    },

    // --- NEW METHOD: Allows external modules (main.js) to set the baked model data LATER ---
    setBakedModelTexture(modelPositionTexture) {
        if (!modelPositionTexture) return;

        // ** Fix 2: If we have an active simulation, update the uniforms now **
        if (this.velocityVariable) {
            this.velocityVariable.material.uniforms.u_modelPosition.value = modelPositionTexture;
            this.positionVariable.material.uniforms.u_modelPosition.value = modelPositionTexture;
        }

        // Store the texture so _setupSimulation can use it if called later
        this._modelPositionTexture = modelPositionTexture;
    },

    // --- Public Control Methods ---
    startPhysics() {
        if (this.physicsState === 'running') return;
        this.physicsState = 'running';
        if (this.simulationStartTime < 0) {
            this.simulationStartTime = this.app.currentTime;
        }

        if (this.velocityVariable) {
            this.velocityVariable.material.uniforms.u_attractionStrength.value = 0.5;
        }
    },

    stopPhysics() {
        this.physicsState = 'stopped';
        if (this.velocityVariable && this.positionVariable && this.positionVariable.material.uniforms.u_manualMorph.value === 0.0) {
            this.velocityVariable.material.uniforms.u_attractionStrength.value = 0.0;
        }
    },

    _setupSimulation() {
        if (this.gpuCompute) return;

        const renderer = this.app.renderer;
        if (!renderer.capabilities.isWebGL2) {
            this.app.UIManager.logError("Fluid Simulation requires WebGL2.");
            return;
        }
        
        // ** FIX 3: If no valid texture has been supplied yet, wait for the one from ComputeManager **
        // At this point, ComputeManager should have already created a texture, even if it's empty.
        let targetModelTexture = this._modelPositionTexture || this.app.ComputeManager.particleModelPositionTexture;
        if (!targetModelTexture) {
            targetModelTexture = this._createFallbackTexture();
            console.warn("FluidSim: No model texture found, using fallback for initial setup.");
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
        velocityUniforms['u_worldSize'] = { value: this.WORLD_SIZE };
        
        velocityUniforms['u_physicsState'] = { value: 0 };
        velocityUniforms['u_gravity'] = { value: new THREE.Vector3(0, 0, 0) };
        velocityUniforms['u_pressureStrength'] = { value: 0.0 };
        velocityUniforms['u_attractionStrength'] = { value: 0.0 };
        velocityUniforms['u_targetState'] = { value: 0 };
        
        velocityUniforms['u_flowStrength'] = { value: 0.0 };
        velocityUniforms['u_flowScale'] = { value: 0.1 };
        velocityUniforms['u_flowSpeed'] = { value: 0.2 };
        
        velocityUniforms['u_explosionCenter'] = { value: new THREE.Vector3(0, 0, 0) };
        velocityUniforms['u_explosionStrength'] = { value: 0.0 };
        velocityUniforms['u_vortexCenter'] = { value: new THREE.Vector2(0, 0) };
        velocityUniforms['u_vortexStrength'] = { value: 0.0 };
        
        velocityUniforms['u_curlStrength'] = { value: 0.0 };
        velocityUniforms['u_curlScale'] = { value: 0.0 };
        velocityUniforms['u_curlSpeed'] = { value: 0.0 };
        
        velocityUniforms['u_initialPosition'] = { value: null };
        // ** ASSIGNING THE SAFE/UPDATED TARGET TEXTURE **
        velocityUniforms['u_modelPosition'] = { value: targetModelTexture }; 

        const positionUniforms = this.positionVariable.material.uniforms;
        positionUniforms['u_delta'] = { value: 0.0 };
        positionUniforms['u_worldSize'] = { value: this.WORLD_SIZE };
        
        positionUniforms['u_manualMorph'] = { value: 0.0 };
        positionUniforms['u_targetState'] = velocityUniforms.u_targetState; 
        positionUniforms['u_initialPosition'] = { value: null }; 
        // ** ASSIGNING THE SAFE/UPDATED TARGET TEXTURE **
        positionUniforms['u_modelPosition'] = velocityUniforms.u_modelPosition; 


        const error = this.gpuCompute.init();
        if (error !== null) {
            console.error("FluidSimulation GPGPU Init Error:", error);
            this.app.UIManager.logError("Fluid GPGPU failed to init.");
        } else {
            const initialPosTexture = this.gpuCompute.createTexture();
            this.fillInitialParticleData(initialPosTexture.image.data, []);
            this.velocityVariable.material.uniforms.u_initialPosition.value = initialPosTexture;
            this.positionVariable.material.uniforms.u_initialPosition.value = initialPosTexture;
            console.log("Fluid GPGPU simulation created successfully.");
        }
    },

    _disposeSimulation() {
        if (!this.gpuCompute) return;

        const initialPosTexture = this.velocityVariable.material.uniforms.u_initialPosition.value;
        if (initialPosTexture) {
            initialPosTexture.dispose();
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
        if (!this.gpuCompute) {
            return;
        }
        
        const isMorphingManually = this.positionVariable.material.uniforms.u_manualMorph.value > 0.0;
        
        if (this.physicsState === 'stopped' && !isMorphingManually) {
            if (this.velocityVariable) {
                 this.velocityVariable.material.uniforms.u_attractionStrength.value = 0.0;
            }
            return;
        }
        
        const simTime = this.simulationStartTime > 0 ? this.app.currentTime - this.simulationStartTime : 0;
        const uniforms = this.velocityVariable.material.uniforms;
        
        uniforms.u_time.value = simTime;
        uniforms.u_delta.value = delta;
        this.positionVariable.material.uniforms.u_delta.value = delta;

        uniforms.u_physicsState.value = 1;

        if (!this.app.FluidDirector.activeScript && isMorphingManually) {
            uniforms.u_attractionStrength.value = this.positionVariable.material.uniforms.u_manualMorph.value * 2.5; 
        }

        this.gpuCompute.compute();
    }
};