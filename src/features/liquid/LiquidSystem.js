import THREE from '../../three-singleton.js';
import vertexShader from './liquid.vert?raw';
import fragmentShader from './liquid.frag?raw';

export const LiquidSystem = {
    app: null,
    mesh: null,
    material: null,

    init(appInstance) {
        this.app = appInstance;
    },

    createMesh() {
        this.dispose(); // Clean up existing if rebuilding

        const S = this.app.vizSettings;
        const IPM = this.app.ImagePlaneManager;

        // We need the geometry segments to match the GPGPU resolution 
        // so vertices map 1:1 to physics data points.
        const resolution = S.particle_resolution; // e.g., 512
        const widthSegs = resolution - 1;
        const heightSegs = resolution - 1;

        const geometry = new THREE.PlaneGeometry(
            IPM.planeDimensions.x,
            IPM.planeDimensions.y,
            widthSegs,
            heightSegs
        );

        // Prepare Texture (Fallback if none loaded)
        const textureToUse = IPM.currentTexture || new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat);
        if (!IPM.currentTexture) textureToUse.needsUpdate = true;

        this.material = new THREE.ShaderMaterial({
            defines: { 'USE_ENVMAP': '' },
            uniforms: {
                u_positionTexture: { value: null }, // GPGPU Position
                u_texelSize: { value: new THREE.Vector2(1.0 / resolution, 1.0 / resolution) },
                
                // Texture Map
                u_map: { value: textureToUse },
                
                // PBR / Visuals
                u_color: { value: new THREE.Color(0x007AFF) }, // Base Liquid Color
                u_metalness: { value: S.metalness },
                u_roughness: { value: S.roughness },
                u_envMapIntensity: { value: S.reflectionStrength },
                t_envMap: { value: this.app.hdrTexture },
                
                // Lighting
                u_lightColor: { value: new THREE.Color(S.lightColor) },
                u_ambientLightColor: { value: new THREE.Color(S.ambientLightColor) },
                u_lightDirection: { value: new THREE.Vector3() },
                u_cameraPosition: { value: new THREE.Vector3() }
            },
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            side: THREE.DoubleSide, 
            wireframe: false
        });

        this.mesh = new THREE.Mesh(geometry, this.material);
        this.mesh.frustumCulled = false; // Displacement moves vertices outside bounding box

        return this.mesh;
    },

    updateUniforms() {
        if (!this.material) return;
        const S = this.app.vizSettings;
        const CM = this.app.ComputeManager;
        const IPM = this.app.ImagePlaneManager;
        const U = this.material.uniforms;

        // Link Physics (Safety Checked)
        if (CM.gpuCompute && CM.positionVariable) {
            const posTarget = CM.gpuCompute.getCurrentRenderTarget(CM.positionVariable);
            if (posTarget) {
                U.u_positionTexture.value = posTarget.texture;
            }
        }
        
        // Link Texture
        if (IPM.currentTexture) {
            U.u_map.value = IPM.currentTexture;
        }

        // Link Visual Settings
        U.u_metalness.value = S.metalness;
        U.u_roughness.value = S.roughness;
        U.u_envMapIntensity.value = S.reflectionStrength;
        U.t_envMap.value = this.app.hdrTexture; 
        
        // Link Lighting
        if (this.app.camera) {
            U.u_cameraPosition.value.copy(this.app.camera.position);
        }
        U.u_lightColor.value.set(S.lightColor);
        U.u_ambientLightColor.value.set(S.ambientLightColor);
        U.u_lightDirection.value.set(S.lightDirectionX, S.lightDirectionY, S.lightDirectionZ).normalize();
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