import THREE from '../../three-singleton.js';
import vertexShader from './particle_render.vert?raw';
import fragmentShader from './particle_render.frag?raw';

export const ParticleSystem = {
    app: null,
    mesh: null,
    material: null,
    fireColorRampTexture: null,
    calculatedBaseSize: 1.0,

    init(appInstance) {
        this.app = appInstance;
        this._createFireColorRamp();
    },

    _createFireColorRamp() {
        const width = 256;
        const data = new Uint8Array(width * 4);
        const color = new THREE.Color();

        for (let i = 0; i < width; i++) {
            const t = i / (width - 1);
            if (t < 0.25) {
                color.setRGB(t / 0.25, 0, 0);
            } else if (t < 0.5) {
                color.setRGB(1.0, (t - 0.25) / 0.25, 0);
            } else {
                color.setRGB(1.0, 1.0, (t - 0.5) / 0.5);
            }
            
            data[i * 4 + 0] = Math.floor(color.r * 255);
            data[i * 4 + 1] = Math.floor(color.g * 255);
            data[i * 4 + 2] = Math.floor(color.b * 255);
            data[i * 4 + 3] = 255;
        }

        this.fireColorRampTexture = new THREE.DataTexture(data, width, 1, THREE.RGBAFormat);
        this.fireColorRampTexture.needsUpdate = true;
    },

    createMesh() {
        this.dispose(); 

        const S = this.app.vizSettings;
        const CM = this.app.ComputeManager;
        const IPM = this.app.ImagePlaneManager;

        const resolution = S.particle_resolution;
        const count = resolution * resolution;
        
        this.calculatedBaseSize = IPM.planeDimensions.x / (resolution - 1) * Math.sqrt(2);

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
        
        const uvs = new Float32Array(count * 2);
        for (let y = 0; y < resolution; y++) {
            for (let x = 0; x < resolution; x++) {
                const i = (y * resolution + x) * 2;
                uvs[i + 0] = x / (resolution - 1);
                uvs[i + 1] = y / (resolution - 1);
            }
        }
        geometry.setAttribute('gpgpu_uv', new THREE.BufferAttribute(uvs, 2));

        this.material = this._createMaterial();
        this.mesh = new THREE.Points(geometry, this.material);
        this.mesh.frustumCulled = false;

        return this.mesh;
    },

    _createMaterial() {
        const S = this.app.vizSettings;
        const CM = this.app.ComputeManager;
        const IPM = this.app.ImagePlaneManager;

        const textureToUse = IPM.currentTexture || new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat);
        if (!IPM.currentTexture) textureToUse.needsUpdate = true;

        return new THREE.ShaderMaterial({
            defines: { 'USE_ENVMAP': '' },
            uniforms: {
                u_map: { value: textureToUse },
                u_positionTexture: { value: null }, 
                u_particleModelUVTexture: { value: CM.particleModelUVTexture },
                u_particleModelTexture: { value: this.app.UIManager?.particleModelTexture || null },
                u_particleColorMix: { value: S.particle_morphProgress },
                particle_base_size: { value: this.calculatedBaseSize * S.particle_base_size },
                particle_min_size: { value: S.particle_min_size },
                u_particle_size_mix: { value: S.particle_size_mix },
                u_metalness: { value: S.metalness },
                u_roughness: { value: S.roughness },
                u_envMapIntensity: { value: S.reflectionStrength },
                u_lightColor: { value: new THREE.Color(S.lightColor) },
                u_ambientLightColor: { value: new THREE.Color(S.ambientLightColor) },
                u_lightDirection: { value: new THREE.Vector3().set(S.lightDirectionX, S.lightDirectionY, S.lightDirectionZ).normalize() },
                u_cameraPosition: { value: new THREE.Vector3() }, // INITIALIZED AS OBJECT
                t_envMap: { value: this.app.hdrTexture },
                u_time: { value: 0.0 },
                u_pixelRatio: { value: window.devicePixelRatio },
                u_particle_twinkleIntensity: { value: S.particle_twinkleIntensity },
                u_fire_progress: { value: S.fire_visual_progress },
                u_fire_colorRamp: { value: this.fireColorRampTexture },
                u_fire_ashColor: { value: new THREE.Color(S.fire_ashColor) },
                u_ash_twinkleIntensity: { value: S.ash_twinkleIntensity },
                u_ash_twinkleSpeed: { value: S.ash_twinkleSpeed },
            },
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            transparent: true,
            depthWrite: false,
            blending: THREE.NormalBlending,
        });
    },

    updateUniforms() {
        if (!this.material) return;
        const S = this.app.vizSettings;
        const CM = this.app.ComputeManager;
        const IPM = this.app.ImagePlaneManager;
        const U = this.material.uniforms;

        if (CM.gpuCompute && CM.positionVariable) {
            const posTarget = CM.gpuCompute.getCurrentRenderTarget(CM.positionVariable);
            U.u_positionTexture.value = posTarget.texture;
        }

        if (IPM.currentTexture) {
            U.u_map.value = IPM.currentTexture;
        }

        const coarseSize = this.calculatedBaseSize * S.particle_base_size;
        U.particle_base_size.value = coarseSize;
        U.particle_min_size.value = S.particle_min_size;
        U.u_particle_size_mix.value = S.particle_size_mix;
        
        U.u_pixelRatio.value = window.devicePixelRatio;
        U.u_particleColorMix.value = S.particle_morphProgress;
        
        if (this.app.UIManager.particleModelTexture) { 
            U.u_particleModelTexture.value = this.app.UIManager.particleModelTexture; 
        }
        
        U.u_metalness.value = S.metalness;
        U.u_roughness.value = S.roughness;
        U.u_envMapIntensity.value = S.reflectionStrength;
        U.t_envMap.value = this.app.hdrTexture; 
        
        // SAFE UPDATE: using .copy() on the initialized Vector3
        U.u_cameraPosition.value.copy(this.app.camera.position);
        
        U.u_lightColor.value.set(S.lightColor);
        U.u_ambientLightColor.value.set(S.ambientLightColor);
        U.u_lightDirection.value.set(S.lightDirectionX, S.lightDirectionY, S.lightDirectionZ).normalize();
        U.u_time.value = this.app.currentTime;
        U.u_particle_twinkleIntensity.value = S.particle_twinkleIntensity;
        
        U.u_fire_progress.value = S.fire_visual_progress;
        U.u_fire_ashColor.value.set(S.fire_ashColor);
        U.u_ash_twinkleIntensity.value = S.ash_twinkleIntensity;
        U.u_ash_twinkleSpeed.value = S.ash_twinkleSpeed;
    },

    dispose() {
        if (this.mesh) {
            this.mesh.geometry.dispose();
            this.mesh = null;
        }
        if (this.material) {
            this.material.dispose();
            this.material = null;
        }
    }
};