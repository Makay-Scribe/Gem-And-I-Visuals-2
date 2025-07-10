import * as THREE from 'three';

// A simple vertex shader to draw a 2D plane in screen space.
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
        if (to1 - from1 == 0.0) return from2;
        return from2 + (value - from1) * (to2 - from2) / (to1 - from1);
    }

    void main() {
        vec4 data = texture2D(tDebug, vUv);
        float halfWidth = u_planeDimensions.x / 2.0;
        float halfHeight = u_planeDimensions.y / 2.0;
        float r = remap(data.x, -halfWidth, halfWidth, 0.0, 1.0);
        float g = remap(data.y, -halfHeight, halfHeight, 0.0, 1.0);
        float b = remap(data.z, -5.0, 5.0, 0.0, 1.0);
        gl_FragColor = vec4(r, g, b, 1.0);
    }
`;

export const GPGPUDebugger = {
    app: null,
    scene: null,
    camera: null,
    mesh: null,
    
    init(appInstance) {
        this.app = appInstance;

        if (!this.app.ComputeManager || !this.app.ComputeManager.gpuCompute) {
            console.error("GPGPUDebugger: ComputeManager not available on init.");
            return;
        }
        
        // Create a dedicated scene and camera for the 2D overlay.
        this.scene = new THREE.Scene();
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, 0, 1);

        const geometry = new THREE.PlaneGeometry(0.4, 0.4); 
        
        const material = new THREE.ShaderMaterial({
            vertexShader: gpgpuDebugVertexShader,
            fragmentShader: gpgpuDebugFragmentShader,
            uniforms: {
                tDebug: { value: null },
                u_planeDimensions: { value: this.app.ImagePlaneManager.planeDimensions }
            }
        });

        this.mesh = new THREE.Mesh(geometry, material);
        // Position the mesh in the bottom-right corner of the orthographic view.
        this.mesh.position.set(aspect - 0.22, -1.0 + 0.22, 0); 
        this.scene.add(this.mesh);

        console.log("GPGPU Debugger re-initialized as a 2D overlay.");
    },

    onWindowResize() {
        if (!this.camera || !this.mesh) return;
        const aspect = window.innerWidth / window.innerHeight;
        this.camera.left = -aspect;
        this.camera.right = aspect;
        this.camera.updateProjectionMatrix();
        // Reposition the mesh to keep it in the corner when the aspect ratio changes.
        this.mesh.position.x = aspect - 0.22;
    },

    update() {
        if (!this.mesh || !this.app.vizSettings.enableGPGPUDebugger) return;

        if (this.app.ComputeManager.gpuCompute) {
            // Update the debug texture to the latest GPGPU output.
            this.mesh.material.uniforms.tDebug.value = this.app.ComputeManager.gpuCompute.getCurrentRenderTarget(this.app.ComputeManager.positionVariable).texture;
            this.mesh.material.uniforms.u_planeDimensions.value = this.app.ImagePlaneManager.planeDimensions;
        }
    },

    render() {
        // Only render if enabled. This is called after the main scene render.
        if (this.scene && this.camera && this.app.vizSettings.enableGPGPUDebugger) {
            this.app.renderer.render(this.scene, this.camera);
        }
    }
};