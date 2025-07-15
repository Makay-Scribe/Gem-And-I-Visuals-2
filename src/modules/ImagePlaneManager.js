import * as THREE from 'three'; 
import landscapeRenderVertexShader from '../shaders/landscape_render.vert?raw';
import landscapeRenderFragmentShader from '../shaders/landscape_render.frag?raw';

/**
 * Generates a random number based on a weighted distribution.
 * @param {Array<Object>} distribution - An array of objects, e.g., [{ range: [min, max], weight: 0.5 }, ...]
 * The weights should add up to 1.0.
 * @returns {number} A randomly generated number within one of the specified ranges.
 */
function getWeightedRandom(distribution) {
    const rand = Math.random();
    let cumulativeWeight = 0;
    for (const item of distribution) {
        cumulativeWeight += item.weight;
        if (rand < cumulativeWeight) {
            return THREE.MathUtils.randFloat(item.range[0], item.range[1]);
        }
    }
    // Fallback for floating point precision issues
    const lastItem = distribution[distribution.length - 1];
    return THREE.MathUtils.randFloat(lastItem.range[0], lastItem.range[1]);
}

export const ImagePlaneManager = {
    app: null,
    landscape: null,
    landscapeContainer: null, 
    landscapeMaterial: null,
    boundingBox: new THREE.Box3(),
    planeDimensions: new THREE.Vector2(40, 40),
    planeResolution: new THREE.Vector2(128, 128),
    currentTexture: null, 

    state: {
        isUnderManualControl: false,
        manualControlReleaseTime: -1, 
        manualControlTimeoutId: null, // To manage scroll wheel end detection
        targetPosition: new THREE.Vector3(),
        targetQuaternion: new THREE.Quaternion(),
        homePosition: new THREE.Vector3(),
        homeQuaternion: new THREE.Quaternion()
    },

    autopilot: {
        active: false,
        preset: null,
        waypointProgress: 1.0, 
        waypointTransitionDuration: 20.0, // Default duration
        startPos: new THREE.Vector3(),
        endPos: new THREE.Vector3(),
        startQuat: new THREE.Quaternion(),
        endQuat: new THREE.Quaternion(),
    },

    init(appInstance) {
        this.app = appInstance;
        this.state.homePosition.copy(this.app.defaultVisualizerSettings.homePositionLandscape);
        this.state.targetPosition.copy(this.state.homePosition);
        this.landscapeContainer = new THREE.Group();
        this.app.scene.add(this.landscapeContainer);
        this.createDefaultLandscape();
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
        ap.startQuat.copy(this.state.targetQuaternion);

        let endPosX, endPosY, endPosZ;
        let eulerX, eulerY, eulerZ;
        
        const orbitalTiltDistribution = [
            { range: [-5, 5], weight: 0.50 },      // 50% little/no tilt
            { range: [5, 15], weight: 0.20 },      // 40% marginal tilt
            { range: [-15, -5], weight: 0.20 },
            { range: [15, 30], weight: 0.05 },     // 10% medium tilt
            { range: [-30, -15], weight: 0.05 }
        ];

        if (ap.preset === 'autopilotPreset1') { // CALM DRIFT
            endPosX = THREE.MathUtils.randFloat(-15, 15);
            endPosY = THREE.MathUtils.randFloat(-10, 10);
            endPosZ = THREE.MathUtils.randFloat(-5, 5);
            eulerX = THREE.MathUtils.randFloat(-2, 2); // very little tilt
            eulerY = THREE.MathUtils.randFloat(-5, 5); // very little turn
            eulerZ = THREE.MathUtils.randFloat(-1, 1); // very little roll

        } else if (ap.preset === 'autopilotPreset2') { // BREATHING ZOOM
            endPosX = THREE.MathUtils.randFloat(-5, 5);
            endPosY = THREE.MathUtils.randFloat(-5, 5);
            endPosZ = THREE.MathUtils.randFloat(-30, 10); // focus on z-axis
            eulerX = THREE.MathUtils.randFloat(-4, 4);
            eulerY = THREE.MathUtils.randFloat(-8, 8);
            eulerZ = THREE.MathUtils.randFloat(-2, 2);
            
        } else if (ap.preset === 'autopilotPreset3') { // TIGHT LEASH
            endPosX = THREE.MathUtils.randFloat(-30, 30);
            endPosY = THREE.MathUtils.randFloat(-20, 20);
            endPosZ = THREE.MathUtils.randFloat(-40, 10);
            eulerX = getWeightedRandom(orbitalTiltDistribution);
            eulerY = getWeightedRandom([ { range: [-15, 15], weight: 0.8 }, { range: [-30, 30], weight: 0.2 } ]);
            eulerZ = THREE.MathUtils.randFloat(-5, 5);

        } else if (ap.preset === 'autopilotPreset4') { // MEDIUM LEASH
            endPosX = THREE.MathUtils.randFloat(-50, 50);
            endPosY = THREE.MathUtils.randFloat(-35, 35);
            endPosZ = THREE.MathUtils.randFloat(-45, 10);
            eulerX = getWeightedRandom(orbitalTiltDistribution);
            eulerY = getWeightedRandom([ { range: [-20, 20], weight: 0.4 }, { range: [20, 30], weight: 0.25 }, { range: [-30, -20], weight: 0.25 }, { range: [35, 45], weight: 0.05 }, { range: [-45, -35], weight: 0.05 } ]);
            eulerZ = THREE.MathUtils.randFloat(-10, 10);

        } else if (ap.preset === 'autopilotPreset5') { // LOOSE LEASH
            endPosX = THREE.MathUtils.randFloat(-70, 70);
            endPosY = THREE.MathUtils.randFloat(-50, 50);
            endPosZ = THREE.MathUtils.randFloat(-50, 10);
            eulerX = getWeightedRandom(orbitalTiltDistribution);
            eulerY = getWeightedRandom([ { range: [-15, 15], weight: 0.35 }, { range: [-35, 35], weight: 0.4 }, { range: [35, 50], weight: 0.125 }, { range: [-50, -35], weight: 0.125 } ]);
            eulerZ = THREE.MathUtils.randFloat(-15, 15);
        }

        ap.endPos.set(endPosX, endPosY, endPosZ);

        const endRot = new THREE.Euler(
            THREE.MathUtils.degToRad(eulerX),
            THREE.MathUtils.degToRad(eulerY),
            THREE.MathUtils.degToRad(eulerZ),
            'YXZ' 
        );
        ap.endQuat.setFromEuler(endRot);
        
        ap.waypointTransitionDuration = THREE.MathUtils.randFloat(18.0, 22.0);
        ap.waypointProgress = 0;
    },
    
    updateAutopilot(delta) {
        const ap = this.autopilot;
        if (!ap.active) return;

        if (ap.waypointProgress >= 1.0) {
            this.generateNewRandomWaypoint();
        }

        ap.waypointProgress = Math.min(1.0, ap.waypointProgress + delta / ap.waypointTransitionDuration);
        const ease = 0.5 - 0.5 * Math.cos(ap.waypointProgress * Math.PI);
        
        this.state.targetPosition.lerpVectors(ap.startPos, ap.endPos, ease);
        this.state.targetQuaternion.slerp(ap.startQuat, ap.endQuat, ease);
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
        const now = this.app.currentTime;
        const manualReturnDelay = 0.5;

        if (this.autopilot.active) {
            this.updateAutopilot(cappedDelta);
        } else if (state.isUnderManualControl) {
            state.manualControlReleaseTime = -1;
        } else if (state.manualControlReleaseTime > 0 && (now - state.manualControlReleaseTime < manualReturnDelay)) {
            // Do nothing, leave landscape where user placed it.
        } else {
            state.targetPosition.lerp(state.homePosition, 0.02);
            state.targetQuaternion.slerp(state.homeQuaternion, 0.02);
        }

        this.landscapeContainer.position.lerp(this.state.targetPosition, 0.05);
        this.landscapeContainer.quaternion.slerp(this.state.targetQuaternion, 0.05);
        this.landscapeContainer.scale.set(S.landscapeScale, S.landscapeScale, S.landscapeScale);
        
        if (S.enableLandscapeSpin && S.landscapeSpinSpeed !== 0) {
            this.landscape.rotateOnAxis(new THREE.Vector3(0, 0, 1), -S.landscapeSpinSpeed * cappedDelta);
        }
        
        if (this.app.ComputeManager) this.app.ComputeManager.update(cappedDelta); 
        this.updateDeformationUniforms();
        this.updateBoundingBox();
    },

    createDefaultLandscape() {
        this.updatePlaneDimensions();
        if (this.landscape) {
            this.landscapeContainer.remove(this.landscape);
            if (this.landscape.geometry) this.landscape.geometry.dispose();
            if (this.landscapeMaterial) this.landscapeMaterial.dispose();
        }

        // ** THE FIX IS HERE **
        // Unconditionally re-initialize the ComputeManager whenever the landscape is created.
        // This ensures the GPGPU simulation always matches the visual plane's dimensions.
        this.app.ComputeManager.init(this.app, this.planeDimensions.x, this.planeDimensions.y, this.planeResolution.x, this.planeResolution.y);
        
        let landGeom = new THREE.PlaneGeometry(this.planeDimensions.x, this.planeDimensions.y, this.planeResolution.x - 1, this.planeResolution.y - 1);

        if (this.app.vizSettings.gpgpuGeometryMode === 'faceted') {
            console.log("Creating faceted (non-indexed) geometry.");
            landGeom = landGeom.toNonIndexed();
            const positions = landGeom.attributes.position.array;
            const vertexCount = landGeom.attributes.position.count;
            const triangleCenters = new Float32Array(vertexCount * 3);

            for (let i = 0; i < vertexCount; i += 3) {
                const vA = new THREE.Vector3().fromArray(positions, i * 3);
                const vB = new THREE.Vector3().fromArray(positions, (i + 1) * 3);
                const vC = new THREE.Vector3().fromArray(positions, (i + 2) * 3);
                const center = new THREE.Vector3().add(vA).add(vB).add(vC).divideScalar(3);
                center.toArray(triangleCenters, i * 3);
                center.toArray(triangleCenters, (i + 1) * 3);
                center.toArray(triangleCenters, (i + 2) * 3);
            }
            landGeom.setAttribute('triangleCenter', new THREE.BufferAttribute(triangleCenters, 3));

        } else {
            console.log("Creating continuous (standard) geometry.");
        }

        const vertexCount = landGeom.attributes.position.count;
        const triangleIds = new Float32Array(vertexCount);
        for(let i = 0; i < vertexCount; i++) {
            triangleIds[i] = Math.floor(i / 3);
        }
        landGeom.setAttribute('triangleId', new THREE.BufferAttribute(triangleIds, 1));


        const uvCount = this.planeResolution.x * this.planeResolution.y;
        const uv_gpgpu = new Float32Array(uvCount * 2);
        for (let i = 0; i < this.planeResolution.y; i++) {
            for (let j = 0; j < this.planeResolution.x; j++) {
                const idx = (i * this.planeResolution.x + j);
                uv_gpgpu[idx * 2] = j / (this.planeResolution.x - 1); 
                uv_gpgpu[idx * 2 + 1] = i / (this.planeResolution.y - 1); 
            }
        }
        landGeom.setAttribute('uv_gpgpu', new THREE.BufferAttribute(uv_gpgpu, 2));
        
        this.createMaterials();
        this.landscape = new THREE.Mesh(landGeom, this.landscapeMaterial);
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
        const tempLandscape = new THREE.Object3D(); 
        if (S.planeOrientation === 'xz') { tempLandscape.rotateX(-Math.PI / 2); } 
        else if (S.planeOrientation === 'yz') { tempLandscape.rotateY(Math.PI / 2); }
        
        this.state.homeQuaternion.copy(tempLandscape.quaternion);
    },
    
    createMaterials() {
        const S = this.app.vizSettings;
        const textureToUse = this.currentTexture || new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat);
        if(!this.currentTexture) textureToUse.needsUpdate = true;

        const positionRenderTarget = this.app.ComputeManager.gpuCompute.getCurrentRenderTarget(this.app.ComputeManager.positionVariable);
        
        this.landscapeMaterial = new THREE.ShaderMaterial({
            uniforms: {
                u_map: { value: textureToUse },
                u_positionTexture: { value: positionRenderTarget.texture }, 
                u_metalness: { value: S.metalness },
                u_roughness: { value: S.roughness },
                u_envMapIntensity: { value: S.reflectionStrength },
                u_time: { value: 0.0 },
                u_audioLow: { value: S.audioLow },
                u_planeResolution: { value: this.planeResolution },
                u_lightColor: { value: new THREE.Color(S.lightColor) },
                u_ambientLightColor: { value: new THREE.Color(S.ambientLightColor) },
                u_lightDirection: { value: new THREE.Vector3().set(S.lightDirectionX, S.lightDirectionY, S.lightDirectionZ).normalize() },
                u_cameraPosition: { value: this.app.camera.position },
                t_envMap: { value: this.app.hdrTexture },
                u_imageEffect_enableBalloon: { value: S.imageEffect_enableBalloon },
                u_imageEffect_point: { value: new THREE.Vector2(S.imageEffect_pointX, S.imageEffect_pointY) },
                u_imageEffect_strength: { value: S.imageEffect_strength },
                u_imageEffect_radius: { value: S.imageEffect_radius },
                u_imageEffect_audioInfluence: { value: S.imageEffect_audioInfluence },
                u_gpgpu_enableTendrils: { value: S.gpgpu_enableTendrils },
                u_gpgpu_tendrilGlowFalloff: { value: S.gpgpu_tendrilGlowFalloff },
                u_gpgpu_enableTriangleWave: { value: S.gpgpu_enableTriangleWave },
                u_gpgpu_triWaveColor1: { value: new THREE.Color(S.gpgpu_triWaveColor1) },
                u_gpgpu_triWaveColor2: { value: new THREE.Color(S.gpgpu_triWaveColor2) },
                u_gpgpu_triWaveAmplitude: { value: S.gpgpu_triWaveAmplitude },
                u_gpgpu_triWaveFrequency: { value: S.gpgpu_triWaveFrequency },
                u_gpgpu_triWaveSpeed: { value: S.gpgpu_triWaveSpeed },
            },
            vertexShader: landscapeRenderVertexShader,
            fragmentShader: landscapeRenderFragmentShader,
            side: THREE.DoubleSide,
            transparent: true,
        });
    },

    loadTexture(file) {
        const objectURL = URL.createObjectURL(file);
        const applyTextureSettings = (texture) => {
            texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
            texture.colorSpace = this.app.vizSettings.enablePBRColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
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
            const texture = new THREE.VideoTexture(videoEl);
            applyTextureSettings(texture);
        } else {
            new THREE.TextureLoader().load(objectURL, (texture) => {
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

        if (S.deformationEngine === 'gpgpu' && !S.gpgpu_enableTriangleWave) {
            const positionTarget = this.app.ComputeManager.gpuCompute.getCurrentRenderTarget(this.app.ComputeManager.positionVariable);
            U.u_positionTexture.value = positionTarget.texture;
        }
        
        U.u_audioLow.value = this.app.AudioProcessor.energy.low;
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

        U.u_gpgpu_enableTendrils.value = S.gpgpu_enableTendrils;
        if (S.gpgpu_enableTendrils) {
            U.u_gpgpu_tendrilGlowFalloff.value = S.gpgpu_tendrilGlowFalloff;
        }

        U.u_gpgpu_enableTriangleWave.value = S.gpgpu_enableTriangleWave;
        if (S.gpgpu_enableTriangleWave) {
            U.u_gpgpu_triWaveColor1.value.set(S.gpgpu_triWaveColor1);
            U.u_gpgpu_triWaveColor2.value.set(S.gpgpu_triWaveColor2);
            U.u_gpgpu_triWaveAmplitude.value = S.gpgpu_triWaveAmplitude;
            U.u_gpgpu_triWaveFrequency.value = S.gpgpu_triWaveFrequency;
            U.u_gpgpu_triWaveSpeed.value = S.gpgpu_triWaveSpeed;
        }
    },

    updateBoundingBox() {
        if (!this.landscapeContainer) return;
        this.landscapeContainer.updateWorldMatrix(true, false);
        this.boundingBox.setFromObject(this.landscapeContainer, true);
    }
};