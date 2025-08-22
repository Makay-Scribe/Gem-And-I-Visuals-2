import backgroundVertexShader from '../rendering/shaders/background.vert?raw';
import backgroundFragmentShader from '../rendering/shaders/background.frag?raw';

export const BackgroundManager = {
    app: null, // Will be set on init
    cubeCamera: null, // Will capture the live background for reflections
    activePresetId: null, // ** NEW: Track active preset **

    init(appInstance) {
        this.app = appInstance;
        // Use this.app.THREE directly
        const THREE = this.app.THREE;

        this.app.backgroundScene = new THREE.Scene();
        this.app.backgroundCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        const bgGeom = new THREE.PlaneGeometry(2, 2);
        
        // ** THE FIX IS HERE: Create only ONE placeholder texture **
        const bgPlaceholderTexture = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat);
        bgPlaceholderTexture.needsUpdate = true; // Ensure it gets uploaded to the GPU

        const defaultFragShader = `
            out vec4 outColor;
            void main() {
                outColor = vec4(0.0, 0.0, 0.0, 1.0); // Start with a black screen
            }
        `;

        this.app.shaderMaterial = new THREE.ShaderMaterial({
            vertexShader: backgroundVertexShader,
            fragmentShader: defaultFragShader, 
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
                // ** THE FIX IS HERE: All channels now reference the SAME texture instance **
                iChannel0: { value: bgPlaceholderTexture },
                iChannel1: { value: bgPlaceholderTexture },
                iChannel2: { value: bgPlaceholderTexture },
                iChannel3: { value: bgPlaceholderTexture },
                iChannelResolution: { value: [new THREE.Vector3(1, 1, 1), new THREE.Vector3(1, 1, 1), new THREE.Vector3(1, 1, 1), new THREE.Vector3(1, 1, 1)] }
            },
            glslVersion: THREE.GLSL3
        });

        this.app.butterchurnMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            depthTest: false,
            depthWrite: false,
            transparent: true
        });

        this.app.backgroundPlane = new THREE.Mesh(bgGeom, this.app.shaderMaterial);
        this.app.backgroundScene.add(this.app.backgroundPlane);

        const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256, {
            format: THREE.RGBAFormat,
            generateMipmaps: true,
            minFilter: THREE.LinearMipmapLinearFilter,
        });

        this.cubeCamera = new THREE.CubeCamera(1, 1000, cubeRenderTarget);
        this.app.backgroundScene.add(this.cubeCamera);

        this.app.hdrTexture = this.cubeCamera.renderTarget.texture;
    },

    updateShader(fragmentShaderCode) {
        if (!this.app.shaderMaterial) {
            console.error("BackgroundManager: shaderMaterial not initialized.");
            return;
        }

        const fullFragmentShader = backgroundFragmentShader.replace(
            '// SHADERTOY_CODE_GOES_HERE',
            fragmentShaderCode
        );
        
        this.app.shaderMaterial.fragmentShader = fullFragmentShader;
        this.app.shaderMaterial.needsUpdate = true;
    },

    onWindowResize() {
        if (this.app.shaderMaterial && this.app.shaderMaterial.uniforms.iResolution) {
            this.app.shaderMaterial.uniforms.iResolution.value.set(window.innerWidth, window.innerHeight, 1.0);
        }
    },

    update() {
        const S = this.app.vizSettings;
        const A = this.app.AudioProcessor;
        const THREE = this.app.THREE; // Alias for convenience
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

            } else {
                u.iAudioVolume.value = 0.0;
                u.iAudioLow.value = 0.0;
                u.iAudioMid.value = 0.0;
                u.iAudioHigh.value = 0.0;
                u.iBeat.value = 0.0;
            }
        }
    },

    render() {
        const bgMode = this.app.vizSettings.backgroundMode;
        let isBackgroundActive = false;

        if (bgMode === 'shader' || bgMode === 'butterchurn') {
             this.app.backgroundPlane.material = (bgMode === 'shader') 
                ? this.app.shaderMaterial 
                : this.app.butterchurnMaterial;
            
            this.app.backgroundPlane.visible = true;
            isBackgroundActive = true;

            if (bgMode === 'butterchurn' && this.app.ButterchurnManager.visualizer) {
                const updateInterval = Math.max(1, Math.floor(11 - this.app.vizSettings.butterchurnSpeed));
                if (this.app.frame % updateInterval === 0) {
                    this.app.ButterchurnManager.render();
                    if (this.app.butterchurnTexture) {
                        this.app.butterchurnTexture.needsUpdate = true;
                    }
                }
            }
        } else {
            this.app.backgroundPlane.visible = false;
        }

        // --- LIVE REFLECTION CAPTURE ---
        if (isBackgroundActive && this.app.vizSettings.enableReflections) {
            this.cubeCamera.update(this.app.renderer, this.app.backgroundScene);
            this.app.scene.environment = this.app.hdrTexture;
        } else {
            this.app.scene.environment = null;
        }
        
        // --- RENDER VISIBLE BACKGROUND ---
        if (isBackgroundActive) {
            this.app.renderer.render(this.app.backgroundScene, this.app.backgroundCamera);
        }
    }
};