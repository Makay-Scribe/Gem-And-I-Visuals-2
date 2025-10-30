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
    // ** THE FIX IS HERE: This flag is no longer needed to control the simulation loop. **
    // isUnderManualControl: false, 

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
        if (this.simulationStartTime < 0) {
            this.simulationStartTime = this.app.currentTime;
        }
    },

    stopPhysics() {
        // ** THE FIX IS HERE: Add a check to see if the user has touched the attraction slider. **
        // If the attraction is non-zero, we keep the physics running so the particles can hold their shape.
        if (this.gpuCompute && this.velocityVariable.material.uniforms.u_attractionStrength.value > 0) {
            console.log("FluidDirector requested stop, but manual attraction is active. Keeping physics alive.");
            return;
        }
        this.physicsState = 'stopped';
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
        velocityUniforms['u_worldSize'] = { value: this.WORLD_SIZE };
        
        velocityUniforms['u_physicsState'] = { value: 0 }; // 0:stopped, 1:running
        velocityUniforms['u_gravity'] = { value: new THREE.Vector3(0, 0, 0) };
        velocityUniforms['u_pressureStrength'] = { value: 0.0 };
        velocityUniforms['u_attractionStrength'] = { value: 0.0 };
        velocityUniforms['u_targetState'] = { value: 0 }; // 0: Canvas, 1: 3D Model
        
        velocityUniforms['u_flowStrength'] = { value: 0.0 };
        velocityUniforms['u_flowScale'] = { value: 0.1 };
        velocityUniforms['u_flowSpeed'] = { value: 0.2 };
        
        velocityUniforms['u_explosionCenter'] = { value: new THREE.Vector3(0, 0, 0) };
        velocityUniforms['u_explosionStrength'] = { value: 0.0 };
        velocityUniforms['u_vortexCenter'] = { value: new THREE.Vector2(0, 0) };
        velocityUniforms['u_vortexStrength'] = { value: 0.0 };
        
        velocityUniforms['u_initialPosition'] = { value: null };
        velocityUniforms['u_modelPosition'] = { value: this.app.ComputeManager.particleModelPositionTexture };

        const positionUniforms = this.positionVariable.material.uniforms;
        positionUniforms['u_delta'] = { value: 0.0 };

        const error = this.gpuCompute.init();
        if (error !== null) {
            console.error("FluidSimulation GPGPU Init Error:", error);
            this.app.UIManager.logError("Fluid GPGPU failed to init.");
        } else {
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
        // ** THE FIX IS HERE: The simulation now only stops if the Director explicitly stops it. **
        if (!this.gpuCompute || this.physicsState === 'stopped') {
            return;
        }
        
        const simTime = this.simulationStartTime > 0 ? this.app.currentTime - this.simulationStartTime : 0;
        const uniforms = this.velocityVariable.material.uniforms;
        
        uniforms.u_time.value = simTime;
        uniforms.u_delta.value = delta;
        this.positionVariable.material.uniforms['u_delta'].value = delta;

        uniforms.u_physicsState.value = 1;
        
        this.gpuCompute.compute();
    }
};