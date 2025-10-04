import THREE from '../three-singleton.js';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';

import sphVelocityShader from './shaders/sph_velocity.glsl?raw';
import sphPositionShader from './shaders/sph_position.glsl?raw';

// --- RENDER SHADERS ---
const fluidRenderVertexShader = `
    uniform sampler2D u_positionTexture;
    uniform float u_pointSize;
    
    // Three.js provides the 'uv' attribute automatically.

    void main() {
        // Read the particle's 3D position from the GPGPU texture.
        vec3 pos = texture2D(u_positionTexture, uv).xyz;
        
        // Standard model-view-projection transformation.
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        // Set the particle size, making it smaller as it gets further away.
        gl_PointSize = u_pointSize * (200.0 / -mvPosition.z);
    }
`;

const fluidRenderFragmentShader = `
    void main() {
        float dist = distance(gl_PointCoord, vec2(0.5));
        float alpha = 1.0 - smoothstep(0.45, 0.5, dist);
        if (alpha <= 0.0) {
            discard;
        }
        gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
    }
`;


export const FluidSimulationContainer = {
    app: null,
    
    // --- Simulation Properties ---
    gpuCompute: null,
    positionVariable: null,
    velocityVariable: null,
    PARTICLE_RESOLUTION: 128,
    WORLD_SIZE: 40, 
    PARTICLE_COUNT: 128 * 128,

    // --- Visual Properties ---
    fluidMesh: null, 
    
    isInitialized: false,

    init(appInstance) {
        this.app = appInstance;
        this.PARTICLE_COUNT = this.PARTICLE_RESOLUTION * this.PARTICLE_RESOLUTION;

        const geometry = new THREE.BufferGeometry();
        
        const uvs = new Float32Array(this.PARTICLE_COUNT * 2);
        for (let y = 0; y < this.PARTICLE_RESOLUTION; y++) {
            for (let x = 0; x < this.PARTICLE_RESOLUTION; x++) {
                const i = (y * this.PARTICLE_RESOLUTION + x);
                uvs[i * 2 + 0] = x / (this.PARTICLE_RESOLUTION - 1);
                uvs[i * 2 + 1] = y / (this.PARTICLE_RESOLUTION - 1);
            }
        }
        geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.PARTICLE_COUNT * 3), 3));
        
        const material = new THREE.ShaderMaterial({
            uniforms: {
                u_positionTexture: { value: null },
                u_pointSize: { value: 2.0 }
            },
            vertexShader: fluidRenderVertexShader,
            fragmentShader: fluidRenderFragmentShader,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.fluidMesh = new THREE.Points(geometry, material);
        this.fluidMesh.visible = false;
        
        // ** THE FIX IS HERE: Revert to adding the mesh to the main scene temporarily. **
        // This prevents the initialization crash. The ImagePlaneManager will move it later.
        this.app.scene.add(this.fluidMesh);

        this.isInitialized = true;
        console.log("FluidSimulationContainer initialized and mesh created.");
    },

    _setupSimulation() {
        if (this.gpuCompute) return;

        const renderer = this.app.renderer;
        if (!renderer.capabilities.isWebGL2) {
            this.app.UIManager.logError("Fluid Simulation requires WebGL2.");
            return;
        }

        this.gpuCompute = new GPUComputationRenderer(this.PARTICLE_RESOLUTION, this.PARTICLE_RESOLUTION, renderer);

        const dtPosition = this.gpuCompute.createTexture();
        const dtVelocity = this.gpuCompute.createTexture();
        this.fillInitialParticleData(dtPosition.image.data, dtVelocity.image.data);

        this.velocityVariable = this.gpuCompute.addVariable("textureVelocity", sphVelocityShader, dtVelocity);
        this.positionVariable = this.gpuCompute.addVariable("texturePosition", sphPositionShader, dtPosition);
        
        this.gpuCompute.setVariableDependencies(this.velocityVariable, [this.positionVariable, this.velocityVariable]);
        this.gpuCompute.setVariableDependencies(this.positionVariable, [this.positionVariable, this.velocityVariable]);
        
        this.velocityVariable.material.uniforms['u_time'] = { value: 0.0 };
        this.positionVariable.material.uniforms['u_delta'] = { value: 0.0 };

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

        this.fluidMesh.visible = isActive;

        if (isActive) {
            this._setupSimulation();
        } else {
            this._disposeSimulation();
        }
    },

    update(delta) {
        if (!this.isInitialized || !this.fluidMesh.visible || !this.gpuCompute) return;

        this.gpuCompute.compute();
        
        this.velocityVariable.material.uniforms['u_time'].value = this.app.currentTime;
        this.positionVariable.material.uniforms['u_delta'].value = delta;

        const positionTexture = this.gpuCompute.getCurrentRenderTarget(this.positionVariable).texture;
        this.fluidMesh.material.uniforms.u_positionTexture.value = positionTexture;
    }
};