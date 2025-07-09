import * as THREE from 'three'; 
import landscapeRenderVertexShader from '../shaders/landscape_render.vert?raw';
import landscapeRenderFragmentShader from '../shaders/landscape_render.frag?raw';

const PRESET_BASE_SPEEDS = {
    autopilotPreset1: 3.75, 
    autopilotPreset2: 1.8,
    autopilotPreset3: 1.5,
    autopilotPreset4: 1.2
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
        this.createDefaultLandscape();
    },

    startAutopilot(presetId) {
        if (!this.landscape) return;
        const ap = this.autopilot;
        const S = this.app.vizSettings;

        const isAtHome = this.app.interactionState.targetPosition.distanceTo(S.homePositionLandscape) < 0.1;

        // ** THE FIX IS HERE (Part 1) **: Universal Transition Logic
        // If we are not already at the home position, we MUST transition home first.
        if (!isAtHome && !ap.isTransitioningToHome) {
            console.log(`Not at home. Transitioning before starting preset: ${presetId}`);
            this.initiateReturnToHome(presetId); // Pass the next preset to start after.
            return;
        }

        ap.active = true;
        ap.preset = presetId;
        ap.isTransitioningToHome = false;
        ap.waypointProgress = 1.0; 
        ap.holdTimer = 0;

        if (presetId === 'autopilotPreset2') {
            ap.randomBounds = new THREE.Box3(new THREE.Vector3(-35, -25, -50), new THREE.Vector3(35, 25, 10));
        } else if (presetId === 'autopilotPreset3') {
            ap.randomBounds = new THREE.Box3(new THREE.Vector3(-45, -30, -70), new THREE.Vector3(45, 30, 5));
        } else if (presetId === 'autopilotPreset4') {
             ap.randomBounds = new THREE.Box3(new THREE.Vector3(-60, -35, -90), new THREE.Vector3(60, 35, 0));
        }

        console.log(`ImagePlane Autopilot STARTED with preset: ${presetId}`);
    },

    // ** THE FIX IS HERE (Part 2) **: New function for graceful shutdown and transitions.
    initiateReturnToHome(nextPreset = null) {
        const ap = this.autopilot;
        const S = this.app.vizSettings;
        
        ap.isTransitioningToHome = true;
        ap.nextPresetId = nextPreset; // Will be null if we are just turning autopilot off.
        ap.active = true; // Keep the autopilot system running to handle the transition.
        ap.preset = null; // We are in a special "transition" state, not a numbered preset.

        ap.startPos.copy(this.app.interactionState.targetPosition);
        ap.endPos.copy(S.homePositionLandscape);
        ap.startQuat.setFromEuler(this.app.interactionState.targetRotation);
        ap.endQuat.identity(); 
        ap.waypointProgress = 0;
        ap.waypointTransitionDuration = 10.0;
        
        console.log(`Initiating 10-second return to home. Next preset: ${nextPreset}`);
    },

    stopAutopilot() {
        const ap = this.autopilot;
        ap.active = false;
        ap.preset = null;
        ap.isTransitioningToHome = false;
        ap.nextPresetId = null;
        console.log("ImagePlane Autopilot System STOPPED.");
    },
    
    generateNewRandomWaypoint() {
        const ap = this.autopilot;
        const S = this.app.vizSettings;
        
        ap.startPos.copy(this.app.interactionState.targetPosition);
        ap.startQuat.setFromEuler(this.app.interactionState.targetRotation);

        ap.endPos.set(
            THREE.MathUtils.randFloat(ap.randomBounds.min.x, ap.randomBounds.max.x),
            THREE.MathUtils.randFloat(ap.randomBounds.min.y, ap.randomBounds.max.y),
            THREE.MathUtils.randFloat(ap.randomBounds.min.z, ap.randomBounds.max.z) 
        );

        const randomRot = new THREE.Euler((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.2);
        ap.endQuat.setFromEuler(randomRot);
        
        const distance = ap.startPos.distanceTo(ap.endPos);
        const speedFactor = (PRESET_BASE_SPEEDS[ap.preset] || 1.0) * S.landscapeAutopilotSpeed;
        ap.waypointTransitionDuration = THREE.MathUtils.clamp(distance / speedFactor, 12, 35);

        ap.waypointProgress = 0;
    },
    
    runMovementLogic(delta) {
        const ap = this.autopilot;
        const IS = this.app.interactionState;

        ap.waypointProgress = Math.min(1.0, ap.waypointProgress + delta / ap.waypointTransitionDuration);
        const ease = 0.5 - 0.5 * Math.cos(ap.waypointProgress * Math.PI);
        
        IS.targetPosition.lerpVectors(ap.startPos, ap.endPos, ease);
        const tempQuat = new THREE.Quaternion().copy(ap.startQuat).slerp(ap.endQuat, ease);
        IS.targetRotation.setFromQuaternion(tempQuat, 'XYZ');

        if (ap.waypointProgress >= 1.0) {
            // ** THE FIX IS HERE (Part 3) **: Smarter completion logic.
            if (ap.isTransitioningToHome) {
                ap.isTransitioningToHome = false;
                if (ap.nextPresetId) {
                    // If we have a preset queued up, start it.
                    this.startAutopilot(ap.nextPresetId);
                } else {
                    // If not, we were just turning off, so stop everything.
                    this.stopAutopilot();
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

        if (ap.preset === 'autopilotPreset1') {
            const S = this.app.vizSettings;
            const IS = this.app.interactionState;
            const time = this.app.currentTime;
            const baseSpeed = PRESET_BASE_SPEEDS[ap.preset] || 1.0;
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

        } else if (ap.preset) { // Check if a preset is active
            if (ap.waypointProgress >= 1.0 && ap.holdTimer > 0) {
                ap.holdTimer -= delta;
            } else if (ap.waypointProgress >= 1.0 && ap.holdTimer <= 0) {
                this.generateNewRandomWaypoint();
            }
            // This ensures movement continues after a new waypoint is generated
            if(ap.waypointProgress < 1.0) {
                 this.runMovementLogic(delta);
            }
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