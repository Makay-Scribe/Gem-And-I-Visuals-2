import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';

// --- Import all our GLSL files as raw text strings ---
import commonShader from './shaders/common.glsl?raw';
import waterRippleShader from './shaders/effects/waterRipple.glsl?raw';
import eqRippleShader from './shaders/effects/eqRipple.glsl?raw';
import clothShader from './shaders/effects/cloth.glsl?raw';
import foldShader from './shaders/effects/fold.glsl?raw';
import cylinderShader from './shaders/effects/cylinder.glsl?raw';
import sagShader from './shaders/effects/sag.glsl?raw';
import droopShader from './shaders/effects/droop.glsl?raw';
import peelShader from './shaders/effects/peel.glsl?raw';
import gpgpuPositionShader from './shaders/gpgpu_position.glsl?raw';

import particlePositionShader from './shaders/effects/particle_position.glsl?raw';
import particleVelocityShader from './shaders/effects/particle_velocity.glsl?raw';


export const ComputeManager = {
    app: null, // Main app instance
    
    // --- Original GPGPU System (for planes and cubewall) ---
    gpuCompute: null,
    positionVariable: null,
    previousPositionVariable: null, 
    initialPositionTexture: null,
    clothEnableTime: -1, 

    // --- Isolated GPGPU System for Particles ---
    particleGpuCompute: null,
    particlePositionVar: null,
    particleVelocityVar: null,
    particleFlatPositionTexture: null,
    particleModelPositionTexture: null, 
    particleModelUVTexture: null,

    WIDTH: 0,
    HEIGHT: 0,
    AREA: 0,

    init(appInstance, planeWidth, planeHeight, planeResX, planeResY) {
        this.app = appInstance;
        const renderer = this.app.renderer;

        this.WIDTH = planeResX;
        this.HEIGHT = planeResY;
        this.AREA = this.WIDTH * this.HEIGHT;

        if (!renderer.capabilities.isWebGL2) {
            this.app.UIManager.logError("GPGPU Compute requires WebGL2.");
            return;
        }

        if (renderer.capabilities.floatFragmentTextures === false) {
            this.app.UIManager.logError("No float textures support on this GPU.");
            return;
        }

        this.app.THREE.ShaderChunk['gpgpu_common'] = commonShader;
        this.app.THREE.ShaderChunk['gpgpu_waterRipple'] = waterRippleShader;
        this.app.THREE.ShaderChunk['gpgpu_eqRipple'] = eqRippleShader;
        this.app.THREE.ShaderChunk['gpgpu_cloth'] = clothShader;
        this.app.THREE.ShaderChunk['gpgpu_fold'] = foldShader;
        this.app.THREE.ShaderChunk['gpgpu_cylinder'] = cylinderShader;
        this.app.THREE.ShaderChunk['gpgpu_sag'] = sagShader;
        this.app.THREE.ShaderChunk['gpgpu_droop'] = droopShader;
        this.app.THREE.ShaderChunk['gpgpu_peel'] = peelShader;

        this.gpuCompute = new GPUComputationRenderer(this.WIDTH, this.HEIGHT, renderer);

        const initialPositionData = new Float32Array(this.AREA * 4);
        
        const halfWidth = planeWidth / 2;
        const halfHeight = planeHeight / 2;

        for (let i = 0; i < this.HEIGHT; i++) {
            for (let j = 0; j < this.WIDTH; j++) {
                const index = (i * this.WIDTH + j);
                const x = (j / (this.WIDTH - 1)) * planeWidth - halfWidth;
                const y = (i / (this.HEIGHT - 1)) * planeHeight - halfHeight;
                const z = 0.0; 

                initialPositionData[index * 4 + 0] = x;
                initialPositionData[index * 4 + 1] = y;
                initialPositionData[index * 4 + 2] = z;
                initialPositionData[index * 4 + 3] = 1.0;
            }
        }

        this.initialPositionTexture = new this.app.THREE.DataTexture(initialPositionData, this.WIDTH, this.HEIGHT, this.app.THREE.RGBAFormat, this.app.THREE.FloatType);
        this.initialPositionTexture.needsUpdate = true;
        
        const copyShader = `
            void main() {
                vec2 uv = gl_FragCoord.xy / resolution.xy;
                gl_FragColor = texture2D(texturePosition, uv);
            }
        `;

        this.positionVariable = this.gpuCompute.addVariable('texturePosition', gpgpuPositionShader, this.initialPositionTexture);
        this.previousPositionVariable = this.gpuCompute.addVariable('texturePreviousPosition', copyShader, this.initialPositionTexture);

        this.gpuCompute.setVariableDependencies(this.positionVariable, [this.positionVariable, this.previousPositionVariable]);
        this.gpuCompute.setVariableDependencies(this.previousPositionVariable, [this.positionVariable]);
        
        const uniforms = {
            u_initialPosition: { value: this.initialPositionTexture },
            u_time: { value: 0 },
            u_delta: { value: 0 },
            u_audioLow: { value: 0 },
            u_audioTexture: { value: this.app.AudioProcessor.audioTexture }, 
            u_planeDimensions: { value: new this.app.THREE.Vector2(planeWidth, planeHeight) },
            u_gpgpu_enableWaterRipple: { value: false },
            u_gpgpu_rippleSpeed: { value: 0.5 },
            u_gpgpu_rippleStrength: { value: 1.0 },
            u_gpgpu_rippleFrequency: { value: 15.0 },
            u_gpgpu_enableEqRipple: { value: false },
            u_gpgpu_eqRippleStrength: { value: 2.0 },
            u_gpgpu_eqRippleSmoothing: { value: 0.5 },
            u_gpgpu_eqRippleBarCount: { value: 64.0 },
            u_gpgpu_eqRippleBarWidth: { value: 0.8 },
            u_gpgpu_eqRippleRangeStart: { value: 0.0 },
            u_gpgpu_eqRippleRangeEnd: { value: 1.0 },
            u_gpgpu_eqRippleStyle: { value: 0 },
            u_gpgpu_enableCloth: { value: false },
            u_gpgpu_clothDamping: { value: 1.0 },
            u_gpgpu_clothStiffness: { value: 0.8 },
            u_gpgpu_clothAudioForce: { value: 500.0 },
            u_gpgpu_clothForceRadius: { value: 0.3 },
            gpgpu_clothIterations: { value: 1 },
            gpgpu_clothPinMode: { value: 1 },
            u_gpgpu_tetherStrength: { value: 82.0 },
            u_gpgpu_ambientWindStrength: { value: 4.0 },
            u_gpgpu_ambientWindSpeed: { value: 0.3 },
            u_gpgpu_ambientWindScale: { value: 2.0 },
            u_gpgpu_directionalWind: { value: new this.app.THREE.Vector3(0, 1.6, 5.8) },
            u_gpgpu_clothBlendTime: { value: 9.6 },
            u_gpgpu_clothBlendFactor: { value: 0.0 },
            u_gpgpu_enableFold: { value: false },
            u_gpgpu_foldAngle: { value: 0.0 },
            u_gpgpu_foldDepth: { value: 0.0 },
            u_gpgpu_foldRoundness: { value: 0.0 },
            u_gpgpu_foldAudioMod: { value: 0.0 },
            u_gpgpu_foldNudge: { value: 0.0 },
            u_gpgpu_enableFoldCrease: { value: false },
            u_gpgpu_foldCreaseDepth: { value: 0.0 },
            u_gpgpu_foldCreaseSharpness: { value: 0.0 },
            u_gpgpu_enableFoldTuck: { value: false },
            u_gpgpu_foldTuckAmount: { value: 0.0 },
            u_gpgpu_foldTuckReach: { value: 0.0 },
            u_gpgpu_enableCylinder: { value: false },
            u_gpgpu_cylinderRadius: { value: 0.0 },
            u_gpgpu_cylinderHeightScale: { value: 0.0 },
            u_gpgpu_cylinderAxisAlignment: { value: 0 },
            u_gpgpu_cylinderArcAngle: { value: 0.0 },
            u_gpgpu_cylinderArcOffset: { value: 0.0 },
            u_gpgpu_enableSag: { value: false },
            u_gpgpu_sagAmount: { value: 0.0 },
            u_gpgpu_sagFalloffSharpness: { value: 0.0 },
            u_gpgpu_sagAudioMod: { value: 0.0 },
            u_gpgpu_enableDroop: { value: false },
            u_gpgpu_droopAmount: { value: 0.0 },
            u_gpgpu_droopAudioMod: { value: 0.0 },
            u_gpgpu_droopFalloffSharpness: { value: 0.0 },
            u_gpgpu_droopSupportedWidthFactor: { value: 0.0 },
            u_gpgpu_droopSupportedDepthFactor: { value: 0.0 },
            u_gpgpu_enablePeel: { value: false },
            u_gpgpu_peelAmount: { value: 0.0 },
            u_gpgpu_peelCurl: { value: 0.0 },
            u_gpgpu_peelEnableAudio: { value: true },
            u_gpgpu_peelTextureAmount: { value: 0.0 },
            u_gpgpu_peelDrift: { value: 0.0 },
        };

        this.positionVariable.material.uniforms = uniforms;
        this.previousPositionVariable.material.uniforms = uniforms;

        const error = this.gpuCompute.init();
        if (error !== null) {
            this.app.UIManager.logError("GPGPU Init Error: " + error);
            console.error("GPGPU Init Error:", error);
        } else {
            this.app.UIManager.logSuccess("GPGPU Compute Initialized.");
        }
        
        // ** THE FIX IS HERE: Initialize the particle system unconditionally at startup. **
        this.initParticleSystem();
    },

    initParticleSystem() {
        if (this.particleGpuCompute) {
            // If called again (e.g., on resolution change), dispose the old one first.
            this.disposeParticleSystem();
        }

        const S = this.app.vizSettings;
        const resolution = S.particle_resolution;
        const count = resolution * resolution;
        const renderer = this.app.renderer;

        this.particleGpuCompute = new GPUComputationRenderer(resolution, resolution, renderer);

        const dtPosition = this.particleGpuCompute.createTexture();
        const dtVelocity = this.particleGpuCompute.createTexture();
        this.particleFlatPositionTexture = this.particleGpuCompute.createTexture();
        this.particleModelPositionTexture = this.particleGpuCompute.createTexture(); 
        this.particleModelUVTexture = this.particleGpuCompute.createTexture();

        const posArray = dtPosition.image.data;
        const velArray = dtVelocity.image.data;
        const flatArray = this.particleFlatPositionTexture.image.data;

        const planeDims = this.app.ImagePlaneManager.planeDimensions;
        const halfWidth = planeDims.x / 2;
        const halfHeight = planeDims.y / 2;

        for (let i = 0; i < count; i++) {
            const k = i * 4;
            const u = (i % resolution) / (resolution - 1);
            const v = Math.floor(i / resolution) / (resolution - 1);
            
            const worldX = u * planeDims.x - halfWidth;
            const worldY = v * planeDims.y - halfHeight;

            posArray[k + 0] = flatArray[k + 0] = worldX;
            posArray[k + 1] = flatArray[k + 1] = worldY;
            posArray[k + 2] = flatArray[k + 2] = 0;
            posArray[k + 3] = flatArray[k + 3] = 1.0;

            velArray[k + 0] = 0;
            velArray[k + 1] = 0;
            velArray[k + 2] = 0;
            velArray[k + 3] = 1.0;
        }

        this.particleVelocityVar = this.particleGpuCompute.addVariable("textureVelocity", particleVelocityShader, dtVelocity);
        this.particlePositionVar = this.particleGpuCompute.addVariable("texturePosition", particlePositionShader, dtPosition);

        this.particleGpuCompute.setVariableDependencies(this.particleVelocityVar, [this.particlePositionVar, this.particleVelocityVar]);
        this.particleGpuCompute.setVariableDependencies(this.particlePositionVar, [this.particlePositionVar, this.particleVelocityVar]);
        
        const velocityUniforms = this.particleVelocityVar.material.uniforms;
        velocityUniforms['u_time'] = { value: 0.0 };
        velocityUniforms['u_targetPositionMap'] = { value: this.particleFlatPositionTexture };
        velocityUniforms['particle_flowScale'] = { value: S.particle_flowScale };
        velocityUniforms['particle_flowSpeed'] = { value: S.particle_flowSpeed };
        velocityUniforms['particle_flowStrength'] = { value: S.particle_flowStrength };
        velocityUniforms['particle_morphProgress'] = { value: S.particle_morphProgress };
        velocityUniforms['particle_attractionStrength'] = { value: S.particle_attractionStrength };
        
        const positionUniforms = this.particlePositionVar.material.uniforms;
        positionUniforms['u_delta'] = { value: 0.0 };

        const error = this.particleGpuCompute.init();
        if (error !== null) {
            console.error("Particle GPGPU Error:", error);
            this.app.UIManager.logError("Particle GPGPU failed to init.");
        } else {
            console.log("Particle GPGPU system initialized.");
        }
    },

    bakeToTexture(mesh, targetPositionTexture) {
        if (!mesh || !targetPositionTexture) {
            console.error("Bake failed: mesh or target position texture is missing.");
            return;
        }
    
        const targetUVTexture = this.particleModelUVTexture;
        if (!targetUVTexture) {
            console.error("Bake failed: particleModelUVTexture is missing.");
            return;
        }
    
        const sampler = new MeshSurfaceSampler(mesh).build();
    
        const posArray = targetPositionTexture.image.data;
        const uvArray = targetUVTexture.image.data;
        const particleCount = posArray.length / 4;
        
        mesh.geometry.computeBoundingBox();
        const box = mesh.geometry.boundingBox;
        const size = new this.app.THREE.Vector3();
        box.getSize(size);
        const center = new this.app.THREE.Vector3();
        box.getCenter(center);

        const planeDims = this.app.ImagePlaneManager.planeDimensions;
        const scale = Math.min(planeDims.x / size.x, planeDims.y / size.y) * 0.9;
    
        const _position = new this.app.THREE.Vector3();
        const _normal = new this.app.THREE.Vector3();
        const _uv = new this.app.THREE.Vector2();
    
        const hasUVs = mesh.geometry.attributes.uv !== undefined;
        if (!hasUVs) {
            console.warn(`Baking to texture: Mesh "${mesh.name}" has no UV coordinates. Model color will not work.`);
        }
    
        for (let i = 0; i < particleCount; i++) {
            sampler.sample(_position, _normal, undefined, _uv);
    
            _position.sub(center).multiplyScalar(scale);
    
            const k = i * 4;
            posArray[k + 0] = _position.x;
            posArray[k + 1] = _position.y;
            posArray[k + 2] = _position.z;
            posArray[k + 3] = 1.0;

            uvArray[k + 0] = hasUVs ? _uv.x : 0.0;
            uvArray[k + 1] = hasUVs ? _uv.y : 0.0;
            uvArray[k + 2] = 0.0; 
            uvArray[k + 3] = 1.0; 
        }
    
        targetPositionTexture.needsUpdate = true;
        targetUVTexture.needsUpdate = true;
        console.log(`Baked ${particleCount} points (position & UVs) to textures.`);
    },

    disposeParticleSystem() {
        if (this.particleGpuCompute) {
            // It's good practice to dispose of all textures associated with the compute renderer
            const variables = [this.particlePositionVar, this.particleVelocityVar];
            variables.forEach(variable => {
                if (variable) {
                    variable.renderTargets.forEach(rt => rt.texture.dispose());
                }
            });

            if (this.particleFlatPositionTexture) this.particleFlatPositionTexture.dispose();
            if (this.particleModelPositionTexture) this.particleModelPositionTexture.dispose();
            if (this.particleModelUVTexture) this.particleModelUVTexture.dispose();
            
            // GPUComputationRenderer doesn't have a dedicated dispose method, so we nullify everything
            this.particleGpuCompute = null;
            this.particlePositionVar = null;
            this.particleVelocityVar = null;
            this.particleFlatPositionTexture = null; 
            this.particleModelPositionTexture = null;
            this.particleModelUVTexture = null;

            console.log("Particle GPGPU system disposed.");
        }
    },

    update(delta) {
        const S = this.app.vizSettings;
        const A = this.app.AudioProcessor;
        
        // --- UPDATE ORIGINAL GPGPU SYSTEM ---
        if (this.gpuCompute && S.gpgpuGeometryMode !== 'particles') {
            const uniforms = this.positionVariable.material.uniforms;
            
            if (S.gpgpu_enableCloth && this.clothEnableTime < 0) {
                this.clothEnableTime = this.app.currentTime;
            } else if (!S.gpgpu_enableCloth) {
                this.clothEnableTime = -1;
            }

            let blendFactor = 0.0;
            if (this.clothEnableTime > 0) {
                const elapsedTime = this.app.currentTime - this.clothEnableTime;
                const blendDuration = S.gpgpu_clothBlendTime > 0 ? S.gpgpu_clothBlendTime : 0.01;
                blendFactor = Math.min(elapsedTime / blendDuration, 1.0);
            }
            uniforms.u_gpgpu_clothBlendFactor.value = blendFactor;

            uniforms.u_gpgpu_enableWaterRipple.value = S.gpgpu_enableWaterRipple;
            uniforms.u_gpgpu_rippleSpeed.value = S.gpgpu_rippleSpeed;
            uniforms.u_gpgpu_rippleStrength.value = S.gpgpu_rippleStrength;
            uniforms.u_gpgpu_rippleFrequency.value = S.gpgpu_rippleFrequency;
            uniforms.u_gpgpu_enableEqRipple.value = S.gpgpu_enableEqRipple;
            uniforms.u_gpgpu_eqRippleStrength.value = S.gpgpu_eqRippleStrength;
            const styleMap = { 'Left': 0, 'Center': 1, 'Full': 2 };
            uniforms.u_gpgpu_eqRippleStyle.value = styleMap[S.gpgpu_eqRippleStyle] || 0;
            uniforms.u_gpgpu_eqRippleBarCount.value = S.gpgpu_eqRippleBarCount;
            uniforms.u_gpgpu_eqRippleBarWidth.value = S.gpgpu_eqRippleBarWidth;
            uniforms.u_gpgpu_eqRippleRangeStart.value = S.gpgpu_eqRippleRangeStart;
            uniforms.u_gpgpu_eqRippleRangeEnd.value = S.gpgpu_eqRippleRangeEnd;
            uniforms.u_gpgpu_enableCloth.value = S.gpgpu_enableCloth;
            uniforms.u_gpgpu_clothDamping.value = S.gpgpu_clothDamping;
            uniforms.u_gpgpu_clothStiffness.value = S.gpgpu_clothStiffness;
            uniforms.u_gpgpu_clothAudioForce.value = S.gpgpu_clothAudioForce;
            uniforms.u_gpgpu_clothForceRadius.value = S.gpgpu_clothForceRadius;
            uniforms.gpgpu_clothIterations.value = S.gpgpu_clothIterations;
            const pinModeMap = { 'none': 0, 'corners': 1, 'top_edge': 2, 'center': 3 };
            uniforms.gpgpu_clothPinMode.value = pinModeMap[S.gpgpu_clothPinMode] || 0;
            uniforms.u_gpgpu_tetherStrength.value = S.gpgpu_tetherStrength;
            uniforms.u_gpgpu_ambientWindStrength.value = S.gpgpu_ambientWindStrength;
            uniforms.u_gpgpu_ambientWindSpeed.value = S.gpgpu_ambientWindSpeed;
            uniforms.u_gpgpu_ambientWindScale.value = S.gpgpu_ambientWindScale;
            uniforms.u_gpgpu_directionalWind.value.set(S.gpgpu_directionalWindX, S.gpgpu_directionalWindY, S.gpgpu_directionalWindZ);

            uniforms.u_gpgpu_enableFold.value = S.gpgpu_enableFold;
            uniforms.u_gpgpu_foldAngle.value = S.gpgpu_foldAngle * (Math.PI / 180.0);
            uniforms.u_gpgpu_foldDepth.value = S.gpgpu_foldDepth;
            uniforms.u_gpgpu_foldRoundness.value = S.gpgpu_foldRoundness;
            uniforms.u_gpgpu_foldAudioMod.value = S.gpgpu_foldAudioMod * (Math.PI / 180.0);
            uniforms.u_gpgpu_foldNudge.value = S.gpgpu_foldNudge;
            uniforms.u_gpgpu_enableFoldCrease.value = S.gpgpu_enableFoldCrease;
            uniforms.u_gpgpu_foldCreaseDepth.value = S.gpgpu_foldCreaseDepth;
            uniforms.u_gpgpu_foldCreaseSharpness.value = S.gpgpu_foldCreaseSharpness;
            uniforms.u_gpgpu_enableFoldTuck.value = S.gpgpu_enableFoldTuck;
            uniforms.u_gpgpu_foldTuckAmount.value = S.gpgpu_foldTuckAmount;
            uniforms.u_gpgpu_foldTuckReach.value = S.gpgpu_foldTuckReach;

            uniforms.u_gpgpu_enableCylinder.value = S.gpgpu_enableCylinder;
            uniforms.u_gpgpu_cylinderRadius.value = S.gpgpu_cylinderRadius;
            uniforms.u_gpgpu_cylinderHeightScale.value = S.gpgpu_cylinderHeightScale;
            const cylAxisMapGpgpu = { 'y': 0, 'x': 1, 'z': 2 };
            uniforms.u_gpgpu_cylinderAxisAlignment.value = cylAxisMapGpgpu[S.gpgpu_cylinderAxisAlignment] || 0;
            uniforms.u_gpgpu_cylinderArcAngle.value = S.gpgpu_cylinderArcAngle * (Math.PI / 180.0);
            uniforms.u_gpgpu_cylinderArcOffset.value = S.gpgpu_cylinderArcOffset * (Math.PI / 180.0);

            uniforms.u_gpgpu_enableSag.value = S.gpgpu_enableSag;
            uniforms.u_gpgpu_sagAmount.value = S.gpgpu_sagAmount;
            uniforms.u_gpgpu_sagFalloffSharpness.value = S.gpgpu_sagFalloffSharpness;
            uniforms.u_gpgpu_sagAudioMod.value = S.gpgpu_sagAudioMod;
            uniforms.u_gpgpu_enableDroop.value = S.gpgpu_enableDroop;
            uniforms.u_gpgpu_droopAmount.value = S.gpgpu_droopAmount;
            uniforms.u_gpgpu_droopAudioMod.value = S.gpgpu_droopAudioMod;
            uniforms.u_gpgpu_droopFalloffSharpness.value = S.gpgpu_droopFalloffSharpness;
            uniforms.u_gpgpu_droopSupportedWidthFactor.value = S.gpgpu_droopSupportedWidthFactor;
            uniforms.u_gpgpu_droopSupportedDepthFactor.value = S.gpgpu_droopSupportedDepthFactor;
            
            uniforms.u_gpgpu_enablePeel.value = S.gpgpu_enablePeel;
            uniforms.u_gpgpu_peelAmount.value = S.gpgpu_peelAmount;
            uniforms.u_gpgpu_peelCurl.value = S.gpgpu_peelCurl;
            uniforms.u_gpgpu_peelEnableAudio.value = S.gpgpu_peelEnableAudio;
            uniforms.u_gpgpu_peelTextureAmount.value = S.gpgpu_peelTextureAmount;
            uniforms.u_gpgpu_peelDrift.value = S.gpgpu_peelDrift;
            
            uniforms.u_time.value = this.app.currentTime;
            uniforms.u_delta.value = delta;
            uniforms.u_audioLow.value = A.energy.low;
            if (A.audioTexture) { 
                uniforms.u_audioTexture.value = A.audioTexture;
            }
            
            this.gpuCompute.compute();
        }

        // --- UPDATE PARTICLE GPGPU SYSTEM (if it exists) ---
        if (this.particleGpuCompute) {
            const pUniformsV = this.particleVelocityVar.material.uniforms;
            const pUniformsP = this.particlePositionVar.material.uniforms;

            pUniformsV.u_time.value = this.app.currentTime;
            pUniformsP.u_delta.value = delta;

            pUniformsV.particle_flowScale.value = S.particle_flowScale;
            pUniformsV.particle_flowSpeed.value = S.particle_flowSpeed;
            pUniformsV.particle_flowStrength.value = S.particle_flowStrength;
            pUniformsV.particle_morphProgress.value = S.particle_morphProgress;
            pUniformsV.particle_attractionStrength.value = S.particle_attractionStrength;

            this.particleGpuCompute.compute();
        }
    }
};