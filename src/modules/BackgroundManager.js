import backgroundVertexShader from '../rendering/shaders/background.vert?raw';
import backgroundFragmentShader from '../rendering/shaders/background.frag?raw';

export const BackgroundManager = {
    app: null, // Will be set on init

    init(appInstance) {
        this.app = appInstance;
        const THREE = this.app.THREE;

        // Create the dedicated scene and camera for the background
        this.app.backgroundScene = new THREE.Scene();
        this.app.backgroundCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        // Create the plane that will cover the screen
        const bgGeom = new THREE.PlaneGeometry(2, 2);
        
        // Create a placeholder texture for shader channels to prevent errors
        const bgPlaceholderTexture = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat);

        // --- Create Materials ---
        // ShaderToy-compatible material
        this.app.shaderMaterial = new THREE.ShaderMaterial({
            vertexShader: backgroundVertexShader,
            fragmentShader: backgroundFragmentShader,
            uniforms: {
                iResolution: { value: new THREE.Vector3(window.innerWidth, window.innerHeight, 1.0) },
                iTime: { value: 0.0 },
                iFrame: { value: 0 },
                iDate: { value: new THREE.Vector4() },
                iMouse: { value: this.app.mouseState },
                iAudioVolume: { value: 0.0 },
                iAudioLow: { value: 0.0 },
                iAudioMid: { value: 0.0 },
                iAudioHigh: { value: 0.0 },
                iBeat: { value: 0.0 },
                iChannel0: { value: bgPlaceholderTexture.clone() },
                iChannel1: { value: bgPlaceholderTexture.clone() },
                iChannel2: { value: bgPlaceholderTexture.clone() },
                iChannel3: { value: bgPlaceholderTexture.clone() },
                iChannelResolution: { value: [new THREE.Vector3(1, 1, 1), new THREE.Vector3(1, 1, 1), new THREE.Vector3(1, 1, 1), new THREE.Vector3(1, 1, 1)] }
            }
        });

        // Butterchurn material
        this.app.butterchurnMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            depthTest: false,
            depthWrite: false,
            transparent: true
        });

        // Create the mesh and add it to the background scene
        this.app.backgroundPlane = new THREE.Mesh(bgGeom, this.app.shaderMaterial);
        this.app.backgroundScene.add(this.app.backgroundPlane);
    },

    onWindowResize() {
        if (this.app.shaderMaterial && this.app.shaderMaterial.uniforms.iResolution) {
            this.app.shaderMaterial.uniforms.iResolution.value.set(window.innerWidth, window.innerHeight, 1.0);
        }
    },

    update() {
        // This method will be responsible for updating uniforms and rendering the background pass
        const S = this.app.vizSettings;
        const A = this.app.AudioProcessor;
        const THREE = this.app.THREE;

        // --- Uniform Updates for ShaderToy Background ---
        if (this.app.shaderMaterial && this.app.shaderMaterial.uniforms.iTime) {
            const u = this.app.shaderMaterial.uniforms;
            const d = new Date();
            u.iTime.value = this.app.currentTime;
            u.iFrame.value = this.app.frame;
            u.iDate.value.set(d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000);

            if (S.shaderAudioLink) {
                let rawAudioValue = 0;
                switch (S.shaderAudioSource) {
                    case 'lows': rawAudioValue = A.energy.low; break;
                    case 'mids': rawAudioValue = A.energy.mid; break;
                    case 'highs': rawAudioValue = A.energy.high; break;
                    case 'beat': rawAudioValue = A.triggers.beat ? 1.0 : 0.0; break;
                    case 'volume': rawAudioValue = A.energy.overall; break;
                }
                const targetValue = rawAudioValue * S.shaderAudioStrength;
                this.app.shaderAudioValue = THREE.MathUtils.lerp(this.app.shaderAudioValue, targetValue, 1.0 - S.shaderAudioSmoothing);
                
                u.iAudioVolume.value = this.app.shaderAudioValue;
                u.iAudioLow.value = A.energy.low * S.shaderAudioStrength;
                u.iAudioMid.value = A.energy.mid * S.shaderAudioStrength;
                u.iAudioHigh.value = A.energy.high * S.shaderAudioStrength;
                u.iBeat.value = A.triggers.beat ? 1.0 * S.shaderAudioStrength : 0.0;

            } else { // If not linked, ensure all audio uniforms are zero
                u.iAudioVolume.value = 0.0;
                u.iAudioLow.value = 0.0;
                u.iAudioMid.value = 0.0;
                u.iAudioHigh.value = 0.0;
                u.iBeat.value = 0.0;
            }
        }
    },

    render() {
        // This method handles the actual rendering of the background
        const bgMode = this.app.vizSettings.backgroundMode;
        this.app.backgroundPlane.visible = false; // Hide by default

        if (bgMode === 'shader' && this.app.shaderMaterial) {
            this.app.backgroundPlane.material = this.app.shaderMaterial;
            this.app.backgroundPlane.visible = true;
            this.app.renderer.render(this.app.backgroundScene, this.app.backgroundCamera);
        } else if (bgMode === 'butterchurn' && this.app.butterchurnMaterial) {
            this.app.backgroundPlane.material = this.app.butterchurnMaterial;
            this.app.backgroundPlane.visible = true;
            if (this.app.ButterchurnManager.visualizer) {
                const updateInterval = Math.max(1, Math.floor(11 - this.app.vizSettings.butterchurnSpeed));
                if (this.app.frame % updateInterval === 0) {
                    this.app.ButterchurnManager.render();
                    if (this.app.butterchurnTexture) {
                        this.app.butterchurnTexture.needsUpdate = true;
                    }
                }
            }
            this.app.renderer.render(this.app.backgroundScene, this.app.backgroundCamera);
        } else if (bgMode === 'greenscreen') {
            this.app.renderer.setClearColor(new this.app.THREE.Color('#00ff00'));
            this.app.renderer.clear();
        } else { // 'black' or default
            this.app.renderer.setClearColor(new this.app.THREE.Color('#000000'));
            this.app.renderer.clear();
        }
    }
};