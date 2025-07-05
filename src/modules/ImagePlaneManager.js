import * as THREE from 'three'; 
import landscapeRenderVertexShader from '../shaders/landscape_render.vert?raw';
import landscapeRenderFragmentShader from '../shaders/landscape_render.frag?raw';

export const ImagePlaneManager = {
    app: null, // Will be set on init
    raycaster: null,
    
    // --- State ---
    landscape: null,
    landscapeMaterial: null,
    
    planeDimensions: new THREE.Vector2(40, 40), // Actual size of the plane
    planeResolution: new THREE.Vector2(128, 128), // Number of vertices in the plane

    init(appInstance) {
        this.app = appInstance;
        
        this.raycaster = new THREE.Raycaster();
        
        // Initialize ComputeManager first, as ImagePlaneManager will depend on it
        if (this.app.ComputeManager) {
            this.app.ComputeManager.init(this.app, this.planeDimensions.x, this.planeDimensions.y, this.planeResolution.x, this.planeResolution.y);
        } else {
            console.error("ImagePlaneManager: ComputeManager not available. GPGPU plane will not function.");
            if (this.app.UIManager) this.app.UIManager.logError("ComputeManager missing!");
            return; 
        }
        
        this.createMaterials(); 
        this.createDefaultLandscape(); 
    },

    // --- Object & Material Creation ---
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
                // Use the app-level hdrTexture which is now guaranteed to exist
                t_envMap: { value: this.app.hdrTexture }, 
            },
            vertexShader: landscapeRenderVertexShader,
            fragmentShader: landscapeRenderFragmentShader,
            side: THREE.DoubleSide,
            transparent: true,
        });
    },
    
    createDefaultLandscape() {
        if (this.landscape) {
            this.app.scene.remove(this.landscape);
            if (this.landscape.geometry) this.landscape.geometry.dispose();
        }
        
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
        this.landscape.position.z = -5; // Move it slightly back from the center
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
        const orientation = this.app.vizSettings.planeOrientation;
        this.landscape.rotation.set(0, 0, 0);
        if (orientation === 'xz') { this.landscape.rotation.x = -Math.PI / 2; } 
        else if (orientation === 'yz') { this.landscape.rotation.y = Math.PI / 2; }
    },

    updateDeformationUniforms() {
        if (!this.landscapeMaterial || !this.app.ComputeManager || !this.app.ComputeManager.gpuCompute ||
            !this.app.ComputeManager.positionVariable || !this.app.ComputeManager.normalVariable) {
            return;
        }

        const positionTarget = this.app.ComputeManager.gpuCompute.getCurrentRenderTarget(this.app.ComputeManager.positionVariable);
        const normalTarget = this.app.ComputeManager.gpuCompute.getCurrentRenderTarget(this.app.ComputeManager.normalVariable);

        if (!positionTarget || !normalTarget) {
            return; 
        }

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
        // This now correctly updates every frame with the latest HDRI
        U.t_envMap.value = this.app.hdrTexture; 
        U.u_cameraPosition.value = this.app.camera.position;

        U.u_lightColor.value.set(S.lightColor);
        U.u_ambientLightColor.value.set(S.ambientLightColor);
        U.u_lightDirection.value.set(S.lightDirectionX, S.lightDirectionY, S.lightDirectionZ).normalize();
    },

    update(cappedDelta) {
        if (!this.landscape) return;
        const S = this.app.vizSettings;
        const A = this.app.AudioProcessor;

        this.landscape.visible = S.enableLandscape;
        if (!this.landscape.visible) return;

        this.landscape.scale.set(parseFloat(S.planeAspectRatio), 1, 1);
        
        if (S.enableLandscapeSpin) {
            const orientation = S.planeOrientation;
            if (orientation === 'xy') { this.landscape.rotation.z -= S.landscapeSpinSpeed * cappedDelta; } 
            else if (orientation === 'xz') { this.landscape.rotation.y -= S.landscapeSpinSpeed * cappedDelta; } 
            else if (orientation === 'yz') { this.landscape.rotation.x -= S.landscapeSpinSpeed * cappedDelta; }
        }

        if (this.landscapeMaterial.uniforms.u_map.value) {
            let targetOffset = 0;
            if (S.enableJolt) {
                const restingOffset = S.joltTargetX;
                targetOffset = restingOffset;
                let beatTrigger = false;
                if (S.joltBeatDivision === '1' && A.triggers.beat) beatTrigger = true;
                if (S.joltBeatDivision === '2' && A.triggers.beat2) beatTrigger = true;
                if (S.joltBeatDivision === '4' && A.triggers.beat4) beatTrigger = true;
                if (beatTrigger && restingOffset !== 0) {
                    targetOffset = restingOffset + (S.joltStrength * Math.sign(restingOffset));
                }
            }
            const returnSpeed = S.joltReturnSpeed;
            const decayFactor = 1.0 - Math.exp(-returnSpeed * cappedDelta);
            this.app.jolt_currentOffset = THREE.MathUtils.lerp(this.app.jolt_currentOffset, targetOffset, decayFactor);
            if (this.landscapeMaterial.uniforms.u_map.value.offset) {
                this.landscapeMaterial.uniforms.u_map.value.offset.x = this.app.jolt_currentOffset;
            }
        }

        if (this.app.ComputeManager) {
            this.app.ComputeManager.update(cappedDelta); 
        } else {
            console.warn("ImagePlaneManager: ComputeManager not available, skipping GPGPU update.");
        }
        
        this.updateDeformationUniforms();
    }
};