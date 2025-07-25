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
    uniform int u_debugMode; // 0 for position, 1 for normal, 2 for custom

    varying vec2 vUv;

    // Remaps a value from one range to another.
    float remap(float value, float from1, float to1, float from2, float to2) {
        if (to1 - from1 == 0.0) return from2; // Avoid division by zero
        return from2 + (value - from1) * (to2 - from2) / (to1 - from1);
    }

    void main() {
        vec4 data = texture2D(tDebug, vUv);
        vec3 color = vec3(0.0); // Initialize to black

        if (u_debugMode == 0) { // Position Data
            // Remap position from world units to color range [0, 1]
            float halfWidth = u_planeDimensions.x / 2.0;
            float halfHeight = u_planeDimensions.y / 2.0;
            color.r = remap(data.x, -halfWidth, halfWidth, 0.0, 1.0);
            color.g = remap(data.y, -halfHeight, halfHeight, 0.0, 1.0);
            color.b = remap(data.z, -15.0, 15.0, 0.0, 1.0); // Visualize Z displacement
        } else if (u_debugMode == 1) { // Normal Data (No longer used, but keeping shader code for future)
            // Remap normal vectors from [-1, 1] to color range [0, 1]
            color = data.xyz * 0.5 + 0.5;
        } else { // Custom or fallback
            // Just display the raw data, useful for single-channel debug
            color = data.xyz;
        }

        gl_FragColor = vec4(color, 1.0);
    }
`;

export const GPGPUDebugger = {
    app: null,
    scene: null,
    camera: null,
    mesh: null,
    
    debugViewSelect: null,
    pixelValueDisplay: null,
    debugView: 'position',

    // --- PIXEL INSPECTOR PROPERTIES ---
    isMouseOver: false,
    mouse: null, 
    pixelBuffer: new Float32Array(4),
    
    init(appInstance) {
        this.app = appInstance;

        // Initialize properties that depend on app.THREE here
        this.mouse = new this.app.THREE.Vector2(); 

        if (!this.app.ComputeManager || !this.app.ComputeManager.gpuCompute) {
            console.error("GPGPUDebugger: ComputeManager not available on init.");
            return;
        }
        
        this.debugViewSelect = document.getElementById('gpgpuDebugViewSelect');
        this.pixelValueDisplay = document.getElementById('gpgpuDebugPixelValue');

        this.scene = new this.app.THREE.Scene();
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new this.app.THREE.OrthographicCamera(-aspect, aspect, 1, -1, 0, 1);

        const geometry = new this.app.THREE.PlaneGeometry(0.4, 0.4); 
        
        const material = new this.app.THREE.ShaderMaterial({
            vertexShader: gpgpuDebugVertexShader,
            fragmentShader: gpgpuDebugFragmentShader,
            uniforms: {
                tDebug: { value: null },
                u_planeDimensions: { value: this.app.ImagePlaneManager.planeDimensions },
                u_debugMode: { value: 0 }
            }
        });

        this.mesh = new this.app.THREE.Mesh(geometry, material);
        this.mesh.position.set(aspect - 0.22, -1.0 + 0.22, 0); 
        this.scene.add(this.mesh);

        if (this.debugViewSelect) {
            this.debugViewSelect.addEventListener('change', (e) => {
                this.debugView = e.target.value;
                if(this.pixelValueDisplay) this.pixelValueDisplay.textContent = 'Hover over debug plane...';
            });
        }

        console.log("GPGPU Debugger initialized with selectable views.");
    },

    // --- MOUSE HANDLING FUNCTION ---
    handleMouseMove(event) {
        if (!this.mesh || !this.app.vizSettings.enableGPGPUDebugger) {
            this.isMouseOver = false;
            return;
        }

        // Convert mouse from screen coordinates to Normalized Device Coordinates (NDC: -1 to 1)
        const mouseNDC = new this.app.THREE.Vector2(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1
        );

        // Get the debug plane's bounding box in NDC
        const planeSizeNDC = { width: this.mesh.geometry.parameters.width, height: this.mesh.geometry.parameters.height };
        const planePosNDC = { x: this.mesh.position.x, y: this.mesh.position.y };
        const planeBox = new this.app.THREE.Box2(
            new this.app.THREE.Vector2(planePosNDC.x - planeSizeNDC.width / 2, planePosNDC.y - planeSizeNDC.height / 2),
            new this.app.THREE.Vector2(planePosNDC.x + planeSizeNDC.width / 2, planePosNDC.y + planeSizeNDC.height / 2)
        );

        if (planeBox.containsPoint(mouseNDC)) {
            this.isMouseOver = true;
            // Calculate the mouse position *within* the debug plane, from 0.0 to 1.0 (local UV)
            this.mouse.x = (mouseNDC.x - planeBox.min.x) / planeSizeNDC.width;
            this.mouse.y = (mouseNDC.y - planeBox.min.y) / planeSizeNDC.height;
        } else {
            this.isMouseOver = false;
        }
    },

    onWindowResize() {
        if (!this.camera || !this.mesh) return;
        const aspect = window.innerWidth / window.innerHeight;
        this.camera.left = -aspect;
        this.camera.right = aspect;
        this.camera.updateProjectionMatrix();
        this.mesh.position.x = aspect - 0.22;
    },

    update() {
        if (!this.mesh || !this.app.vizSettings.enableGPGPUDebugger) return;

        let targetTexture;
        if (this.app.ComputeManager.gpuCompute) {
            let debugModeValue = 0;

            switch (this.debugView) {
                case 'position':
                    targetTexture = this.app.ComputeManager.gpuCompute.getCurrentRenderTarget(this.app.ComputeManager.positionVariable);
                    debugModeValue = 0;
                    break;
                case 'custom':
                    targetTexture = this.app.ComputeManager.gpuCompute.getCurrentRenderTarget(this.app.ComputeManager.positionVariable);
                    debugModeValue = 2; 
                    break;
                default:
                    targetTexture = this.app.ComputeManager.gpuCompute.getCurrentRenderTarget(this.app.ComputeManager.positionVariable);
                    debugModeValue = 0;
            }
            
            if (!targetTexture) return; // Prevent errors if the texture is somehow null

            this.mesh.material.uniforms.tDebug.value = targetTexture.texture;
            this.mesh.material.uniforms.u_debugMode.value = debugModeValue;
            this.mesh.material.uniforms.u_planeDimensions.value = this.app.ImagePlaneManager.planeDimensions;

            // --- PIXEL READING LOGIC ---
            if (this.isMouseOver) {
                const C = this.app.ComputeManager;
                const texelX = Math.floor(this.mouse.x * C.WIDTH);
                const texelY = Math.floor(this.mouse.y * C.HEIGHT);

                this.app.renderer.readRenderTargetPixels(
                    targetTexture,
                    texelX,
                    texelY,
                    1,
                    1,
                    this.pixelBuffer
                );

                // Call UIManager to display the value
                if (this.app.UIManager.updateGPGPUPixelValue) {
                    this.app.UIManager.updateGPGPUPixelValue(this.pixelBuffer);
                }

            } else {
                 // If the mouse is not over the plane, ensure the UI display is reset.
                 if (this.app.UIManager.isDisplayingPixelValue) {
                     this.app.UIManager.resetGPGPUPixelValue();
                 }
            }
        }
    },

    render() {
        if (this.scene && this.camera && this.app.vizSettings.enableGPGPUDebugger) {
            this.app.renderer.render(this.scene, this.camera);
        }
    }
};