import * as THREE from 'three'; 
import landscapeRenderVertexShader from '../shaders/landscape_render.vert?raw';
import landscapeRenderFragmentShader from '../shaders/landscape_render.frag?raw';

const PRESET_DEFAULT_SPEEDS = {
    autopilotPreset1: 1.0, 
    autopilotPreset2: 1.0,
    autopilotPreset3: 1.0,
    autopilotPreset4: 1.0,
    autopilotPreset5: 0.7 
};

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
        targetPosition: new THREE.Vector3(),
        targetQuaternion: new THREE.Quaternion(),
        homePosition: new THREE.Vector3(),
        homeQuaternion: new THREE.Quaternion()
    },

    autopilot: {
        active: false,
        preset: null,
        isTransitioningToHome: false, 
        nextPresetId: null, 
        waypointProgress: 1.0, 
        waypointTransitionDuration: 10.0,
        holdTimer: 0,
        randomBounds: null,
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
        const S = this.app.vizSettings;

        ap.active = true;
        ap.preset = presetId;
        ap.isTransitioningToHome = false;

        S.landscapeAutopilotSpeed = PRESET_DEFAULT_SPEEDS[presetId] || 1.0;
        
        if (this.app.UIManager) {
            this.app.UIManager.updateMasterControls();
        }

        ap.waypointProgress = 1.0; 
        ap.holdTimer = 0;
        
        const home = this.state.homePosition;
        switch(presetId) {
            case 'autopilotPreset1':
                ap.randomBounds = new THREE.Box3(new THREE.Vector3(-2, -1.5, -5), new THREE.Vector3(2, 1.5, 0));
                break;
            case 'autopilotPreset2':
                ap.randomBounds = new THREE.Box3(new THREE.Vector3(-35, -25, -50), new THREE.Vector3(35, 25, 10));
                break;
            case 'autopilotPreset3':
                ap.randomBounds = new THREE.Box3(new THREE.Vector3(-45, -30, -70), new THREE.Vector3(45, 30, 5));
                break;
            case 'autopilotPreset4':
                 ap.randomBounds = new THREE.Box3(new THREE.Vector3(-60, -35, -90), new THREE.Vector3(60, 35, 0));
                 break;
            case 'autopilotPreset5': 
                 ap.randomBounds = new THREE.Box3(new THREE.Vector3(-50, -5, -40), new THREE.Vector3(50, 5, -10));
                 break;
        }
        
        console.log(`ImagePlane Autopilot STARTED with preset: ${presetId} at speed ${S.landscapeAutopilotSpeed}`);
        this.generateNewRandomWaypoint();
    },

    initiateReturnToHome(nextPreset = null) {
        const ap = this.autopilot;
        
        ap.isTransitioningToHome = true;
        ap.nextPresetId = nextPreset;
        ap.active = true; 
        ap.preset = null; 

        ap.startPos.copy(this.state.targetPosition);
        ap.endPos.copy(this.state.homePosition);
        ap.startQuat.copy(this.state.targetQuaternion);
        ap.endQuat.copy(this.state.homeQuaternion); 
        ap.waypointProgress = 0;
        
        ap.waypointTransitionDuration = 6.0;
        
        console.log(`Landscape: Initiating return to home. Next preset: ${nextPreset}`);
    },

    stopAutopilot() {
        this.initiateReturnToHome(null);
        console.log("ImagePlane Autopilot STOP triggered. Starting transition to home.");
    },
    
    generateNewRandomWaypoint() {
        const ap = this.autopilot;
        const S = this.app.vizSettings;
        
        ap.startPos.copy(this.state.targetPosition);
        ap.startQuat.copy(this.state.targetQuaternion);

        ap.endPos.set(
            THREE.MathUtils.randFloat(ap.randomBounds.min.x, ap.randomBounds.max.x),
            THREE.MathUtils.randFloat(ap.randomBounds.min.y, ap.randomBounds.max.y),
            THREE.MathUtils.randFloat(ap.randomBounds.min.z, ap.randomBounds.max.z) 
        );

        let randomRot;
        if (ap.preset === 'autopilotPreset1' || ap.preset === 'autopilotPreset5') {
            randomRot = new THREE.Euler(
                (Math.random() - 0.5) * 0.05,
                (Math.random() - 0.5) * 0.05,
                (Math.random() - 0.5) * 0.02
            );
        } else {
            randomRot = new THREE.Euler((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.2);
        }
        ap.endQuat.setFromEuler(randomRot);
        
        const distance = ap.startPos.distanceTo(ap.endPos);
        const speedFactor = S.landscapeAutopilotSpeed;
        ap.waypointTransitionDuration = THREE.MathUtils.clamp(distance / speedFactor, 12, 35);

        ap.waypointProgress = 0;
    },
    
    runMovementLogic(delta) {
        const ap = this.autopilot;

        ap.waypointProgress = Math.min(1.0, ap.waypointProgress + delta / ap.waypointTransitionDuration);
        const ease = 0.5 - 0.5 * Math.cos(ap.waypointProgress * Math.PI);
        
        this.state.targetPosition.lerpVectors(ap.startPos, ap.endPos, ease);
        this.state.targetQuaternion.copy(ap.startQuat).slerp(ap.endQuat, ease);

        if (ap.waypointProgress >= 1.0) {
            if (ap.isTransitioningToHome) {
                ap.isTransitioningToHome = false;
                if (ap.nextPresetId) {
                    this.startAutopilot(ap.nextPresetId);
                } else {
                    ap.active = false;
                    ap.preset = null;
                }
            } else {
                ap.holdTimer = Math.random() * 1.5 + 0.5;
            }
        }
    },

    updateAutopilot(delta) {
        const ap = this.autopilot;
        
        if (ap.isTransitioningToHome) {
            this.runMovementLogic(delta);
            return; 
        }

        if (ap.preset) {
            if (ap.waypointProgress >= 1.0 && ap.holdTimer > 0) {
                ap.holdTimer -= delta;
            } else if (ap.waypointProgress >= 1.0 && ap.holdTimer <= 0) {
                this.generateNewRandomWaypoint();
            }
            
            if (ap.waypointProgress < 1.0) {
                 this.runMovementLogic(delta);
            }
        }
    },

    update(cappedDelta) {
        if (!this.landscapeContainer || !this.landscape) return;
        const S = this.app.vizSettings;
        
        if (!S.enableLandscape) {
            this.landscapeContainer.visible = false;
            return;
        }
        this.landscapeContainer.visible = true;

        if (this.autopilot.active) {
            this.updateAutopilot(cappedDelta);
        } else if (this.state.isUnderManualControl) {
            // Do nothing. The mouse/sliders are controlling the target state directly.
        } else {
            // When not under manual or autopilot control, gently return to home.
            this.state.targetPosition.lerp(this.state.homePosition, 0.02);
            this.state.targetQuaternion.slerp(this.state.homeQuaternion, 0.02);
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

        if (!this.app.ComputeManager.gpuCompute) {
            this.app.ComputeManager.init(this.app, this.planeDimensions.x, this.planeDimensions.y, this.planeResolution.x, this.planeResolution.y);
        }
        
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
        
        // **THE FIX IS HERE**
        // Always update the time uniform for the vertex shader
        U.u_time.value = this.app.currentTime;

        // Only update the GPGPU texture if TriangleWave is NOT active.
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