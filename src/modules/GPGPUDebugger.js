import * as THREE from 'three';

export const GPGPUDebugger = {
    app: null,
    renderer: null,
    scene: null,
    camera: null,
    mesh: null,
    
    // --- Configuration ---
    size: 128,      // On-screen size in pixels
    margin: 10,     // Margin from the edge of the screen

    init(appInstance) {
        this.app = appInstance;
        this.renderer = this.app.renderer;

        // Don't initialize if the core components aren't ready
        if (!this.app.ComputeManager || !this.renderer || !this.app.ComputeManager.gpuCompute) {
            console.error("GPGPUDebugger: ComputeManager or Renderer not available on init.");
            return;
        }

        this.scene = new THREE.Scene();
        
        // Use an OrthographicCamera for a 2D, pixel-perfect view
        this.camera = new THREE.OrthographicCamera(
            -this.size / 2, this.size / 2, 
             this.size / 2, -this.size / 2, 
             1, 1000
        );
        this.camera.position.z = 100;

        const geometry = new THREE.PlaneGeometry(this.size, this.size);
        
        // The material's map will be the GPGPU texture.
        // We get the initial texture to start with.
        const positionTexture = this.app.ComputeManager.gpuCompute.getCurrentRenderTarget(this.app.ComputeManager.positionVariable).texture;

        const material = new THREE.MeshBasicMaterial({
            map: positionTexture,
            side: THREE.DoubleSide
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.mesh);

        console.log("GPGPU Debugger initialized.");
    },

    update() {
        // Don't render if disabled via the UI or if not properly initialized
        if (!this.app.vizSettings.enableGPGPUDebugger || !this.mesh || !this.app.ComputeManager.gpuCompute) {
            return;
        }

        // CRITICAL: On each frame, update the material's map to point to the *current* 
        // result of the GPGPU computation. This is how we see the live changes.
        this.mesh.material.map = this.app.ComputeManager.gpuCompute.getCurrentRenderTarget(this.app.ComputeManager.positionVariable).texture;
        
        const { width, height } = this.renderer.domElement;

        // Store current renderer state so we don't interfere with the main scene
        const currentViewport = new THREE.Vector4();
        this.renderer.getViewport(currentViewport);
        const currentScissor = new THREE.Vector4();
        this.renderer.getScissor(currentScissor);
        const isScissorTest = this.renderer.getScissorTest();

        // Set the viewport and scissor to render the debugger in the top-left corner.
        this.renderer.setViewport(this.margin, height - this.size - this.margin, this.size, this.size);
        this.renderer.setScissor(this.margin, height - this.size - this.margin, this.size, this.size);
        this.renderer.setScissorTest(true);

        // Render the debug scene on top of everything else.
        this.renderer.render(this.scene, this.camera);

        // IMPORTANT: Restore the original viewport and scissor state for the next frame's main render.
        this.renderer.setViewport(currentViewport);
        this.renderer.setScissor(currentScissor);
        this.renderer.setScissorTest(isScissorTest);
    }
};