import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';

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
import fluidVelocityShader from './shaders/sph_velocity.glsl?raw';

export const ComputeManager = {
    app: null,
    _currentMode: null,

    gpuCompute: null,
    positionVariable: null,
    velocityVariable: null,
    _particleVelocityShader: particleVelocityShader,
    _fluidVelocityShader: fluidVelocityShader,
    particleFlatPositionTexture: null,
    particleModelPositionTexture: null,
    particleModelUVTexture: null,
    WIDTH: 0,
    HEIGHT: 0,
    AREA: 0,

    landscapeGpuCompute: null,
    landscapePositionVariable: null,
    landscapePreviousPositionVariable: null,
    landscapeInitialPositionTexture: null,
    clothEnableTime: -1,

    init(appInstance) {
        this.app = appInstance;
        const renderer = this.app.renderer;

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

        this._setupUnifiedParticleSimulation();
    },

    switchMode(newMode, isInitial = false) {
        if (this._currentMode === newMode) return;
        
        console.log(`ComputeManager: Switching mode from '${this._currentMode}' to -> '${newMode}'`);
        const oldMode = this._currentMode;
        this._currentMode = newMode;

        if (oldMode === 'particles') this._resetParticleUniforms();
        if (oldMode === 'fluidsim') this._resetFluidUniforms();

        const isParticleOrFluid = (newMode === 'particles' || newMode === 'fluidsim');
        const isLandscape = (newMode === 'faceted' || newMode === 'geocube');

        if (isParticleOrFluid) {
            const shader = (newMode === 'fluidsim') ? this._fluidVelocityShader : this._particleVelocityShader;
            if (this.velocityVariable.material.fragmentShader !== shader) {
                this.velocityVariable.material.fragmentShader = shader;
                this.velocityVariable.material.needsUpdate = true;
            }
        }
        
        if (isLandscape) {
            this.initLandscapeSystem();
        }

        if (!isInitial) {
            this.app.ImagePlaneManager.createDefaultLandscape();
        }
    },

    initLandscapeSystem() {
        const planeRes = this.app.ImagePlaneManager.planeResolution;
        if (this.landscapeGpuCompute && this.landscapeGpuCompute.width === planeRes.x && this.landscapeGpuCompute.height === planeRes.y) {
            return;
        }

        this.disposeLandscapeSystem();

        const renderer = this.app.renderer;
        this.landscapeGpuCompute = new GPUComputationRenderer(planeRes.x, planeRes.y, renderer);
        
        const planeDims = this.app.ImagePlaneManager.planeDimensions;
        const initialPositionData = new Float32Array(planeRes.x * planeRes.y * 4);
        const halfWidth = planeDims.x / 2;
        const halfHeight = planeDims.y / 2;

        for (let i = 0; i < planeRes.y; i++) {
            for (let j = 0; j < planeRes.x; j++) {
                const index = (i * planeRes.x + j);
                const x = (j / (planeRes.x - 1)) * planeDims.x - halfWidth;
                const y = (i / (planeRes.y - 1)) * planeDims.y - halfHeight;
                initialPositionData[index * 4 + 0] = x;
                initialPositionData[index * 4 + 1] = y;
                initialPositionData[index * 4 + 2] = 0.0;
                initialPositionData[index * 4 + 3] = 1.0;
            }
        }

        this.landscapeInitialPositionTexture = new this.app.THREE.DataTexture(initialPositionData, planeRes.x, planeRes.y, this.app.THREE.RGBAFormat, this.app.THREE.FloatType);
        this.landscapeInitialPositionTexture.needsUpdate = true;

        const copyShader = `void main() { gl_FragColor = texture2D(texturePosition, gl_FragCoord.xy / resolution.xy); }`;

        this.landscapePositionVariable = this.landscapeGpuCompute.addVariable('texturePosition', gpgpuPositionShader, this.landscapeInitialPositionTexture);
        this.landscapePreviousPositionVariable = this.landscapeGpuCompute.addVariable('texturePreviousPosition', copyShader, this.landscapeInitialPositionTexture);

        this.landscapeGpuCompute.setVariableDependencies(this.landscapePositionVariable, [this.landscapePositionVariable, this.landscapePreviousPositionVariable]);
        this.landscapeGpuCompute.setVariableDependencies(this.landscapePreviousPositionVariable, [this.landscapePositionVariable]);

        const uniforms = {
            u_initialPosition: { value: this.landscapeInitialPositionTexture },
            u_time: { value: 0 },
            u_delta: { value: 0 },
            u_audioLow: { value: 0 },
            u_audioTexture: { value: this.app.AudioProcessor.audioTexture },
            u_planeDimensions: { value: new this.app.THREE.Vector2(planeDims.x, planeDims.y) },
            u_gpgpu_enableWaterRipple: { value: false },
            u_gpgpu_rippleSpeed: { value: 0.5 },
            u_gpgpu_rippleStrength: { value: 1.0 },
            u_gpgpu_rippleFrequency: { value: 15.0 },
            u_gpgpu_enableEqRipple: { value: false },
            u_gpgpu_eqRippleStrength: { value: 2.0 },
            u_gpgpu_eqRippleStyle: { value: 0 },
            u_gpgpu_eqRippleBarCount: { value: 64.0 },
            u_gpgpu_eqRippleBarWidth: { value: 0.8 },
            u_gpgpu_eqRippleRangeStart: { value: 0.0 },
            u_gpgpu_eqRippleRangeEnd: { value: 1.0 },
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

        this.landscapePositionVariable.material.uniforms = uniforms;
        this.landscapePreviousPositionVariable.material.uniforms = this.landscapePositionVariable.material.uniforms;

        const error = this.landscapeGpuCompute.init();
        if (error !== null) {
            this.app.UIManager.logError("Landscape GPGPU Init Error: " + error);
        } else {
            this.app.UIManager.logSuccess("Landscape GPGPU Compute Initialized.");
        }
    },
    
    _setupUnifiedParticleSimulation() {
        if (this.gpuCompute) return;

        this.WIDTH = this.app.vizSettings.particle_resolution;
        this.HEIGHT = this.app.vizSettings.particle_resolution;
        this.AREA = this.WIDTH * this.HEIGHT;
        
        const renderer = this.app.renderer;
        this.gpuCompute = new GPUComputationRenderer(this.WIDTH, this.HEIGHT, renderer);

        this.particleFlatPositionTexture = this.gpuCompute.createTexture();
        this.particleModelPositionTexture = this.gpuCompute.createTexture();
        this.particleModelUVTexture = this.gpuCompute.createTexture();

        const dtPosition = this.gpuCompute.createTexture();
        const dtVelocity = this.gpuCompute.createTexture();
        
        this._fillInitialParticleData(dtPosition.image.data, dtVelocity.image.data);
        this._fillInitialParticleData(this.particleFlatPositionTexture.image.data, []);

        this.velocityVariable = this.gpuCompute.addVariable("textureVelocity", this._particleVelocityShader, dtVelocity);
        this.positionVariable = this.gpuCompute.addVariable("texturePosition", particlePositionShader, dtPosition);

        this.gpuCompute.setVariableDependencies(this.velocityVariable, [this.positionVariable, this.velocityVariable]);
        this.gpuCompute.setVariableDependencies(this.positionVariable, [this.positionVariable, this.velocityVariable]);
        
        const D = this.app.defaultVisualizerSettings;
        const vUniforms = this.velocityVariable.material.uniforms;
        vUniforms['u_time'] = { value: 0.0 };
        vUniforms['u_delta'] = { value: 0.0 };
        vUniforms['u_targetPositionMap'] = { value: this.particleFlatPositionTexture };
        vUniforms['u_initialPosition'] = { value: this.particleFlatPositionTexture };
        vUniforms['u_modelPosition'] = { value: this.particleModelPositionTexture };
        vUniforms['u_planeDimensions'] = { value: this.app.ImagePlaneManager.planeDimensions };
        vUniforms['particle_flowScale'] = { value: D.particle_flowScale };
        vUniforms['particle_flowSpeed'] = { value: D.particle_flowSpeed };
        vUniforms['particle_flowStrength'] = { value: D.particle_flowStrength };
        vUniforms['particle_attractionStrength'] = { value: D.particle_attractionStrength };
        vUniforms['particle_morphProgress'] = { value: D.particle_morphProgress };
        vUniforms['u_gravityWellPosition'] = { value: new this.app.THREE.Vector3(0, 0, 0) };
        vUniforms['u_gravityWellStrength'] = { value: 0.0 };
        vUniforms['u_orbitalStrength'] = { value: 0.0 };
        vUniforms['u_physicsState'] = { value: 0 };
        vUniforms['u_gravity'] = { value: new this.app.THREE.Vector3(0, D.fluid_gravity, 0) };
        vUniforms['u_targetState'] = { value: 0 };
        vUniforms['u_worldSize'] = { value: 60 };
        vUniforms['u_explosionCenter'] = { value: new this.app.THREE.Vector3(0, 0, 0) };
        vUniforms['u_explosionStrength'] = { value: 0.0 };
        vUniforms['u_vortexCenter'] = { value: new this.app.THREE.Vector2(0, 0) };
        vUniforms['u_vortexStrength'] = { value: 0.0 };
        vUniforms['fluid_curlStrength'] = { value: D.fluid_curlStrength };
        vUniforms['fluid_curlScale'] = { value: D.fluid_curlScale };
        vUniforms['fluid_curlSpeed'] = { value: D.fluid_curlSpeed };
        vUniforms['fluid_attractionStrength'] = { value: 0.0 };

        const pUniforms = this.positionVariable.material.uniforms;
        pUniforms['u_delta'] = { value: 0.0 };
        pUniforms['u_worldSize'] = vUniforms.u_worldSize;
        pUniforms['u_manualMorph'] = { value: 0.0 };
        pUniforms['u_targetState'] = vUniforms.u_targetState;
        pUniforms['u_initialPosition'] = vUniforms.u_initialPosition;
        pUniforms['u_modelPosition'] = vUniforms.u_modelPosition;
        
        const error = this.gpuCompute.init();
        if (error !== null) {
            this.app.UIManager.logError("Unified GPGPU failed to init.");
        } else {
            console.log("Unified GPGPU system initialized.");
        }
    },

    _resetParticleUniforms() {
        if (!this.velocityVariable) return;
        const D = this.app.defaultVisualizerSettings;
        const u = this.velocityVariable.material.uniforms;
        u.particle_flowStrength.value = D.particle_flowStrength;
        u.particle_flowSpeed.value = D.particle_flowSpeed;
        u.particle_flowScale.value = D.particle_flowScale;
        u.particle_attractionStrength.value = D.particle_attractionStrength;
        u.particle_morphProgress.value = D.particle_morphProgress;
        u.u_gravityWellStrength.value = 0.0;
        u.u_orbitalStrength.value = 0.0;
    },

    _resetFluidUniforms() {
        if (!this.velocityVariable) return;
        const D = this.app.defaultVisualizerSettings;
        const u = this.velocityVariable.material.uniforms;
        u.u_gravity.value.set(0, D.fluid_gravity, 0);
        u.fluid_attractionStrength.value = 0.0;
        u.u_explosionStrength.value = 0.0;
        u.u_vortexStrength.value = 0.0;
        u.fluid_curlStrength.value = D.fluid_curlStrength;
        u.fluid_curlScale.value = D.fluid_curlScale;
        u.fluid_curlSpeed.value = D.fluid_curlSpeed;
        u.u_physicsState.value = 0;
    },

    _fillInitialParticleData(positionData, velocityData) {
        const planeDims = this.app.ImagePlaneManager.planeDimensions;
        const halfWidth = planeDims.x / 2;
        const halfHeight = planeDims.y / 2;
        const res = this.app.vizSettings.particle_resolution;

        for (let i = 0; i < res * res; i++) {
            const k = i * 4;
            const u = (i % res) / (res - 1);
            const v = Math.floor(i / res) / (res - 1);

            positionData[k + 0] = u * planeDims.x - halfWidth;
            positionData[k + 1] = v * planeDims.y - halfHeight;
            positionData[k + 2] = 0.0;
            positionData[k + 3] = 1.0;
            
            if(velocityData && velocityData.length > 0) {
                velocityData[k + 0] = 0.0;
                velocityData[k + 1] = 0.0;
                velocityData[k + 2] = 0.0;
                velocityData[k + 3] = 0.0;
            }
        }
    },
    
    bakeToTexture(mesh, targetPositionTexture) {
        if (!mesh || !targetPositionTexture) return;
        const targetUVTexture = this.particleModelUVTexture;
        if (!targetUVTexture) return;
    
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
    
        for (let i = 0; i < particleCount; i++) {
            sampler.sample(_position, _normal, undefined, _uv);
            _position.sub(center).multiplyScalar(scale);
            const k = i * 4;
            posArray[k + 0] = _position.x;
            posArray[k + 1] = _position.y;
            posArray[k + 2] = _position.z;
            uvArray[k + 0] = hasUVs ? _uv.x : 0.0;
            uvArray[k + 1] = hasUVs ? _uv.y : 0.0;
        }
    
        targetPositionTexture.needsUpdate = true;
        targetUVTexture.needsUpdate = true;
        console.log(`Baked ${particleCount} points (position & UVs) to textures.`);
    },

    dispose() {
        this.disposeLandscapeSystem();
        this.disposeParticleSystem();
    },

    disposeLandscapeSystem() {
        if (this.landscapeGpuCompute) {
            this.landscapeGpuCompute.dispose();
            if (this.landscapeInitialPositionTexture) this.landscapeInitialPositionTexture.dispose();
            this.landscapeGpuCompute = null;
            this.landscapePositionVariable = null;
            this.landscapePreviousPositionVariable = null;
            this.landscapeInitialPositionTexture = null;
            console.log("Landscape GPGPU system disposed.");
        }
    },

    disposeParticleSystem() {
        if (this.gpuCompute) {
            this.gpuCompute.dispose();
            if (this.particleFlatPositionTexture) this.particleFlatPositionTexture.dispose();
            if (this.particleModelPositionTexture) this.particleModelPositionTexture.dispose();
            if (this.particleModelUVTexture) this.particleModelUVTexture.dispose();
            this.gpuCompute = null;
            this.positionVariable = null;
            this.velocityVariable = null;
            this.particleFlatPositionTexture = null;
            this.particleModelPositionTexture = null;
            this.particleModelUVTexture = null;
            console.log("Unified Particle GPGPU system disposed.");
        }
    },

    update(delta) {
        const S = this.app.vizSettings;
        const A = this.app.AudioProcessor;
        
        const isParticleOrFluid = (this._currentMode === 'particles' || this._currentMode === 'fluidsim');
        const isLandscape = (this._currentMode === 'faceted' || this._currentMode === 'geocube');

        if (isLandscape && this.landscapeGpuCompute) {
            const uniforms = this.landscapePositionVariable.material.uniforms;
            
            // --- BUG FIX: CORRECTLY UPDATE THE .value PROPERTY OF EXISTING UNIFORMS ---
            if (S.gpgpu_enableCloth && this.clothEnableTime < 0) this.clothEnableTime = this.app.currentTime;
            else if (!S.gpgpu_enableCloth) this.clothEnableTime = -1;
    
            let blendFactor = 0.0;
            if (this.clothEnableTime >= 0) {
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
            if (A.audioTexture) uniforms.u_audioTexture.value = A.audioTexture;
            // --- END BUG FIX ---

            this.landscapeGpuCompute.compute();
        }

        if (isParticleOrFluid && this.gpuCompute) {
            const vUniforms = this.velocityVariable.material.uniforms;
            const pUniforms = this.positionVariable.material.uniforms;
            
            vUniforms.u_time.value = this.app.currentTime;
            vUniforms.u_delta.value = delta;
            pUniforms.u_delta.value = delta;
            
            if (this._currentMode === 'particles') {
                vUniforms.particle_flowScale.value = S.particle_flowScale;
                vUniforms.particle_flowSpeed.value = S.particle_flowSpeed;
                vUniforms.particle_flowStrength.value = S.particle_flowStrength;
                vUniforms.particle_morphProgress.value = S.particle_morphProgress;
                vUniforms.particle_attractionStrength.value = S.particle_attractionStrength;
            } else if (this._currentMode === 'fluidsim') {
                const isDirectorActive = this.app.FluidDirector.activeScript;
                const isManualActive = pUniforms.u_manualMorph.value > 0.0;

                if (!isDirectorActive) {
                    vUniforms.fluid_curlStrength.value = S.fluid_curlStrength;
                    vUniforms.fluid_curlScale.value = S.fluid_curlScale;
                    vUniforms.fluid_curlSpeed.value = S.fluid_curlSpeed;
                }
                
                vUniforms.u_physicsState.value = (isDirectorActive || isManualActive) ? 1 : 0;
                if (vUniforms.u_physicsState.value === 0) return;
            }

            this.gpuCompute.compute();
        }
    }
};