import * as THREE from 'three';

// --- SHADER CODE IS NOW INLINED HERE ---

const gpgpuDebugVertexShader = `
    varying vec2 vUv;

    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const gpgpuDebugFragmentShader = `
    uniform sampler2D tDebug; 
    uniform vec2 u_planeDimensions;

    varying vec2 vUv;

    float remap(float value, float from1, float to1, float from2, float to2) {
        // Add a check to prevent division by zero
        if (to1 - from1 == 0.0) return from2;
        return from2 + (value - from1) * (to2 - from2) / (to1 - from1);
    }

    void main() {
        // --- ORIGINAL CODE RE-ENABLED ---
        vec4 data = texture2D(tDebug, vUv);

        float halfWidth = u_planeDimensions.x / 2.0;
        float halfHeight = u_planeDimensions.y / 2.0;

        // Remap X position (-halfWidth to +halfWidth) to Red channel (0 to 1)
        float r = remap(data.x, -halfWidth, halfWidth, 0.0, 1.0);

        // Remap Y position (-halfHeight to +halfHeight) to Green channel (0 to 1)
        float g = remap(data.y, -halfHeight, halfHeight, 0.0, 1.0);

        // For the Z value, let's make 0.0 be a mid-grey (0.5)
        // and visualize some range around it.
        float b = remap(data.z, -5.0, 5.0, 0.0, 1.0);

        gl_FragColor = vec4(r, g, b, 1.0);
    }
`;

export const GPGPUDebugger = {
    app: null,
    mesh: null,
    
    init(appInstance) {
        this.app = appInstance;

        if (!this.app.ComputeManager || !this.app.ComputeManager.gpuCompute) {
            console.error("GPGPUDebugger: ComputeManager not available on init.");
            return;
        }

        const geometry = new THREE.PlaneGeometry(10, 10);
        
        const material = new THREE.ShaderMaterial({
            vertexShader: gpgpuDebugVertexShader,
            fragmentShader: gpgpuDebugFragmentShader,
            uniforms: {
                tDebug: { value: null },
                u_planeDimensions: { value: this.app.ImagePlaneManager.planeDimensions }
            },
            side: THREE.DoubleSide
        });

        this.mesh = new THREE.Mesh(geometry, material);
        
        // ** THE FIX IS HERE **
        // Positioned it to the left of the center.
        this.mesh.position.set(-15, 0, 5); 

        this.app.scene.add(this.mesh);

        console.log("GPGPU Debugger re-initialized as a 3D object in the main scene.");
    },

    update() {
        if (!this.mesh) return;

        this.mesh.visible = this.app.vizSettings.enableGPGPUDebugger;

        if (this.mesh.visible && this.app.ComputeManager.gpuCompute) {
            this.mesh.material.uniforms.tDebug.value = this.app.ComputeManager.gpuCompute.getCurrentRenderTarget(this.app.ComputeManager.positionVariable).texture;
        }
    },

    render() {
        // This function is intentionally empty.
    }
};