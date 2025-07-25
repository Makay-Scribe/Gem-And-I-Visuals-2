import landscapeRenderVertexShader from '../shaders/landscape_render.vert?raw';
import landscapeRenderFragmentShader from '../shaders/landscape_render.frag?raw';

export const ImagePlaneManager = {
    app: null,
    landscape: null,
    landscapeContainer: null, 
    landscapeMaterial: null,
    boundingBox: null, // Initialize as null, set in init
    planeDimensions: null, // Initialize as null, set in init
    planeResolution: null, // Initialize as null, set in init
    currentTexture: null, 
    spinAccumulator: null, // Initialize as null, set in init

    state: {
        isUnderManualControl: false,
        manualControlReleaseTime: -1, 
        manualControlTimeoutId: null, 
        returnEaseFactor: 0.0,
        targetPosition: null, // Initialize as null, set in init
        targetQuaternion: null, // Initialize as null, set in init
        homePosition: null, // Initialize as null, set in init
        homeQuaternion: null // Initialize as null, set in init
    },

    autopilot: {
        active: false,
        preset: null,
        waypointProgress: 1.0, 
        waypointTransitionDuration: 20.0, 
        startPos: null, // Initialize as null, set in init
        endPos: null, // Initialize as null, set in init
        startQuat: null, // Initialize as null, set in init
        endQuat: null,   // Initialize as null, set in init
    },

    /**
     * Generates a random number based on a weighted distribution.
     * This is now a private method of ImagePlaneManager.
     * @param {Array<Object>} distribution - An array of objects, e.g., [{ range: [min, max], weight: 0.5 }, ...]
     * The weights should add up to 1.0.
     * @returns {number} A randomly generated number within one of the specified ranges.
     */
    _getWeightedRandom(distribution) { // Moved into ImagePlaneManager
        const rand = Math.random();
        let cumulativeWeight = 0;
        for (const item of distribution) {
            cumulativeWeight += item.weight;
            if (rand < cumulativeWeight) {
                return this.app.THREE.MathUtils.randFloat(item.range[0], item.range[1]); // Use this.app.THREE
            }
        }
        // Fallback for floating point precision issues
        const lastItem = distribution[distribution.length - 1];
        return this.app.THREE.MathUtils.randFloat(lastItem.range[0], lastItem.range[1]); // Use this.app.THREE
    },

    init(appInstance) {
        this.app = appInstance;
        // Initialize Three.js dependent properties here
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
        this.landscapeContainer = new this.app.THREE.Group(); // Use app.THREE
        this.app.scene.add(this.landscapeContainer);
        // this.createDefaultLandscape(); // Called explicitly by main.js now
    },

    startAutopilot(presetId) {
        if (!this.landscape) return;
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
        if (!this.landscapeContainer || !this.landscape) return;
        const S = this.app.vizSettings;
        
        if (!S.enableLandscape) {
            this.landscapeContainer.visible = false;
            return;
        }
        this.landscapeContainer.visible = true;

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
            // Idle: return to home with feathering
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
        
        // ComputeManager update call here is fine, as ComputeManager.update() only steps the simulation
        if (this.app.ComputeManager) this.app.ComputeManager.update(cappedDelta); 
        this.updateDeformationUniforms();
        this.updateBoundingBox();
    },

    // This method is now called externally by main.js after all managers are initialized
    createDefaultLandscape() {
        this.updatePlaneDimensions();
        if (this.landscape) {
            this.landscapeContainer.remove(this.landscape);
            if (this.landscape.geometry) this.landscape.geometry.dispose();
            if (this.landscapeMaterial) this.landscapeMaterial.dispose();
        }
        
        let landGeom = new this.app.THREE.PlaneGeometry(this.planeDimensions.x, this.planeDimensions.y, this.planeResolution.x - 1, this.planeResolution.y - 1);

        if (this.app.vizSettings.gpgpuGeometryMode === 'faceted') {
            console.log("Creating faceted (non-indexed) geometry.");
            landGeom = landGeom.toNonIndexed();
            const positions = landGeom.attributes.position.array;
            const vertexCount = landGeom.attributes.position.count;
            const triangleCenters = new Float32Array(vertexCount * 3);

            for (let i = 0; i < vertexCount; i += 3) {
                const vA = new this.app.THREE.Vector3().fromArray(positions, i * 3);
                const vB = new this.app.THREE.Vector3().fromArray(positions, (i + 1) * 3);
                const vC = new this.app.THREE.Vector3().fromArray(positions, (i + 2) * 3);
                const center = new this.app.THREE.Vector3().add(vA).add(vB).add(vC).divideScalar(3);
                center.toArray(triangleCenters, i * 3);
                center.toArray(triangleCenters, (i + 1) * 3);
                center.toArray(triangleCenters, (i + 2) * 3);
            }
            landGeom.setAttribute('triangleCenter', new this.app.THREE.BufferAttribute(triangleCenters, 3));

            const uvGpgpuAttribute = landGeom.attributes.uv.clone();
            const uvArray = uvGpgpuAttribute.array;
            for (let i = 1; i < uvArray.length; i += 2) {
                uvArray[i] = 1.0 - uvArray[i]; // Flip V coordinate for GPGPU compatibility
            }
            landGeom.setAttribute('uv_gpgpu', uvGpgpuAttribute);

        } else {
            console.log("Creating continuous (standard) geometry.");
            const uvCount = this.planeResolution.x * this.planeResolution.y;
            const uv_gpu = new Float32Array(uvCount * 2);
            for (let i = 0; i < this.planeResolution.y; i++) {
                for (let j = 0; j < this.planeResolution.x; j++) {
                    const idx = (i * this.planeResolution.x + j);
                    uv_gpu[idx * 2] = j / (this.planeResolution.x - 1); 
                    uv_gpu[idx * 2 + 1] = 1.0 - (i / (this.planeResolution.y - 1)); // Flip V coordinate
                }
            }
            landGeom.setAttribute('uv_gpgpu', new this.app.THREE.BufferAttribute(uv_gpu, 2));
        }

        const vertexCount = landGeom.attributes.position.count;
        const triangleIds = new Float32Array(vertexCount);
        for(let i = 0; i < vertexCount; i++) {
            triangleIds[i] = Math.floor(i / 3);
        }
        landGeom.setAttribute('triangleId', new this.app.THREE.BufferAttribute(triangleIds, 1));
        
        this.createMaterials();
        this.landscape = new this.app.THREE.Mesh(landGeom, this.landscapeMaterial);
        this.landscape.frustumCulled = false;
        
        this.landscapeContainer.add(this.landscape);

        this.applyAndStoreHomeOrientation();
        
        this.landscapeContainer.position.copy(this.state.homePosition);
        this.landscapeContainer.quaternion.copy(this.state.homeQuaternion);
        this.state.targetPosition.copy(this.state.homePosition);
        this.state.targetQuaternion.copy(this.state.homeQuaternion);
        this.landscapeContainer.scale.set(this.app.defaultVisualizerSettings.landscapeScale, this.app.defaultVisualizerSettings.landscapeScale, this.app.defaultVisualizerSettings.landscapeScale);
    },

    updatePlaneDimensions() {
        const baseSize = 40;
        const aspectRatio = parseFloat(this.app.vizSettings.planeAspectRatio) || 1.0;
        this.planeDimensions.set(baseSize * aspectRatio, baseSize);
    },

    applyAndStoreHomeOrientation() {
        if (!this.landscape) return;
        const S = this.app.vizSettings;
        const tempLandscape = new this.app.THREE.Object3D();
        if (S.planeOrientation === 'xz') { tempLandscape.rotateX(-Math.PI / 2); } 
        else if (S.planeOrientation === 'yz') { tempLandscape.rotateY(Math.PI / 2); }
        
        this.state.homeQuaternion.copy(tempLandscape.quaternion);
    },
    
    createMaterials() {
        const S = this.app.vizSettings;
        const textureToUse = this.currentTexture || new this.app.THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, this.app.THREE.RGBAFormat);
        if(!this.currentTexture) textureToUse.needsUpdate = true;

        // ComputeManager's gpuCompute will be initialized by main.js BEFORE this is called the first time.
        // So positionRenderTarget.texture should be available.
        const positionRenderTarget = this.app.ComputeManager.gpuCompute.getCurrentRenderTarget(this.app.ComputeManager.positionVariable);
        
        this.landscapeMaterial = new this.app.THREE.ShaderMaterial({
            uniforms: {
                u_map: { value: textureToUse },
                u_positionTexture: { value: positionRenderTarget.texture }, 
                u_metalness: { value: S.metalness },
                u_roughness: { value: S.roughness },
                u_envMapIntensity: { value: S.reflectionStrength },
                u_time: { value: 0.0 },
                u_audioLow: { value: 0.0 },
                u_audioBeat: { value: 0.0 },
                u_planeResolution: { value: this.planeResolution },
                u_lightColor: { value: new this.app.THREE.Color(S.lightColor) },
                u_ambientLightColor: { value: new this.app.THREE.Color(S.ambientLightColor) },
                u_lightDirection: { value: new this.app.THREE.Vector3().set(S.lightDirectionX, S.lightDirectionY, S.lightDirectionZ).normalize() },
                u_cameraPosition: { value: this.app.camera.position },
                t_envMap: { value: this.app.hdrTexture },
                u_imageEffect_enableBalloon: { value: S.imageEffect_enableBalloon },
                u_imageEffect_point: { value: new this.app.THREE.Vector2(S.imageEffect_pointX, S.imageEffect_pointY) },
                u_imageEffect_strength: { value: S.imageEffect_strength },
                u_imageEffect_radius: { value: S.imageEffect_radius },
                u_imageEffect_audioInfluence: { value: S.imageEffect_audioInfluence },
                u_imageEffect_enableJolt: { value: S.imageEffect_enableJolt },
                u_imageEffect_joltStrength: { value: S.imageEffect_joltStrength },
                u_imageEffect_joltSpeed: { value: S.imageEffect_joltSpeed },
                u_imageEffect_joltAudioInfluence: { value: S.imageEffect_joltAudioInfluence },
                u_gpgpu_enableTriangleWave: { value: S.gpgpu_enableTriangleWave },
                u_gpgpu_triWaveColor1: { value: new this.app.THREE.Color(S.gpgpu_triWaveColor1) },
                u_gpgpu_triWaveColor2: { value: new this.app.THREE.Color(S.gpgpu_triWaveColor2) },
                u_gpgpu_triWaveAmplitude: { value: S.gpgpu_triWaveAmplitude },
                u_gpgpu_triWaveFrequency: { value: S.gpgpu_triWaveFrequency },
                u_gpgpu_triWaveSpeed: { value: S.gpgpu_triWaveSpeed },
                u_gpgpu_enableQbert: { value: S.gpgpu_enableQbert },
                u_gpgpu_qbertJumpAmount: { value: S.gpgpu_qbertJumpAmount },
                u_gpgpu_qbertFlashChance: { value: S.gpgpu_qbertFlashChance / 100.0 },
            },
            vertexShader: landscapeRenderVertexShader,
            fragmentShader: landscapeRenderFragmentShader,
            side: this.app.THREE.DoubleSide,
            transparent: true,
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
            if (this.landscapeMaterial && this.landscapeMaterial.uniforms.u_map) {
                if (this.landscapeMaterial.uniforms.u_map.value) { this.landscapeMaterial.uniforms.u_map.value.dispose(); }
                this.landscapeMaterial.uniforms.u_map.value = texture;
                this.currentTexture = texture;
            }
        };

        if (file.type.startsWith('video/')) {
            const videoEl = document.getElementById('videoSourceElement');
            if (!videoEl) {
                console.warn("ImagePlaneManager: videoSourceElement not found.");
                if (this.app.UIManager) this.app.UIManager.logError("Video element missing!");
                return;
            }
            videoEl.src = objectURL;
            videoEl.play();
            const texture = new this.app.THREE.VideoTexture(videoEl);
            applyTextureSettings(texture);
        } else {
            new this.app.THREE.TextureLoader().load(objectURL, (texture) => {
                applyTextureSettings(texture);
                URL.revokeObjectURL(objectURL);
            });
        }
    },

    updateDeformationUniforms() {
        if (!this.landscapeMaterial || !this.app.ComputeManager || !this.app.ComputeManager.gpuCompute) { return; }
        const S = this.app.vizSettings;
        
        const U = this.landscapeMaterial.uniforms;
        
        U.u_time.value = this.app.currentTime;

        if (S.deformationEngine === 'gpgpu' && !S.gpgpu_enableTriangleWave && !S.gpgpu_enableQbert) {
            const positionTarget = this.app.ComputeManager.gpuCompute.getCurrentRenderTarget(this.app.ComputeManager.positionVariable);
            U.u_positionTexture.value = positionTarget.texture;
        }
        
        U.u_audioLow.value = this.app.AudioProcessor.energy.low;
        U.u_audioBeat.value = this.app.AudioProcessor.triggers.beat ? 1.0 : 0.0;
        U.u_metalness.value = S.metalness;
        U.u_roughness.value = S.roughness;
        U.u_envMapIntensity.value = S.reflectionStrength;
        U.t_envMap.value = this.app.hdrTexture; 
        U.u_cameraPosition.value = this.app.camera.position;
        U.u_lightColor.value.set(S.lightColor);
        U.u_ambientLightColor.value.set(S.ambientLightColor);
        U.u_lightDirection.value.set(S.lightDirectionX, S.lightDirectionY, S.lightDirectionZ).normalize();

        U.u_imageEffect_enableBalloon.value = S.imageEffect_enableBalloon;
        if (S.imageEffect_enableBalloon) {
            U.u_imageEffect_point.value.set(S.imageEffect_pointX, S.imageEffect_pointY);
            U.u_imageEffect_strength.value = S.imageEffect_strength;
            U.u_imageEffect_radius.value = S.imageEffect_radius;
            U.u_imageEffect_audioInfluence.value = S.imageEffect_audioInfluence;
        }

        U.u_imageEffect_enableJolt.value = S.imageEffect_enableJolt;
        if (S.imageEffect_enableJolt) {
            U.u_imageEffect_joltStrength.value = S.imageEffect_joltStrength;
            U.u_imageEffect_joltSpeed.value = S.imageEffect_joltSpeed;
            U.u_imageEffect_joltAudioInfluence.value = S.imageEffect_joltAudioInfluence;
        }

        U.u_gpgpu_enableTriangleWave.value = S.gpgpu_enableTriangleWave;
        if (S.gpgpu_enableTriangleWave) {
            U.u_gpgpu_triWaveColor1.value.set(S.gpgpu_triWaveColor1);
            U.u_gpgpu_triWaveColor2.value.set(S.gpgpu_triWaveColor2);
            U.u_gpgpu_triWaveAmplitude.value = S.gpgpu_triWaveAmplitude;
            U.u_gpgpu_triWaveFrequency.value = S.gpgpu_triWaveFrequency;
            U.u_gpgpu_triWaveSpeed.value = S.gpgpu_triWaveSpeed;
        }

        U.u_gpgpu_enableQbert.value = S.gpgpu_enableQbert;
        if (S.gpgpu_enableQbert) {
            U.u_gpgpu_qbertJumpAmount.value = S.gpgpu_qbertJumpAmount;
            U.u_gpgpu_qbertFlashChance.value = S.gpgpu_qbertFlashChance / 100.0;
        }
    },

    updateBoundingBox() {
        if (!this.landscapeContainer) return;
        this.landscapeContainer.updateWorldMatrix(true, false);
        this.boundingBox.setFromObject(this.landscapeContainer, true);
    }
};