import * as THREE from 'three';

export const GPGPUDebugger = {
    app: null,
    renderer: null,
    scene: null,
    camera: null,
    mesh: null,
    
    // --- Configuration ---
    size: 128,
    margin: 10,

    init(appInstance) {
        this.app = appInstance;
        this.renderer = this.app.renderer;

        if (!this.app.ComputeManager || !this.renderer || !this.app.ComputeManager.gpuCompute) {
            console.error("GPGPUDebugger: ComputeManager or Renderer not available on init.");
            return;
        }

        this.scene = new THREE.Scene();
        
        this.camera = new THREE.OrthographicCamera(
            -this.size / 2, this.size / 2, 
             this.size / 2, -this.size / 2, 
             1, 1000
        );
        this.camera.position.z = 100;

        const geometry = new THREE.PlaneGeometry(this.size, this.size);
        
        // As a diagnostic, let's start with a bright red color.
        // If we see a red square, we know the rendering is correct.
        const material = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            side: THREE.DoubleSide
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.mesh);

        console.log("GPGPU Debugger initialized.");
    },

    update() {
        // The only job of update is to make sure the material is showing the latest texture.
        if (!this.app.vizSettings.enableGPGPUDebugger || !this.mesh || !this.app.ComputeManager.gpuCompute) {
            return;
        }
        
        // Point the material's map to the live GPGPU texture.
        this.mesh.material.map = this.app.ComputeManager.gpuCompute.getCurrentRenderTarget(this.app.ComputeManager.positionVariable).texture;
        this.mesh.material.color.set(0xffffff); // Set to white to see texture colors.
        this.mesh.material.needsUpdate = true;
    },

    // NEW: A dedicated render function to be called by the main loop.
    render() {
        if (!this.app.vizSettings.enableGPGPUDebugger || !this.mesh) {
            return;
        }
        
        const { width, height } = this.renderer.domElement;
        
        // Save state
        const currentViewport = new THREE.Vector4();
        this.renderer.getViewport(currentViewport);
        const currentScissor = new THREE.Vector4();
        this.renderer.getScissor(currentScissor);
        const isScissorTest = this.renderer.getScissorTest();

        // Set viewport for top-left corner
        this.renderer.setViewport(this.margin, height - this.size - this.margin, this.size, this.size);
        this.renderer.setScissor(this.margin, height - this.size - this.margin, this.size, this.size);
        this.renderer.setScissorTest(true);

        // Render the debug scene
        this.renderer.render(this.scene, this.camera);

        // Restore state
        this.renderer.setViewport(currentViewport);
        this.renderer.setScissor(currentScissor);
        this.renderer.setScissorTest(isScissorTest);
    }
};