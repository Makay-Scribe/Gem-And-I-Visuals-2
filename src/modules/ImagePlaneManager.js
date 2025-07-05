import * as THREE from 'three'; 
import landscapeRenderVertexShader from '../shaders/landscape_render.vert?raw';
import landscapeRenderFragmentShader from '../shaders/landscape_render.frag?raw';

export const ImagePlaneManager = {
    app: null, // Will be set on init
    raycaster: null,
    
    // --- State ---
    landscape: null,
    landscapeMaterial: null,
    boundingBox: new THREE.Box3(),
    
    // This is now the single source of truth for plane geometry
    planeDimensions: new THREE.Vector2(40, 40),
    planeResolution: new THREE.Vector2(128, 128),

    homePosition: new THREE.Vector3(0, 0, -5),

    transition: {
        active: false,
        start: new THREE.Vector3(),
        end: new THREE.Vector3(),
        progress: 0,
        duration: 2.0
    },

    autopilot: {
        active: false,
        isTransitioningIn: false,
        transitionStartPos: new THREE.Vector3(),
        transitionStartQuat: new THREE.Quaternion(),
        transitionProgress: 0,
        transitionDuration: 10.0,
        
        mode: null,
        waypoints: [],
        currentWaypointIndex: 0,
        waypointTransitionDuration: 15.0,
        waypointProgress: 0,
    },

    init(appInstance) {
        this.app = appInstance;
        this.raycaster = new THREE.Raycaster();
        
        // This will be called again in createDefaultLandscape, but it's good to have it early.
        this.updatePlaneDimensions(); 

        if (this.app.ComputeManager) {
            this.app.ComputeManager.init(this.app, this.planeDimensions.x, this.planeDimensions.y, this.planeResolution.x, this.planeResolution.y);
        } else {
            console.error("ImagePlaneManager: ComputeManager not available. GPGPU plane will not function.");
            if (this.app.UIManager) this.app.UIManager.logError("ComputeManager missing!");
            return; 
        }
        
        this.homePosition.copy(this.app.defaultVisualizerSettings.manualLandscapePosition);
        
        this.createMaterials(); 
        this.createDefaultLandscape();
        
        this.landscape.position.copy(this.homePosition);
    },

    updatePlaneDimensions() {
        const baseSize = 40;
        const aspectRatio = parseFloat(this.app.vizSettings.planeAspectRatio) || 1.0;
        this.planeDimensions.set(baseSize * aspectRatio, baseSize);
    },

    startAutopilot(presetId) {
        if (!this.landscape) return;
        const ap = this.autopilot;
        
        ap.isTransitioningIn = true;
        ap.transitionProgress = 0;
        ap.transitionStartPos.copy(this.landscape.position);
        ap.transitionStartQuat.copy(this.landscape.quaternion);
        ap.active = false;
        ap.mode = presetId;
        
        if (presetId === 'autopilotPreset2') {
            const home = { pos: this.homePosition.clone(), rot: new THREE.Quaternion() };
            ap.waypoints = [
                { pos: new THREE.Vector3(-15, 8, -10), rot: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -0.2, 0)) },
                home, { pos: new THREE.Vector3(15, -8, 10), rot: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.2, 0)) },
                home, { pos: new THREE.Vector3(0, 15, 5), rot: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1, 0, 0)) },
                home,
            ];
            ap.currentWaypointIndex = 0;
            ap.waypointProgress = 0;
        } else {
            ap.waypoints = [];
        }
        console.log(`Landscape autopilot started with preset: ${presetId}`);
    },

    stopAutopilot() {
        this.autopilot.active = false;
        this.autopilot.isTransitioningIn = false;
        this.autopilot.mode = null;
        console.log("Landscape autopilot stopped.");
    },

    returnToHome() {
        if (!this.landscape) {
            this.transition.active = false;
            return;
        }
        this.stopAutopilot();
        this.transition.active = true;
        this.transition.progress = 0;
        this.transition.start.copy(this.landscape.position);
        this.transition.end.copy(this.homePosition);
    },

    updateBoundingBox() {
        if (!this.landscape) return;
        this.landscape.geometry.computeBoundingBox();
        this.boundingBox.copy(this.landscape.geometry.boundingBox).applyMatrix4(this.landscape.matrixWorld);
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
    
    createDefaultLandscape() {
        // ** THE FIX IS HERE **
        // 1. Update dimensions based on the latest aspect ratio setting.
        this.updatePlaneDimensions();

        // 2. Re-initialize the ComputeManager with the new dimensions.
        if (this.app.ComputeManager) {
            this.app.ComputeManager.init(this.app, this.planeDimensions.x, this.planeDimensions.y, this.planeResolution.x, this.planeResolution.y);
        }

        if (this.landscape) {
            this.app.scene.remove(this.landscape);
            if (this.landscape.geometry) this.landscape.geometry.dispose();
        }
        
        // 3. Create the new geometry with the correct dimensions.
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
        this.applyOrientation();
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
    
    applyOrientation() {
        if (!this.landscape) return;
        const S = this.app.vizSettings;
        this.landscape.rotation.set(0, 0, 0);

        if (S.planeOrientation === 'xz') { // Floor
            this.landscape.rotateX(-Math.PI / 2);
        } else if (S.planeOrientation === 'yz') { // Side Wall
            this.landscape.rotateY(Math.PI / 2);
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

    update(cappedDelta) {
        if (!this.landscape) return;
        const S = this.app.vizSettings;
        const ap = this.autopilot;

        this.applyOrientation();
        this.landscape.visible = S.enableLandscape;

        if (!this.landscape.visible) {
            if(ap.active) this.stopAutopilot();
            return;
        }

        this.landscape.scale.set(S.landscapeScale, S.landscapeScale, S.landscapeScale);
        const speed = S.landscapeAutopilotSpeed;
        
        if (ap.isTransitioningIn) {
            ap.transitionProgress = Math.min(1.0, ap.transitionProgress + (cappedDelta * speed) / ap.transitionDuration);
            const ease = 0.5 - 0.5 * Math.cos(ap.transitionProgress * Math.PI);
            this.landscape.position.lerpVectors(ap.transitionStartPos, this.homePosition, ease);
            this.landscape.quaternion.slerpQuaternions(ap.transitionStartQuat, new THREE.Quaternion(), ease);
            if (ap.transitionProgress >= 1.0) {
                ap.isTransitioningIn = false;
                ap.active = true;
            }
        } else if (S.landscapeAutopilotOn && ap.active) {
            if (ap.waypoints.length > 0) {
                const currentIndex = ap.currentWaypointIndex;
                const nextIndex = (currentIndex + 1) % ap.waypoints.length;
                const startPoint = ap.waypoints[currentIndex];
                const endPoint = ap.waypoints[nextIndex];

                ap.waypointProgress = Math.min(1.0, ap.waypointProgress + (cappedDelta * speed) / ap.waypointTransitionDuration);
                const ease = 0.5 - 0.5 * Math.cos(ap.waypointProgress * Math.PI);

                this.landscape.position.lerpVectors(startPoint.pos, endPoint.pos, ease);
                this.landscape.quaternion.slerpQuaternions(startPoint.rot, endPoint.rot, ease);

                if (ap.waypointProgress >= 1.0) {
                    ap.currentWaypointIndex = nextIndex;
                    ap.waypointProgress = 0;
                }
            }
        } else {
             if (S.activeControl === 'landscape') {
                if (this.transition.active) {
                    this.transition.progress = Math.min(1.0, this.transition.progress + cappedDelta / this.transition.duration);
                    const ease = 0.5 - 0.5 * Math.cos(this.transition.progress * Math.PI);
                    this.landscape.position.lerpVectors(this.transition.start, this.transition.end, ease);
                    if (this.transition.progress >= 1.0) {
                        this.transition.active = false;
                    }
                } else {
                    this.landscape.position.copy(S.manualLandscapePosition);
                }
             }
        }
        
        if (S.enableLandscapeSpin && !S.landscapeAutopilotOn) {
            this.landscape.rotation.z -= S.landscapeSpinSpeed * cappedDelta;
        }

        if (this.app.ComputeManager) {
            this.app.ComputeManager.update(cappedDelta); 
        }
        
        this.updateDeformationUniforms();
        this.updateBoundingBox();
    }
};