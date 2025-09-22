import landscapeRenderVertexShader from '../shaders/landscape_render.vert?raw';
import cubewallRenderVertexShader from '../shaders/cubewall_render.vert?raw';
import landscapeRenderFragmentShader from '../shaders/landscape_render.frag?raw';
import particleRenderVertexShader from '../shaders/particle_render.vert?raw';
import particleRenderFragmentShader from '../shaders/particle_render.frag?raw';

export const ImagePlaneManager = {
    app: null,
    // --- Geometry ---
    landscape: null, 
    instancedMesh: null,
    particleSystem: null,
    
    // --- Materials ---
    landscapeMaterial: null,
    particlePBRMaterial: null,

    // --- State & Containers ---
    landscapeContainer: null, 
    boundingBox: null, 
    planeDimensions: null, 
    planeResolution: null, 
    currentTexture: null, 
    spinAccumulator: null, 
    calculatedParticleBaseSize: 1.0,

    state: {
        isUnderManualControl: false,
        manualControlReleaseTime: -1, 
        manualControlTimeoutId: null, 
        returnEaseFactor: 0.0,
        targetPosition: null, 
        targetQuaternion: null, 
        homePosition: null, 
        homeQuaternion: null 
    },

    autopilot: {
        active: false,
        preset: null,
        waypointProgress: 1.0, 
        waypointTransitionDuration: 20.0, 
        startPos: null, 
        endPos: null, 
        startQuat: null, 
        endQuat: null,  
    },
    
    _getWeightedRandom(distribution) { 
        const rand = Math.random();
        let cumulativeWeight = 0;
        for (const item of distribution) {
            cumulativeWeight += item.weight;
            if (rand < cumulativeWeight) {
                return this.app.THREE.MathUtils.randFloat(item.range[0], item.range[1]); 
            }
        }
        const lastItem = distribution[distribution.length - 1];
        return this.app.THREE.MathUtils.randFloat(lastItem.range[0], lastItem.range[1]);
    },

    init(appInstance) {
        this.app = appInstance;
        this.boundingBox = new this.app.THREE.Box3();
        this.planeDimensions = new this.app.THREE.Vector2(40, 40);
        this.planeResolution = new this.app.THREE.Vector2(128, 128);
        this.spinAccumulator = new this.app.THREE.Quaternion();

        this.state.homePosition = new this.app.THREE.Vector3();
        this.state.targetPosition = new this.app.THREE.Vector3();
        this.state.targetQuaternion = new this.app.THREE.Quaternion();
        this.state.homeQuaternion = new this.app.THREE.Quaternion();

        this.autopilot.startPos = new this.app.THREE.Vector3();
        this.autopilot.endPos = new this.app.THREE.Vector3();
        this.autopilot.startQuat = new this.app.THREE.Quaternion();
        this.autopilot.endQuat = new this.app.THREE.Quaternion();


        this.state.homePosition.copy(this.app.defaultVisualizerSettings.homePositionLandscape);
        this.state.targetPosition.copy(this.state.homePosition);
        this.landscapeContainer = new this.app.THREE.Group();
        this.app.scene.add(this.landscapeContainer);
    },

    startAutopilot(presetId) {
        if (!this.landscape && !this.instancedMesh && !this.particleSystem) return;
        const ap = this.autopilot;
        ap.active = true;
        ap.preset = presetId;
        if (this.app.UIManager) this.app.UIManager.updateMasterControls();
        ap.waypointProgress = 1.0; 
        console.log(`ImagePlane Autopilot STARTED with preset: ${presetId}`);
    },

    stopAutopilot() {
        const ap = this.autopilot;
        ap.active = false;
        ap.preset = null;
        console.log("ImagePlane Autopilot STOP triggered. Will return to home.");
    },
    
    generateNewRandomWaypoint() {
        const ap = this.autopilot;
        ap.startPos.copy(this.state.targetPosition);
        ap.startQuat.copy(this.state.targetQuaternion).multiply(this.spinAccumulator.clone().invert());

        let endPosX, endPosY, endPosZ;
        let eulerX, eulerY; 
        
        const orbitalTiltDistribution = [ { range: [-5, 5], weight: 0.50 }, { range: [5, 15], weight: 0.20 }, { range: [-15, -5], weight: 0.20 }, { range: [15, 30], weight: 0.05 }, { range: [-30, -15], weight: 0.05 }];

        if (ap.preset === 'autopilotPreset1') { endPosX = this.app.THREE.MathUtils.randFloat(-15, 15); endPosY = this.app.THREE.MathUtils.randFloat(-10, 10); endPosZ = this.app.THREE.MathUtils.randFloat(-5, 5); eulerX = this.app.THREE.MathUtils.randFloat(-2, 2); eulerY = this.app.THREE.MathUtils.randFloat(-5, 5);
        } else if (ap.preset === 'autopilotPreset2') { endPosX = this.app.THREE.MathUtils.randFloat(-5, 5); endPosY = this.app.THREE.MathUtils.randFloat(-5, 5); endPosZ = this.app.THREE.MathUtils.randFloat(-30, 10); eulerX = this.app.THREE.MathUtils.randFloat(-4, 4); eulerY = this.app.THREE.MathUtils.randFloat(-8, 8);
        } else if (ap.preset === 'autopilotPreset3') { endPosX = this.app.THREE.MathUtils.randFloat(-30, 30); endPosY = this.app.THREE.MathUtils.randFloat(-20, 20); endPosZ = this.app.THREE.MathUtils.randFloat(-40, 10); eulerX = this._getWeightedRandom(orbitalTiltDistribution); eulerY = this._getWeightedRandom([ { range: [-15, 15], weight: 0.8 }, { range: [-30, 30], weight: 0.2 } ]);
        } else if (ap.preset === 'autopilotPreset4') { endPosX = this.app.THREE.MathUtils.randFloat(-50, 50); endPosY = this.app.THREE.MathUtils.randFloat(-35, 35); endPosZ = this.app.THREE.MathUtils.randFloat(-45, 10); eulerX = this._getWeightedRandom(orbitalTiltDistribution); eulerY = this._getWeightedRandom([ { range: [-20, 20], weight: 0.4 }, { range: [20, 30], weight: 0.25 }, { range: [-30, -20], weight: 0.25 }, { range: [35, 45], weight: 0.05 }, { range: [-45, -35], weight: 0.05 } ]);
        } else { endPosX = this.app.THREE.MathUtils.randFloat(-70, 70); endPosY = this.app.THREE.MathUtils.randFloat(-50, 50); endPosZ = this.app.THREE.MathUtils.randFloat(-50, 10); eulerX = this._getWeightedRandom(orbitalTiltDistribution); eulerY = this._getWeightedRandom([ { range: [-15, 15], weight: 0.35 }, { range: [-35, 35], weight: 0.4 }, { range: [35, 50], weight: 0.125 }, { range: [-50, -35], weight: 0.125 } ]);
        }

        ap.endPos.set(endPosX, endPosY, endPosZ);
        const randomRotationEuler = new this.app.THREE.Euler(this.app.THREE.MathUtils.degToRad(eulerX), this.app.THREE.MathUtils.degToRad(eulerY), 0, 'YXZ' );
        const randomRotationQuat = new this.app.THREE.Quaternion().setFromEuler(randomRotationEuler);
        ap.endQuat.copy(this.state.homeQuaternion).multiply(randomRotationQuat);
        
        ap.waypointTransitionDuration = this.app.THREE.MathUtils.randFloat(18.0, 30.0);
        
        ap.waypointProgress = 0;
    },
    
    update(cappedDelta) {
        if (!this.landscapeContainer) return;
        const S = this.app.vizSettings;
        
        if (!S.enableLandscape) {
            this.landscapeContainer.visible = false;
            return;
        }
        this.landscapeContainer.visible = true;

        const isCubeMode = S.gpgpuGeometryMode === 'geocube';
        const isParticleMode = S.gpgpuGeometryMode === 'particles';
        if (this.landscape) this.landscape.visible = !isCubeMode && !isParticleMode;
        if (this.instancedMesh) this.instancedMesh.visible = isCubeMode;
        if (this.particleSystem) this.particleSystem.visible = isParticleMode;
        
        const state = this.state;
        const ap = this.autopilot;
        const now = this.app.currentTime;
        
        if (ap.active && ap.waypointProgress >= 1.0) {
            this.generateNewRandomWaypoint();
        }
        if (ap.active) {
            ap.waypointProgress = Math.min(1.0, ap.waypointProgress + cappedDelta / ap.waypointTransitionDuration);
        }
        
        let baseRotationTarget = new this.app.THREE.Quaternion();
        const manualHoldTime = 0.5;
        const inGracePeriod = state.manualControlReleaseTime > 0 && (now - state.manualControlReleaseTime < manualHoldTime);

        if (state.isUnderManualControl || inGracePeriod) {
            state.returnEaseFactor = 0; 
            baseRotationTarget.copy(state.targetQuaternion);
        } else if (ap.active) { 
            state.returnEaseFactor = 0; 
            const ease = 0.5 - 0.5 * Math.cos(ap.waypointProgress * Math.PI);
            state.targetPosition.lerpVectors(ap.startPos, ap.endPos, ease);
            baseRotationTarget.copy(ap.startQuat).slerp(ap.endQuat, ease);
            state.targetQuaternion.copy(baseRotationTarget);
        } else {
            const maxEase = 0.02;
            const easeIncrement = 0.0005;
            state.returnEaseFactor = Math.min(state.returnEaseFactor + easeIncrement, maxEase);
            
            state.targetPosition.lerp(state.homePosition, state.returnEaseFactor);
            state.targetQuaternion.slerp(this.state.homeQuaternion, state.returnEaseFactor);
            baseRotationTarget.copy(state.targetQuaternion);
        }
        
        if (S.enableLandscapeSpin) {
            const incrementalSpin = new this.app.THREE.Quaternion();
            const spinAxis = new this.app.THREE.Vector3(0, 0, 1);
            incrementalSpin.setFromAxisAngle(spinAxis, S.landscapeSpinSpeed * cappedDelta);
            this.spinAccumulator.premultiply(incrementalSpin);
        } else {
            this.spinAccumulator.slerp(new this.app.THREE.Quaternion(), 0.05);
        }
        
        if (state.isUnderManualControl || inGracePeriod) {
            baseRotationTarget.copy(state.targetQuaternion);
        }

        const finalTargetQuaternion = new this.app.THREE.Quaternion().copy(baseRotationTarget).multiply(this.spinAccumulator);

        this.landscapeContainer.position.lerp(state.targetPosition, 0.05);
        this.landscapeContainer.quaternion.slerp(finalTargetQuaternion, 0.1);
        this.landscapeContainer.scale.set(S.landscapeScale, S.landscapeScale, S.landscapeScale);
        
        if (this.app.ComputeManager) this.app.ComputeManager.update(cappedDelta); 
        
        this.updateDeformationUniforms();
        
        this.updateBoundingBox();
    },

    createDefaultLandscape() {
        this.updatePlaneDimensions();
        
        const S = this.app.vizSettings;
        const CM = this.app.ComputeManager;

        this._cleanupMeshes(); 

        if (S.gpgpuGeometryMode === 'particles') {
            this._createParticleSystem();
            // ** THE FIX IS HERE: Explicitly re-initialize the particle compute system **
            // This ensures that even after the system was disposed by another mode,
            // it gets properly rebuilt when we switch back to 'particles'.
            if (CM && CM.initParticleSystem) {
                CM.initParticleSystem();
            }
            this.app.CubeWallManager.setActive(false);
        } else if (S.gpgpuGeometryMode === 'geocube') {
            this._createInstancedCubeMesh();
            this.app.CubeWallManager.setActive(true);
        } else { 
            this._createPlaneMesh(S.gpgpuGeometryMode);
            this.app.CubeWallManager.setActive(false);
        }

        if (S.gpgpuGeometryMode !== 'particles') {
            if (CM && CM.init) {
                CM.init(this.app, this.planeDimensions.x, this.planeDimensions.y, this.planeResolution.x, this.planeResolution.y);
            }
        }

        this.applyAndStoreHomeOrientation();
        
        this.landscapeContainer.position.copy(this.state.homePosition);
        this.landscapeContainer.quaternion.copy(this.state.homeQuaternion);
        this.state.targetPosition.copy(this.state.homePosition);
        this.state.targetQuaternion.copy(this.state.homeQuaternion);
        this.landscapeContainer.scale.set(this.app.defaultVisualizerSettings.landscapeScale, this.app.defaultVisualizerSettings.landscapeScale, this.app.defaultVisualizerSettings.landscapeScale);
    },

    _cleanupMeshes() {
        if (this.landscape) {
            this.landscape.geometry.dispose();
            this.landscapeContainer.remove(this.landscape);
            this.landscape = null;
        }
        if (this.instancedMesh) {
            this.instancedMesh.geometry.dispose();
            this.landscapeContainer.remove(this.instancedMesh);
            this.instancedMesh = null;
        }
        if (this.particleSystem) {
            this.particleSystem.geometry.dispose();
            this.landscapeContainer.remove(this.particleSystem);
            this.particleSystem = null;
        }

        if (this.landscapeMaterial) {
            this.landscapeMaterial.dispose();
            this.landscapeMaterial = null;
        }
        if (this.particlePBRMaterial) {
            this.particlePBRMaterial.dispose();
            this.particlePBRMaterial = null;
        }
    },

    _createParticleSystem() {
        const S = this.app.vizSettings;
        const resolution = S.particle_resolution;
        const count = resolution * resolution;

        const cellSize = this.planeDimensions.x / (resolution - 1); 
        this.calculatedParticleBaseSize = cellSize * Math.sqrt(2);
        
        const geometry = new this.app.THREE.BufferGeometry();
        
        geometry.setAttribute('position', new this.app.THREE.BufferAttribute(new Float32Array(count * 3), 3));

        const uvs = new Float32Array(count * 2);
        for (let y = 0; y < resolution; y++) {
            for (let x = 0; x < resolution; x++) {
                const i = (y * resolution + x) * 2;
                uvs[i + 0] = x / (resolution - 1);
                uvs[i + 1] = y / (resolution - 1);
            }
        }
        geometry.setAttribute('uv', new this.app.THREE.BufferAttribute(uvs, 2));

        this._createParticlePBRMaterial();

        this.particleSystem = new this.app.THREE.Points(geometry, this.particlePBRMaterial);
        this.particleSystem.frustumCulled = false;
        this.landscapeContainer.add(this.particleSystem);
    },

    _createPlaneMesh(mode) {
        let landGeom = new this.app.THREE.PlaneGeometry(this.planeDimensions.x, this.planeDimensions.y, this.planeResolution.x - 1, this.planeResolution.y - 1);

        if (mode === 'faceted') {
            landGeom = landGeom.toNonIndexed();
        }
        
        const gpgpuUvs = new Float32Array(landGeom.attributes.position.count * 2);
        const originalUvs = landGeom.attributes.uv.array;
        for (let i = 0; i < gpgpuUvs.length / 2; i++) {
            gpgpuUvs[i * 2] = originalUvs[i * 2];
            gpgpuUvs[i * 2 + 1] = 1.0 - originalUvs[i * 2 + 1];
        }
        landGeom.setAttribute('uv_gpgpu', new this.app.THREE.BufferAttribute(gpgpuUvs, 2));

        this.createGPGPUMaterial();

        this.landscape = new this.app.THREE.Mesh(landGeom, this.landscapeMaterial);
        this.landscape.frustumCulled = false;
        this.landscapeContainer.add(this.landscape);
    },

    _createInstancedCubeMesh() {
        const GRID_SIZE = this.app.vizSettings.gpgpu_cubeWallGridSize;
        const CUBE_SIZE = this.planeDimensions.x / GRID_SIZE;
        const COUNT = GRID_SIZE * GRID_SIZE;

        const cubeGeom = new this.app.THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
        this.createGPGPUMaterial();
        
        this.instancedMesh = new this.app.THREE.InstancedMesh(cubeGeom, this.landscapeMaterial, COUNT);
        this.instancedMesh.frustumCulled = false;

        const instanceIds = new Float32Array(COUNT);
        for (let i = 0; i < COUNT; i++) {
            instanceIds[i] = i;
        }

        this.instancedMesh.geometry.setAttribute('instanceId', new this.app.THREE.InstancedBufferAttribute(instanceIds, 1));
        this.landscapeContainer.add(this.instancedMesh);
    },
    
    updatePlaneDimensions() {
        const baseSize = 40;
        const aspectRatio = parseFloat(this.app.vizSettings.planeAspectRatio) || 1.0;
        this.planeDimensions.set(baseSize * aspectRatio, baseSize);
    },

    applyAndStoreHomeOrientation() {
        if (!this.landscape && !this.instancedMesh && !this.particleSystem) return;
        const S = this.app.vizSettings;
        
        if (S.gpgpuGeometryMode === 'geocube' || S.gpgpuGeometryMode === 'particles') {
            this.state.homeQuaternion.identity(); 
        } else {
            const tempObject = new this.app.THREE.Object3D();
            if (S.planeOrientation === 'xz') { tempObject.rotateX(-Math.PI / 2); } 
            else if (S.planeOrientation === 'yz') { tempObject.rotateY(Math.PI / 2); }
            this.state.homeQuaternion.copy(tempObject.quaternion);
        }
    },
    
    _createParticlePBRMaterial() {
        const S = this.app.vizSettings;
        const CM = this.app.ComputeManager;
        const textureToUse = this.currentTexture || new this.app.THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, this.app.THREE.RGBAFormat);
        if(!this.currentTexture) textureToUse.needsUpdate = true;

        this.particlePBRMaterial = new this.app.THREE.ShaderMaterial({
            defines: {
                'USE_ENVMAP': ''
            },
            uniforms: {
                u_map: { value: textureToUse },
                u_positionTexture: { value: null },
                u_particleModelUVTexture: { value: CM.particleModelUVTexture },
                u_particleModelTexture: { value: this.app.UIManager?.particleModelTexture || null },
                u_particleColorMix: { value: 0.0 },
                particle_base_size: { value: 1.0 },
                particle_min_size: { value: 0.1 }, 
                u_particle_size_mix: { value: 1.0 }, 
                u_metalness: { value: S.metalness },
                u_roughness: { value: S.roughness },
                u_envMapIntensity: { value: S.reflectionStrength },
                u_lightColor: { value: new this.app.THREE.Color(S.lightColor) },
                u_ambientLightColor: { value: new this.app.THREE.Color(S.ambientLightColor) },
                u_lightDirection: { value: new this.app.THREE.Vector3().set(S.lightDirectionX, S.lightDirectionY, S.lightDirectionZ).normalize() },
                u_cameraPosition: { value: this.app.camera.position },
                t_envMap: { value: this.app.hdrTexture },
                u_time: { value: 0.0 },
                u_pixelRatio: { value: window.devicePixelRatio },
                u_particle_twinkleIntensity: { value: S.particle_twinkleIntensity },
            },
            vertexShader: particleRenderVertexShader,
            fragmentShader: particleRenderFragmentShader,
            transparent: true,
            depthWrite: false
        });
    },

    createGPGPUMaterial() {
        const S = this.app.vizSettings;
        const textureToUse = this.currentTexture || new this.app.THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, this.app.THREE.RGBAFormat);
        if(!this.currentTexture) textureToUse.needsUpdate = true;
        
        const vertexShader = S.gpgpuGeometryMode === 'geocube' ? cubewallRenderVertexShader : landscapeRenderVertexShader;
        const positionRenderTarget = this.app.ComputeManager.gpuCompute.getCurrentRenderTarget(this.app.ComputeManager.positionVariable);
        const uniforms = {
            u_map: { value: textureToUse },
            u_positionTexture: { value: positionRenderTarget.texture },
            u_initialPosition: { value: this.app.ComputeManager.initialPositionTexture },
            u_metalness: { value: S.metalness },
            u_roughness: { value: S.roughness },
            u_envMapIntensity: { value: S.reflectionStrength },
            u_time: { value: 0.0 },
            u_planeDimensions: { value: this.planeDimensions },
            u_planeResolution: { value: this.planeResolution },
            u_lightColor: { value: new this.app.THREE.Color(S.lightColor) },
            u_ambientLightColor: { value: new this.app.THREE.Color(S.ambientLightColor) },
            u_lightDirection: { value: new this.app.THREE.Vector3().set(S.lightDirectionX, S.lightDirectionY, S.lightDirectionZ).normalize() },
            u_cameraPosition: { value: this.app.camera.position },
            t_envMap: { value: this.app.hdrTexture },
            u_gpgpu_enableCubeWall: { value: S.gpgpu_enableCubeWall },
            u_gpgpu_cubeWallGridSize: { value: new this.app.THREE.Vector2(S.gpgpu_cubeWallGridSize, S.gpgpu_cubeWallGridSize) },
            u_gpgpu_cubeWallMorph: { value: S.gpgpu_cubeWallMorph },
            u_gpgpu_cubeWallSideColor: { value: new this.app.THREE.Color(S.gpgpu_cubeWallSideColor) },
            gpgpu_cubeWallUseImageTexture: { value: S.gpgpu_cubeWallUseImageTexture },
            u_gpgpu_cubeWallBevelWidth: { value: S.gpgpu_cubeWallBevelWidth },
            u_gpgpu_cubeWallBevelIntensity: { value: S.gpgpu_cubeWallBevelIntensity },
        };

        this.landscapeMaterial = new this.app.THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: vertexShader,
            fragmentShader: landscapeRenderFragmentShader,
            side: this.app.THREE.DoubleSide,
        });
    },

    loadTexture(file) {
        const objectURL = URL.createObjectURL(file);
        const applyTextureSettings = (texture) => {
            texture.wrapS = texture.wrapT = this.app.THREE.ClampToEdgeWrapping;
            texture.colorSpace = this.app.vizSettings.enablePBRColor ? this.app.THREE.SRGBColorSpace : this.app.THREE.NoColorSpace;
            texture.anisotropy = this.app.renderer.capabilities.getMaxAnisotropy();
            
            texture.flipY = false;
            texture.needsUpdate = true;
            
            if (this.landscapeMaterial) this.landscapeMaterial.uniforms.u_map.value = texture;
            if (this.particlePBRMaterial) this.particlePBRMaterial.uniforms.u_map.value = texture;
            
            this.currentTexture = texture;
        };

        if (file.type.startsWith('video/')) {
            const videoEl = document.getElementById('videoSourceElement');
            videoEl.src = objectURL;
            videoEl.play();
            const texture = new this.app.THREE.VideoTexture(videoEl);
            applyTextureSettings(texture);
        } else {
            new this.app.THREE.TextureLoader().load(objectURL, (texture) => {
                applyTextureSettings(texture);
                URL.revokeObjectURL(objectURL);
            }, undefined, (error) => {
                console.error("An error occurred loading the texture:", error);
            });
        }
    },

    updateDeformationUniforms() {
        const S = this.app.vizSettings;
        
        if (S.gpgpuGeometryMode === 'particles') {
            const CM = this.app.ComputeManager;
            if (!CM || !CM.particleGpuCompute) return;

            const posTarget = CM.particleGpuCompute.getCurrentRenderTarget(CM.particlePositionVar);
            
            if(this.particlePBRMaterial) {
                const U_PBR = this.particlePBRMaterial.uniforms;
                U_PBR.u_positionTexture.value = posTarget.texture;

                const coarseSize = this.calculatedParticleBaseSize * S.particle_base_size;
                const fineSize = S.particle_min_size;
                const finalBaseSize = this.app.THREE.MathUtils.lerp(coarseSize, fineSize, S.particle_size_mix);

                U_PBR.particle_base_size.value = finalBaseSize;
                U_PBR.particle_min_size.value = finalBaseSize;
                U_PBR.u_particle_size_mix.value = 0.0;

                U_PBR.u_pixelRatio.value = window.devicePixelRatio;
                U_PBR.u_particleColorMix.value = S.particle_morphProgress;
                
                if (this.app.UIManager.particleModelTexture) {
                    U_PBR.u_particleModelTexture.value = this.app.UIManager.particleModelTexture;
                }
                
                U_PBR.u_metalness.value = S.metalness;
                U_PBR.u_roughness.value = S.roughness;
                
                U_PBR.u_envMapIntensity.value = S.reflectionStrength;
                U_PBR.t_envMap.value = this.app.hdrTexture; 
                U_PBR.u_cameraPosition.value = this.app.camera.position;
                U_PBR.u_lightColor.value.set(S.lightColor);
                U_PBR.u_ambientLightColor.value.set(S.ambientLightColor);
                U_PBR.u_lightDirection.value.set(S.lightDirectionX, S.lightDirectionY, S.lightDirectionZ).normalize();
                
                U_PBR.u_time.value = this.app.currentTime;
                U_PBR.u_particle_twinkleIntensity.value = S.particle_twinkleIntensity;
            }
        } else { 
            if (!this.landscapeMaterial) return;
            const U = this.landscapeMaterial.uniforms;
            const positionTarget = this.app.ComputeManager.gpuCompute.getCurrentRenderTarget(this.app.ComputeManager.positionVariable);
            U.u_positionTexture.value = positionTarget.texture;
            
            U.u_time.value = this.app.currentTime;
            U.u_metalness.value = S.metalness;
            U.u_roughness.value = S.roughness;
            U.u_envMapIntensity.value = S.reflectionStrength;
            U.t_envMap.value = this.app.hdrTexture; 
            U.u_cameraPosition.value = this.app.camera.position;
            U.u_lightColor.value.set(S.lightColor);
            U.u_ambientLightColor.value.set(S.ambientLightColor);
            U.u_lightDirection.value.set(S.lightDirectionX, S.lightDirectionY, S.lightDirectionZ).normalize();
            
            U.u_gpgpu_enableCubeWall.value = S.gpgpu_enableCubeWall;
            U.u_gpgpu_cubeWallMorph.value = S.gpgpu_cubeWallMorph;
            U.u_gpgpu_cubeWallSideColor.value.set(S.gpgpu_cubeWallSideColor);
            U.gpgpu_cubeWallUseImageTexture.value = S.gpgpu_cubeWallUseImageTexture;
            U.u_gpgpu_cubeWallBevelWidth.value = S.gpgpu_cubeWallBevelWidth;
            U.u_gpgpu_cubeWallBevelIntensity.value = S.gpgpu_cubeWallBevelIntensity;
        }
    },

    updateBoundingBox() {
        const mesh = this.app.vizSettings.gpgpuGeometryMode === 'geocube' ? this.instancedMesh : 
                     this.app.vizSettings.gpgpuGeometryMode === 'particles' ? this.particleSystem : 
                     this.landscape;
        if (!mesh) return;
        this.landscapeContainer.updateWorldMatrix(true, false);
        this.boundingBox.setFromObject(this.landscapeContainer, true);
    },

    getCubeLocalPosition(gridX, gridY) {
        const S = this.app.vizSettings;
        const GRID_SIZE = S.gpgpu_cubeWallGridSize;
        const CUBE_SIZE = this.planeDimensions.x / GRID_SIZE;
        
        const offsetX = (GRID_SIZE * CUBE_SIZE) / 2 - CUBE_SIZE / 2;
        const offsetY = (GRID_SIZE * CUBE_SIZE) / 2 - CUBE_SIZE / 2;

        const x = gridX * CUBE_SIZE - offsetX;
        const y = gridY * CUBE_SIZE - offsetY;
        
        const maxSteppedDisplacement = this.planeDimensions.x * 0.4;
        const PIVOT_CUBE_ID = 40.0;
        const pivotGridX_logic = PIVOT_CUBE_ID % GRID_SIZE;
        const pivotGridY_logic = Math.floor(PIVOT_CUBE_ID / GRID_SIZE);
        const pivotValue = pivotGridX_logic + pivotGridY_logic;
        const currentValue = gridX + gridY;
        const minSteppedInput = 0.0 - pivotValue;
        const maxSteppedInput = (GRID_SIZE - 1) + (GRID_SIZE - 1) - pivotValue;
        const largestDisplacement = Math.max(Math.abs(minSteppedInput), Math.abs(maxSteppedInput));
        const wallStepDepth = largestDisplacement > 0 ? maxSteppedDisplacement / largestDisplacement : 0;
    
        const steppedZ = (currentValue - pivotValue) * wallStepDepth;
        const flatZ = 0;

        const z = this.app.THREE.MathUtils.lerp(flatZ, steppedZ, S.gpgpu_cubeWallMorph);

        return new this.app.THREE.Vector3(x, y, z);
    },

    /**
     * ** THE FIX IS HERE: New helper function **
     * Converts a grid coordinate (e.g., x=5, y=3) into a UV coordinate (e.g., u=0.5, v=0.3)
     * that can be used to sample textures or replicate shader logic.
     * @param {number} gridX The X index of the cube on the grid.
     * @param {number} gridY The Y index of the cube on the grid.
     * @returns {THREE.Vector2} The calculated UV coordinate.
     */
    getUvFromGridCoords(gridX, gridY) {
        const S = this.app.vizSettings;
        const GRID_SIZE = S.gpgpu_cubeWallGridSize;
        
        // This calculation matches the GPGPU texture sampling in the vertex shader
        const u = gridX / (GRID_SIZE - 1.0);
        const v = 1.0 - (gridY / (GRID_SIZE - 1.0)); // Flipped to match GPGPU texture coordinates

        return new this.app.THREE.Vector2(u, v);
    },

    getCubeWorldPosition(gridX, gridY) {
        const localPos = this.getCubeLocalPosition(gridX, gridY);
        const container = this.landscapeContainer;
        const worldPos = localPos.clone();
        worldPos.applyQuaternion(container.quaternion);
        worldPos.multiply(container.scale);
        worldPos.add(container.position);
        return worldPos;
    }
};