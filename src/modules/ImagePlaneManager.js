import * as THREE from 'three'; 
import landscapeRenderVertexShader from '../shaders/landscape_render.vert?raw';
import landscapeRenderFragmentShader from '../shaders/landscape_render.frag?raw';

const PRESET_BASE_SPEEDS = {
    autopilotPreset1: 5.0,
    autopilotPreset2: 0.5,
    autopilotPreset3: 0.75,
    autopilotPreset4: 0.40
};

export const ImagePlaneManager = {
    app: null,
    landscape: null,
    landscapeMaterial: null,
    boundingBox: new THREE.Box3(),
    planeDimensions: new THREE.Vector2(40, 40),
    planeResolution: new THREE.Vector2(128, 128),
    homeQuaternion: new THREE.Quaternion(),
    
    rotation: new THREE.Euler(0, 0, 0),
    currentTexture: null, 

    autopilot: {
        active: false,
        preset: null,
        waypoints: [],
        currentWaypointIndex: 0,
        waypointProgress: 0,
        waypointTransitionDuration: 15.0,
        holdTimer: 0,
        randomBounds: null,
        startPos: new THREE.Vector3(),
        endPos: new THREE.Vector3(),
        startQuat: new THREE.Quaternion(),
        endQuat: new THREE.Quaternion(),
    },

    init(appInstance) {
        this.app = appInstance;
        this.createDefaultLandscape();
    },

    startAutopilot(presetId) {
        if (!this.landscape) return;
        const ap = this.autopilot;

        ap.active = true;
        ap.preset = presetId;
        ap.waypoints = [];
        ap.currentWaypointIndex = 0;
        ap.waypointProgress = 1.0;
        ap.holdTimer = 0;

        const home = { pos: this.app.vizSettings.homePositionLandscape.clone(), rot: new THREE.Quaternion() };

        if (presetId === 'autopilotPreset2') {
            const destinations = [
                { pos: new THREE.Vector3(-5, 2, -3), rot: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1, -0.1, 0)) },
                { pos: new THREE.Vector3(5, -2, 3), rot: new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.1, 0.1, 0)) },
                { pos: new THREE.Vector3(0, 3, 5), rot: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, 0, 0)) },
                { pos: new THREE.Vector3(3, -3, -5), rot: new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.1, 0.1, 0.05)) },
            ];
            // NEW: Use the expanded bounds for Preset 2 as requested.
            ap.randomBounds = new THREE.Box3(home.pos.clone().sub(new THREE.Vector3(25, 20, 5)), home.pos.clone().add(new THREE.Vector3(25, 20, 40)));
            ap.waypoints = destinations.map(dest => ({
                pos: new THREE.Vector3(
                    THREE.MathUtils.randFloat(ap.randomBounds.min.x, ap.randomBounds.max.x),
                    THREE.MathUtils.randFloat(ap.randomBounds.min.y, ap.randomBounds.max.y),
                    THREE.MathUtils.randFloat(ap.randomBounds.min.z, ap.randomBounds.max.z)
                ),
                rot: dest.rot // Keep original rotations for now
            }));
            ap.waypoints.forEach(dest => ap.waypoints.push(home)); // Add return trips
        
        } else if (presetId === 'autopilotPreset3') {
            // Further back, but not as wide as Preset 4
            ap.randomBounds = new THREE.Box3(home.pos.clone().sub(new THREE.Vector3(20, 15, 5)), home.pos.clone().add(new THREE.Vector3(20, 15, 60)));
            this.generateNewRandomWaypoint();

        } else if (presetId === 'autopilotPreset4') {
             // Widest and furthest back range
             ap.randomBounds = new THREE.Box3(home.pos.clone().sub(new THREE.Vector3(30, 25, 10)), home.pos.clone().add(new THREE.Vector3(30, 25, 80)));
             this.generateNewRandomWaypoint();
        }

        console.log(`ImagePlane Autopilot STARTED with preset: ${presetId}`);
    },

    stopAutopilot() {
        this.autopilot.active = false;
        this.autopilot.preset = null;
        console.log("ImagePlane Autopilot STOPPED.");
    },
    
    generateNewRandomWaypoint() {
        const ap = this.autopilot;
        const S = this.app.vizSettings;
        
        ap.startPos.copy(this.app.interactionState.targetPosition);
        ap.startQuat.setFromEuler(this.app.interactionState.targetRotation);

        ap.endPos.set(
            THREE.MathUtils.randFloat(ap.randomBounds.min.x, ap.randomBounds.max.x),
            THREE.MathUtils.randFloat(ap.randomBounds.min.y, ap.randomBounds.max.y),
            // Ensure the Z position is always moving away or staying far away
            -Math.abs(THREE.MathUtils.randFloat(ap.randomBounds.min.z, ap.randomBounds.max.z)) 
        );

        const randomRot = new THREE.Euler(
            (Math.random() - 0.5) * 0.6,
            (Math.random() - 0.5) * 0.6,
            (Math.random() - 0.5) * 0.3
        );
        ap.endQuat.setFromEuler(randomRot);
        
        const distance = ap.startPos.distanceTo(ap.endPos);
        const baseSpeed = PRESET_BASE_SPEEDS[ap.preset] || 1.0;
        const finalSpeed = baseSpeed * S.landscapeAutopilotSpeed;

        ap.waypointTransitionDuration = THREE.MathUtils.clamp(distance / finalSpeed, 10, 15);
        ap.holdTimer = Math.random() * 2.0;
        ap.waypointProgress = 0;
    },
    
    runWaypointLogic(delta) {
        const ap = this.autopilot;
        const S = this.app.vizSettings;
        const IS = this.app.interactionState;

        if (ap.waypoints.length === 0) {
            if (ap.holdTimer > 0) { 
                ap.holdTimer -= delta; 
            } else if (ap.waypointProgress < 1.0) {
                ap.waypointProgress = Math.min(1.0, ap.waypointProgress + delta / ap.waypointTransitionDuration);
                const ease = 0.5 - 0.5 * Math.cos(ap.waypointProgress * Math.PI);
                
                IS.targetPosition.lerpVectors(ap.startPos, ap.endPos, ease);
                const tempQuat = new THREE.Quaternion().copy(ap.startQuat).slerp(ap.endQuat, ease);
                IS.targetRotation.setFromQuaternion(tempQuat, 'XYZ');
            } else { 
                this.generateNewRandomWaypoint(); 
            }
        } else {
             const currentIndex = ap.currentWaypointIndex;
            const nextIndex = (currentIndex + 1) % ap.waypoints.length;
            const startPoint = ap.currentWaypointIndex === 0 ? {pos: IS.targetPosition.clone(), rot: new THREE.Quaternion().setFromEuler(IS.targetRotation)} : ap.waypoints[currentIndex];
            const endPoint = ap.waypoints[nextIndex];
            
            if(ap.waypointProgress === 0) {
                 const distance = startPoint.pos.distanceTo(endPoint.pos);
                 const baseSpeed = PRESET_BASE_SPEEDS[ap.preset] || 1.0;
                 const finalSpeed = baseSpeed * S.landscapeAutopilotSpeed;
                 ap.waypointTransitionDuration = THREE.MathUtils.clamp(distance / finalSpeed, 10, 15);
            }

            ap.waypointProgress = Math.min(1.0, ap.waypointProgress + delta / ap.waypointTransitionDuration);
            const ease = 0.5 - 0.5 * Math.cos(ap.waypointProgress * Math.PI);
            
            IS.targetPosition.lerpVectors(startPoint.pos, endPoint.pos, ease);
            const tempQuat = new THREE.Quaternion().copy(startPoint.rot).slerp(endPoint.rot, ease);
            IS.targetRotation.setFromQuaternion(tempQuat, 'XYZ');

            if (ap.waypointProgress >= 1.0) {
                ap.currentWaypointIndex = nextIndex;
                ap.waypointProgress = 0;
            }
        }
    },

    updateAutopilot(delta) {
        const preset = this.autopilot.preset;

        if (preset === 'autopilotPreset1') {
            const S = this.app.vizSettings;
            const IS = this.app.interactionState;
            const time = this.app.currentTime;
            
            const baseSpeed = PRESET_BASE_SPEEDS[preset] || 1.0;
            const finalSpeed = baseSpeed * S.landscapeAutopilotSpeed;

            const posSpeed = finalSpeed * 0.2;
            const rotSpeed = finalSpeed * 0.15;

            const xPos = Math.sin(time * posSpeed) * 1.5;
            const yPos = Math.cos(time * posSpeed * 1.2) * 1.0;
            const zPos = Math.sin(time * posSpeed * 0.8) * 2.0;
            IS.targetPosition.set(xPos, yPos, zPos);
            const xRot = Math.sin(time * rotSpeed * 1.1) * 0.05;
            const yRot = Math.cos(time * rotSpeed * 0.9) * 0.1;
            const zRot = Math.sin(time * rotSpeed) * 0.03;
            IS.targetRotation.set(xRot, yRot, zRot);
        } else if (preset === 'autopilotPreset2' || preset === 'autopilotPreset3' || preset === 'autopilotPreset4') {
            this.runWaypointLogic(delta);
        }
    },

    update(cappedDelta) {
        if (!this.landscape) return;
        const S = this.app.vizSettings;
        
        if (!S.enableLandscape) {
            this.landscape.visible = false;
            return;
        }
        this.landscape.visible = true;

        if (this.autopilot.active) {
            this.updateAutopilot(cappedDelta);
        } else {
            if (S.enableLandscapeSpin) {
                this.landscape.rotation.z += S.landscapeSpinSpeed * cappedDelta;
            } else {
                this.landscape.quaternion.copy(this.homeQuaternion);
            }
        }

        this.landscape.scale.set(S.landscapeScale, S.landscapeScale, S.landscapeScale);
        if (this.app.ComputeManager) this.app.ComputeManager.update(cappedDelta); 
        this.updateDeformationUniforms();
        this.updateBoundingBox();
    },

    createDefaultLandscape() {
        this.updatePlaneDimensions();
        if (this.landscape) {
            this.landscape.removeFromParent();
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

        this.landscape.frustumCulled = false;

        this.app.worldPivot.add(this.landscape);

        this.applyAndStoreHomeOrientation();
        
        this.landscape.position.set(0, 0, 0); 
        this.landscape.quaternion.copy(this.homeQuaternion);
        this.landscape.scale.set(this.app.defaultVisualizerSettings.landscapeScale, this.app.defaultVisualizerSettings.landscapeScale, this.app.defaultVisualizerSettings.landscapeScale);
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
        const textureToUse = this.currentTexture || new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat);
        if(!this.currentTexture) textureToUse.needsUpdate = true;

        const positionRenderTarget = this.app.ComputeManager.gpuCompute.getCurrentRenderTarget(this.app.ComputeManager.positionVariable);
        const normalRenderTarget = this.app.ComputeManager.gpuCompute.getCurrentRenderTarget(this.app.ComputeManager.normalVariable);
        this.landscapeMaterial = new THREE.ShaderMaterial({
            uniforms: {
                u_map: { value: textureToUse },
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
    }
};