import backgroundVertexShader from '../rendering/shaders/background.vert?raw';

export const ShaderManager = {
    app: null, // This will be set on init

    init(appInstance) {
        this.app = appInstance;
    },

    adaptShaderToyCode(glslCode) {
        let body = glslCode;
        body = body.replace(/^\s*(#version|precision).*/gm, ''); 
        const fullText = body;
        let declarations = "";
        const uniformMap = { 
            "iResolution": "uniform vec3 iResolution;\n", 
            "iTime": "uniform float iTime;\n", 
            "iFrame": "uniform int iFrame;\n", 
            "iDate": "uniform vec4 iDate;\n", 
            "iMouse": "uniform vec4 iMouse;\n", 
            "iChannel0": "uniform sampler2D iChannel0;\n", 
            "iChannel1": "uniform sampler2D iChannel1;\n", 
            "iChannel2": "uniform sampler2D iChannel2;\n", 
            "iChannel3": "uniform sampler2D iChannel3;\n", 
            "iChannelResolution": "uniform vec3 iChannelResolution[4];\n", 
            "iAudioVolume": "uniform float iAudioVolume;\n", 
            "iAudioLow": "uniform float iAudioLow;\n", 
            "iAudioMid": "uniform float iAudioMid;\n", 
            "iAudioHigh": "uniform float iAudioHigh;\n", 
            "iBeat": "uniform float iBeat;\n" 
        };

        for (const key in uniformMap) {
            const regex = new RegExp(`uniform\\s+\\w+\\s+${key}(\\[\\d\\])?\\s*;`);
            if (!regex.test(fullText)) {
                declarations += uniformMap[key];
            }
        }
        if (body.includes("vUv") && !body.match(/varying\s+vec2\s+vUv\s*;/m)) {
            declarations += "varying vec2 vUv;\n";
        }
        const mainImageRegex = /void\s+mainImage\s*\(\s*out\s+vec4\s+(\w+)\s*,\s*(in\s+)?vec2\s+(\w+)\s*\)/;
        if (mainImageRegex.test(body)) {
            const match = body.match(mainImageRegex);
            const outParamName = match[1];
            const inParamName = match[3];
            body = body.replace(mainImageRegex, "void main()");
            body = body.replace(new RegExp("\\b" + outParamName + "\\b", "g"), "gl_FragColor");
            body = body.replace(new RegExp("\\b" + inParamName + "\\b", "g"), "gl_FragCoord.xy");
        }
        return declarations + body;
    },
    loadUserShader() {
        // **FIX**: Ensure `this.app` exists before proceeding.
        if (!this.app) {
            console.error("ShaderManager: this.app is not initialized. Cannot load shader.");
            return;
        }

        const shaderTextarea = document.getElementById('shaderToyGLSL');
        let userInput = shaderTextarea ? shaderTextarea.value.trim() : '';

        if (!userInput) {
            if (this.app.UIManager) this.app.UIManager.logError("Shader text area is empty.");
            return;
        }

        const fragmentShaderSource = this.adaptShaderToyCode(userInput);
        // **FIX**: Get THREE from the initialized app instance.
        const THREE = this.app.THREE; 

        if (!this.app.shaderMaterial) {
            if (this.app.UIManager) this.app.UIManager.logError("App shaderMaterial not initialized.");
            return;
        }

        const tempMaterial = new THREE.ShaderMaterial({
            vertexShader: backgroundVertexShader,
            fragmentShader: fragmentShaderSource,
            uniforms: this.app.shaderMaterial.uniforms,
        });

        if (!this.app.renderer) {
             if (this.app.UIManager) this.app.UIManager.logError("Renderer not available for shader compilation test.");
             return;
        }
        const tempRenderer = new THREE.WebGLRenderer({
            alpha: true,
            powerPreference: "low-power",
            antialias: false,
        });
        tempRenderer.setSize(1, 1); 

        const tempScene = new THREE.Scene().add(new THREE.Mesh(new THREE.PlaneGeometry(), tempMaterial));
        const tempCamera = new THREE.Camera();
        
        try {
            tempRenderer.compile(tempScene, tempCamera);
            const programInfo = tempRenderer.info.programs[tempRenderer.info.programs.length - 1];
            const compileError = programInfo?.diagnostics?.fragmentShader.log;

            if (compileError && compileError.length > 0) {
                if (this.app.UIManager) this.app.UIManager.logError("Shader Failed: " + compileError.substring(0, 300) + "...");
            } else {
                this.app.shaderMaterial.fragmentShader = fragmentShaderSource;
                this.app.shaderMaterial.needsUpdate = true;
                if (this.app.UIManager) this.app.UIManager.logSuccess("Shader compiled and applied!");
                this.app.vizSettings.shaderToyGLSL = userInput;
            }
        } catch (e) {
            if (this.app.UIManager) this.app.UIManager.logError("Shader compilation test failed unexpectedly: " + e.message.substring(0, 150));
            console.error("Shader compilation test error:", e);
        } finally {
            tempMaterial.dispose();
            tempScene.clear();
            tempRenderer.dispose();
        }
    },
    loadChannelTexture(channelIndex, file) {
        // **FIX**: Ensure `this.app` exists before proceeding.
        if (!this.app) {
            console.error("ShaderManager: this.app is not initialized. Cannot load channel texture.");
            return;
        }

        const THREE = this.app.THREE;
        const uniforms = this.app.shaderMaterial ? this.app.shaderMaterial.uniforms : null;
        const channelKey = `iChannel${channelIndex}`;

        if (!uniforms) {
            if (this.app.UIManager) this.app.UIManager.logError(`ShaderMaterial uniforms not available for iChannel${channelIndex}.`);
            return;
        }

        if (!file || !file.type.startsWith('image/')) {
            const placeholder = new THREE.DataTexture(new Uint8Array([0,0,0,255]), 1, 1, THREE.RGBAFormat);
            if (uniforms[channelKey] && uniforms[channelKey].value && uniforms[channelKey].value.dispose) {
                uniforms[channelKey].value.dispose();
            }
            uniforms[channelKey].value = placeholder;
            if (uniforms.iChannelResolution && uniforms.iChannelResolution.value[channelIndex]) {
                 uniforms.iChannelResolution.value[channelIndex].set(1, 1, 1);
            }
            const inputElement = document.getElementById(`iChannel${channelIndex}Input`);
            if (inputElement) inputElement.value = '';
            if (this.app.UIManager) this.app.UIManager.logSuccess(`iChannel${channelIndex} texture cleared.`);
            return;
        }

        const loader = new THREE.TextureLoader();
        const url = URL.createObjectURL(file);
        loader.load(url,
            (texture) => {
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                if (uniforms[channelKey].value && uniforms[channelKey].value.dispose) {
                    uniforms[channelKey].value.dispose();
                }
                uniforms[channelKey].value = texture;
                if (uniforms.iChannelResolution && uniforms.iChannelResolution.value[channelIndex]) {
                    uniforms.iChannelResolution.value[channelIndex].set(texture.image.width, texture.image.height, 1);
                }
                URL.revokeObjectURL(url);
                if (this.app.UIManager) this.app.UIManager.logSuccess(`Loaded texture for iChannel${channelIndex}`);
            },
            undefined, 
            (err) => {
                if (this.app.UIManager) this.app.UIManager.logError(`Failed to load texture for iChannel${channelIndex}: ${err}`);
                console.error(`Failed to load texture for iChannel${channelIndex}:`, err);
                URL.revokeObjectURL(url);
            }
        );
    }
};