// A simple vertex shader to draw a 2D plane in screen space.
const gpgpuDebugVertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

// An advanced fragment shader with multiple modes for visualizing GPGPU data.
const gpgpuDebugFragmentShader = `
    uniform sampler2D tDebug;
    uniform float u_worldSize; // Max dimension of the world space (e.g., 40 for fluid sim)
    uniform int u_debugViewMode; // 0:Pos(World), 1:Vel(Vector), 2:Raw, 3:Alpha

    varying vec2 vUv;

    // Remaps a value from one range to another.
    float remap(float value, float from1, float to1, float from2, float to2) {
        if (to1 - from1 == 0.0) return from2; // Avoid division by zero
        return from2 + (value - from1) * (to2 - from2) / (to1 - from1);
    }

    void main() {
        vec4 data = texture2D(tDebug, vUv);
        vec3 color = vec3(0.0);

        if (u_debugViewMode == 0) { // Position (World)
            float halfWorld = u_worldSize / 2.0;
            color.r = remap(data.r, -halfWorld, halfWorld, 0.0, 1.0);
            color.g = remap(data.g, -halfWorld, halfWorld, 0.0, 1.0);
            color.b = remap(data.b, -halfWorld, halfWorld, 0.0, 1.0);
        } else if (u_debugViewMode == 1) { // Velocity (Vector)
            color = data.rgb * 0.5 + 0.5;
        } else if (u_debugViewMode == 2) { // Raw Data
            color = data.rgb;
        } else if (u_debugViewMode == 3) { // Alpha Channel
            color = vec3(data.a);
        }

        gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
`;

export const GPGPUDebugger = {
    app: null,
    scene: null,
    camera: null,
    mesh: null,
    
    systemSelect: null,
    textureSelect: null,
    viewSelect: null,
    pixelValueDisplay: null,

    debugSystem: 'particles',
    debugTexture: 'position',
    debugView: 'world',

    isMouseOver: false,
    mouse: null, 
    pixelBuffer: new Float32Array(4),
    
    init(appInstance) {
        this.app = appInstance;
        this.mouse = new this.app.THREE.Vector2(); 

        this.systemSelect = document.getElementById('gpgpuDebugSystemSelect');
        this.textureSelect = document.getElementById('gpgpuDebugTextureSelect');
        this.viewSelect = document.getElementById('gpgpuDebugViewSelect');
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
                u_worldSize: { value: 40.0 },
                u_debugViewMode: { value: 0 }
            }
        });

        this.mesh = new this.app.THREE.Mesh(geometry, material);
        this.mesh.position.set(aspect - 0.22, -1.0 + 0.22, 0); 
        this.scene.add(this.mesh);

        if (this.systemSelect) {
            this.systemSelect.addEventListener('change', (e) => {
                this.debugSystem = e.target.value;
                this.updateTextureOptions();
                if(this.pixelValueDisplay) this.pixelValueDisplay.textContent = 'Hover over debug plane...';
            });
        }
        if (this.textureSelect) {
            this.textureSelect.addEventListener('change', (e) => {
                this.debugTexture = e.target.value;
                if(this.pixelValueDisplay) this.pixelValueDisplay.textContent = 'Hover over debug plane...';
            });
        }
        if (this.viewSelect) {
            this.viewSelect.addEventListener('change', (e) => {
                this.debugView = e.target.value;
                if(this.pixelValueDisplay) this.pixelValueDisplay.textContent = 'Hover over debug plane...';
            });
        }

        this.updateTextureOptions();
        console.log("Upgraded GPGPU Debugger initialized.");
    },

    updateTextureOptions() {
        if (!this.textureSelect) return;

        this.textureSelect.innerHTML = '';
        const addOption = (value, text) => {
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = text;
            this.textureSelect.appendChild(opt);
        };

        addOption('position', 'Position');

        if (this.debugSystem === 'landscape') {
            addOption('previousPosition', 'Previous Position');
        }
        
        if (this.debugSystem === 'particles' || this.debugSystem === 'fluidsim') {
            addOption('velocity', 'Velocity');
        }
        
        this.debugTexture = this.textureSelect.value;
    },

    handleMouseMove(event) {
        if (!this.mesh || !this.app.vizSettings.enableGPGPUDebugger) {
            this.isMouseOver = false;
            return;
        }

        const mouseNDC = new this.app.THREE.Vector2(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1
        );

        const planeSizeNDC = { width: this.mesh.geometry.parameters.width, height: this.mesh.geometry.parameters.height };
        const planePosNDC = { x: this.mesh.position.x, y: this.mesh.position.y };
        const planeBox = new this.app.THREE.Box2(
            new this.app.THREE.Vector2(planePosNDC.x - planeSizeNDC.width / 2, planePosNDC.y - planeSizeNDC.height / 2),
            new this.app.THREE.Vector2(planePosNDC.x + planeSizeNDC.width / 2, planePosNDC.y + planeSizeNDC.height / 2)
        );

        if (planeBox.containsPoint(mouseNDC)) {
            this.isMouseOver = true;
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

        const CM = this.app.ComputeManager;
        let computeInstance = null;
        let variable = null;
        let worldSize = 40.0;
        let resolution = { x: 0, y: 0 };

        // --- BUG FIX: POINT TO THE CORRECT GPGPU INSTANCES AND VARIABLES ---
        switch (this.debugSystem) {
            case 'landscape':
                computeInstance = CM.landscapeGpuCompute; // Correct instance
                if (computeInstance) {
                    variable = this.debugTexture === 'position' ? CM.landscapePositionVariable : CM.landscapePreviousPositionVariable; // Correct variables
                    worldSize = this.app.ImagePlaneManager.planeDimensions.x;
                    resolution.x = this.app.ImagePlaneManager.planeResolution.x;
                    resolution.y = this.app.ImagePlaneManager.planeResolution.y;
                }
                break;
            case 'particles':
            case 'fluidsim': // Particles and Fluid sim share the same unified engine
                computeInstance = CM.gpuCompute; // Correct instance
                if (computeInstance) {
                    variable = this.debugTexture === 'position' ? CM.positionVariable : CM.velocityVariable; // Correct variables
                    worldSize = this.app.ImagePlaneManager.planeDimensions.x;
                    resolution.x = this.app.vizSettings.particle_resolution;
                    resolution.y = this.app.vizSettings.particle_resolution;
                }
                break;
        }
        // --- END BUG FIX ---

        if (!computeInstance || !variable) {
            this.mesh.visible = false;
            return;
        }
        this.mesh.visible = true;

        const targetTexture = computeInstance.getCurrentRenderTarget(variable);
        if (!targetTexture) return;

        this.mesh.material.uniforms.tDebug.value = targetTexture.texture;
        this.mesh.material.uniforms.u_worldSize.value = worldSize;
        const viewModeMap = { 'world': 0, 'vector': 1, 'raw': 2, 'alpha': 3 };
        this.mesh.material.uniforms.u_debugViewMode.value = viewModeMap[this.debugView] || 0;

        if (this.isMouseOver) {
            const texelX = Math.floor(this.mouse.x * resolution.x);
            const texelY = Math.floor(this.mouse.y * resolution.y);

            this.app.renderer.readRenderTargetPixels(
                targetTexture, texelX, texelY, 1, 1, this.pixelBuffer
            );

            if (this.app.UIManager.updateGPGPUPixelValue) {
                this.app.UIManager.updateGPGPUPixelValue(this.pixelBuffer);
            }
        } else {
             if (this.app.UIManager.isDisplayingPixelValue) {
                 this.app.UIManager.resetGPGPUPixelValue();
             }
        }
    },

    render() {
        if (this.scene && this.camera && this.app.vizSettings.enableGPGPUDebugger) {
            this.app.renderer.render(this.scene, this.camera);
        }
    }
};