import * as THREE from 'three'; 
import landscapeRenderVertexShader from '../shaders/landscape_render.vert?raw';
import landscapeRenderFragmentShader from '../shaders/landscape_render.frag?raw';

export const ImagePlaneManager = {
    app: null,
    landscape: null,
    landscapeMaterial: null,
    boundingBox: new THREE.Box3(),
    planeDimensions: new THREE.Vector2(40, 40),
    planeResolution: new THREE.Vector2(128, 128),
    homePosition: new THREE.Vector3(0, 0, -5),
    homeQuaternion: new THREE.Quaternion(),

    // --- UNIFIED STATE MACHINE ---
    state: {
        mode: 'manual', 
        progress: 0,
        startPos: new THREE.Vector3(),
        endPos: new THREE.Vector3(),
        startQuat: new THREE.Quaternion(),
        endQuat: new THREE.Quaternion(),
        duration: 2.0,
        nextMode: 'manual', 
    },

    autopilot: {
        preset: null,
        waypoints: [],
        currentWaypointIndex: 0,
        waypointProgress: 0,
        waypointTransitionDuration: 15.0,
        holdTimer: 0,
        randomBounds: null,
    },

    init(appInstance) {
        this.app = appInstance;
        this.homePosition.copy(this.app.defaultVisualizerSettings.manualLandscapePosition);
        this.createDefaultLandscape();
    },

    startAutopilot(presetId) {
        if (!this.landscape) return;
        
        this.autopilot.preset = presetId;
        this.autopilot.waypoints = [];
        this.autopilot.currentWaypointIndex = 0;
        this.autopilot.waypointProgress = 0;

        const home = { pos: this.homePosition.clone(), rot: this.homeQuaternion.clone() };

        if (presetId === 'autopilotPreset2') {
            const destinations = [
                { pos: new THREE.Vector3(-15, 8, -10), rot: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1, -0.2, 0)) },
                { pos: new THREE.Vector3(15, -8, 10), rot: new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.1, 0.2, 0)) },
                { pos: new THREE.Vector3(0, 15, 5), rot: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, 0, 0)) },
                { pos: new THREE.Vector3(10, -10, -15), rot: new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.1, 0.15, 0.05)) },
                { pos: new THREE.Vector3(-10, 0, 15), rot: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -0.1, -0.05)) },
            ];
            destinations.forEach(dest => { this.autopilot.waypoints.push(dest); this.autopilot.waypoints.push(home); });
        } else if (presetId === 'autopilotPreset3') {
            this.autopilot.randomBounds = new THREE.Box3(this.homePosition.clone().sub(new THREE.Vector3(10, 10, 5)), this.homePosition.clone().add(new THREE.Vector3(10, 10, 15)));
        } else if (presetId === 'autopilotPreset4') {
             this.autopilot.randomBounds = new THREE.Box3(this.homePosition.clone().sub(new THREE.Vector3(25, 20, 10)), this.homePosition.clone().add(new THREE.Vector3(25, 20, 25)));
        }

        this.transitionToState('autopilot');
    },

    stopAutopilot() {
        if (this.state.mode !== 'autopilot' && this.state.mode !== 'transitioning') return;
        this.autopilot.preset = null;
        this.transitionToState('manual');
    },

    transitionToState(newState) {
        this.state.progress = 0;
        this.state.startPos.copy(this.landscape.position);
        this.state.startQuat.copy(this.landscape.quaternion);

        if (newState === 'autopilot') {
            this.state.endPos.copy(this.homePosition);
            this.state.endQuat.copy(this.homeQuaternion);
        } else { // transitioning to manual
            this.state.endPos.copy(this.app.vizSettings.manualLandscapePosition);
            this.state.endQuat.copy(this.homeQuaternion);
        }

        const distance = this.state.startPos.distanceTo(this.state.endPos);
        this.state.duration = THREE.MathUtils.clamp(distance * 0.2, 1.5, 8.0);
        this.state.mode = 'transitioning';
        this.state.nextMode = newState;
    },

    generateNewRandomWaypoint() {
        const ap = this.autopilot;
        this.state.startPos.copy(this.landscape.position);
        this.state.startQuat.copy(this.landscape.quaternion);

        this.state.endPos.set(
            THREE.MathUtils.randFloat(ap.randomBounds.min.x, ap.randomBounds.max.x),
            THREE.MathUtils.randFloat(ap.randomBounds.min.y, ap.randomBounds.max.y),
            THREE.MathUtils.randFloat(ap.randomBounds.min.z, ap.randomBounds.max.z)
        );

        const targetLookAt = this.app.camera.position;
        const tempMatrix = new THREE.Matrix4().lookAt(this.landscape.position, targetLookAt, this.landscape.up);
        const randomRoll = (Math.random() - 0.5) * 0.4;
        const randomPitch = (Math.random() - 0.5) * 0.4;
        const rotOffset = new THREE.Quaternion().setFromEuler(new THREE.Euler(randomPitch, 0, randomRoll));
        this.state.endQuat.setFromRotationMatrix(tempMatrix).multiply(rotOffset);
        
        const distance = this.state.startPos.distanceTo(this.state.endPos);
        ap.waypointTransitionDuration = THREE.MathUtils.clamp(distance * 0.5, 15, 25);
        ap.holdTimer = Math.random() * 1.0;
        ap.waypointProgress = 0;
    },
    
    update(cappedDelta) {
        if (!this.landscape) return;
        const S = this.app.vizSettings;
        
        if (!S.enableLandscape) {
            this.landscape.visible = false;
            return;
        }
        this.landscape.visible = true;

        if (this.state.mode === 'transitioning') {
            this.state.progress = Math.min(1.0, this.state.progress + cappedDelta / this.state.duration);
            const ease = 0.5 - 0.5 * Math.cos(this.state.progress * Math.PI);
            this.landscape.position.lerpVectors(this.state.startPos, this.state.endPos, ease);
            this.landscape.quaternion.slerpQuaternions(this.state.startQuat, this.state.endQuat, ease);
            if (this.state.progress >= 1.0) {
                this.state.mode = this.state.nextMode;
                if(this.state.mode === 'autopilot' && (this.autopilot.preset === 'autopilotPreset3' || this.autopilot.preset === 'autopilotPreset4')) {
                    this.generateNewRandomWaypoint();
                }
            }
        } else if (this.state.mode === 'autopilot') {
            const ap = this.autopilot;
            if (ap.preset === 'autopilotPreset1') {
                const time = this.app.currentTime * 0.07;
                const posOffset = new THREE.Vector3(Math.sin(time) * 2, Math.cos(time * 1.5) * 1.5, Math.sin(time * 0.5) * 1);
                this.landscape.position.copy(this.homePosition).add(posOffset);

                const baseQuat = this.homeQuaternion.clone();
                const rotOffset = new THREE.Euler(Math.sin(time * 2) * 0.05, Math.cos(time) * 0.1, Math.sin(time * 1.2) * 0.03);
                this.landscape.quaternion.copy(baseQuat).multiply(new THREE.Quaternion().setFromEuler(rotOffset));
            } else if (ap.preset === 'autopilotPreset2') {
                this.runWaypointLogic(cappedDelta);
            } else if (ap.preset === 'autopilotPreset3' || ap.preset === 'autopilotPreset4') {
                if (ap.holdTimer > 0) {
                    ap.holdTimer -= cappedDelta;
                } else if (ap.waypointProgress < 1.0) {
                    ap.waypointProgress = Math.min(1.0, ap.waypointProgress + (S.landscapeAutopilotSpeed * cappedDelta) / ap.waypointTransitionDuration);
                    const ease = 0.5 - 0.5 * Math.cos(ap.waypointProgress * Math.PI);
                    this.landscape.position.lerpVectors(this.state.startPos, this.state.endPos, ease);
                    this.landscape.quaternion.slerpQuaternions(this.state.startQuat, this.state.endQuat, ease);
                } else {
                    this.generateNewRandomWaypoint();
                }
            }
        } else { // Manual state
            if (!this.app.dragState.isDragging || S.activeControl !== 'landscape') {
                this.landscape.position.copy(S.manualLandscapePosition);
            }
        }

        this.landscape.scale.set(S.landscapeScale, S.landscapeScale, S.landscapeScale);
        if (this.app.ComputeManager) this.app.ComputeManager.update(cappedDelta); 
        this.updateDeformationUniforms();
        this.updateBoundingBox();
    },

    runWaypointLogic(cappedDelta) {
        const ap = this.autopilot;
        const S = this.app.vizSettings;
        if (ap.waypoints.length === 0) return;
        
        const currentIndex = ap.currentWaypointIndex;
        const nextIndex = (currentIndex + 1) % ap.waypoints.length;
        const startPoint = ap.waypoints[currentIndex];
        const endPoint = ap.waypoints[nextIndex];
        const distance = startPoint.pos.distanceTo(endPoint.pos);
        ap.waypointTransitionDuration = THREE.MathUtils.clamp(distance * 0.4, 15, 25);
        
        ap.waypointProgress = Math.min(1.0, ap.waypointProgress + (S.landscapeAutopilotSpeed * cappedDelta) / ap.waypointTransitionDuration);
        const ease = 0.5 - 0.5 * Math.cos(ap.waypointProgress * Math.PI);
        this.landscape.position.lerpVectors(startPoint.pos, endPoint.pos, ease);
        this.landscape.quaternion.slerpQuaternions(startPoint.rot, endPoint.rot, ease);

        if (ap.waypointProgress >= 1.0) {
            ap.currentWaypointIndex = nextIndex;
            ap.waypointProgress = 0;
        }
    },
    
    createDefaultLandscape() {
        this.updatePlaneDimensions();
        if (this.landscape) {
            this.app.scene.remove(this.landscape);
            if (this.landscape.geometry) this.landscape.geometry.dispose();
            if (this.landscapeMaterial) this.landscapeMaterial.dispose();
        }
        if (this.app.ComputeManager) {
            this.app.ComputeManager.init(this.app, this.planeDimensions.x, this.planeDimensions.y, this.planeResolution.x, this.planeResolution.y);
        } else { return; }
        this.createMaterials();
        const landGeom = new THREE.PlaneGeometry(this.planeDimensions.x, this.planeDimensions.y, this.planeResolution.x - 1, this.planeResolution.y - 1);
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
        this.landscape = new THREE.Mesh(landGeom, this.landscapeMaterial);
        this.app.scene.add(this.landscape);
        this.applyAndStoreHomeOrientation();
        this.landscape.position.copy(this.homePosition);
        this.landscape.quaternion.copy(this.homeQuaternion);
    },

    updatePlaneDimensions() {
        const baseSize = 40;
        const aspectRatio = parseFloat(this.app.vizSettings.planeAspectRatio) || 1.0;
        this.planeDimensions.set(baseSize * aspectRatio, baseSize);
    },

    applyAndStoreHomeOrientation() {
        if (!this.landscape) return;
        const S = this.app.vizSettings;
        this.landscape.rotation.set(0, 0, 0);
        if (S.planeOrientation === 'xz') { this.landscape.rotateX(-Math.PI / 2); } 
        else if (S.planeOrientation === 'yz') { this.landscape.rotateY(Math.PI / 2); }
        this.homeQuaternion.copy(this.landscape.quaternion);
    },
    
    createMaterials() {
        const S = this.app.vizSettings;
        const placeholderMapTexture = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat);
        placeholderMapTexture.needsUpdate = true;
        const positionRenderTarget = this.app.ComputeManager.gpuCompute.getCurrentRenderTarget(this.app.ComputeManager.positionVariable);
        const normalRenderTarget = this.app.ComputeManager.gpuCompute.getCurrentRenderTarget(this.app.ComputeManager.normalVariable);
        this.landscapeMaterial = new THREE.ShaderMaterial({
            uniforms: {
                u_map: { value: placeholderMapTexture }, 
                u_positionTexture: { value: positionRenderTarget.texture }, 
                u_normalTexture: { value: normalRenderTarget.texture },   
                u_metalness: { value: S.metalness },
                u_roughness: { value: S.roughness },
                u_envMapIntensity: { value: S.reflectionStrength },
                u_time: { value: 0.0 },
                u_beat: { value: 0.0 },
                u_audioLow: { value: 0.0 },
                u_audioMid: { value: 0.0 },
                u_planeResolution: { value: this.planeResolution },
                u_lightColor: { value: new THREE.Color(S.lightColor) },
                u_ambientLightColor: { value: new THREE.Color(S.ambientLightColor) },
                u_lightDirection: { value: new THREE.Vector3().set(S.lightDirectionX, S.lightDirectionY, S.lightDirectionZ).normalize() },
                u_cameraPosition: { value: this.app.camera.position },
                t_envMap: { value: this.app.hdrTexture }, 
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
        const positionTarget = this.app.ComputeManager.gpuCompute.getCurrentRenderTarget(this.app.ComputeManager.positionVariable);
        const normalTarget = this.app.ComputeManager.gpuCompute.getCurrentRenderTarget(this.app.ComputeManager.normalVariable);
        if (!positionTarget || !normalTarget) return; 
        const S = this.app.vizSettings;
        const U = this.landscapeMaterial.uniforms;
        U.u_time.value = this.app.currentTime;
        U.u_beat.value = this.app.AudioProcessor.triggers.beat ? 1.0 : 0.0;
        U.u_audioLow.value = this.app.AudioProcessor.energy.low;
        U.u_audioMid.value = this.app.AudioProcessor.energy.mid;
        U.u_positionTexture.value = positionTarget.texture;
        U.u_normalTexture.value = normalTarget.texture;
        U.u_metalness.value = S.metalness;
        U.u_roughness.value = S.roughness;
        U.u_envMapIntensity.value = S.reflectionStrength;
        U.t_envMap.value = this.app.hdrTexture; 
        U.u_cameraPosition.value = this.app.camera.position;
        U.u_lightColor.value.set(S.lightColor);
        U.u_ambientLightColor.value.set(S.ambientLightColor);
        U.u_lightDirection.value.set(S.lightDirectionX, S.lightDirectionY, S.lightDirectionZ).normalize();
    },

    updateBoundingBox() {
        if (!this.landscape) return;
        this.landscape.geometry.computeBoundingBox();
        this.boundingBox.copy(this.landscape.geometry.boundingBox).applyMatrix4(this.landscape.matrixWorld);
    },
    
    // ** THE FIX IS HERE **
    // The missing returnToHome function from your original bug report,
    // which was not correctly defined as a method of the object.
    // It's not used by the new state machine, but it's good practice to have.
    returnToHome() {
        if (this.state.mode === 'manual') return;
        this.stopAutopilot();
    }
};