import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';
import * as THREE from 'three'; // Explicitly import THREE

export const ComputeManager = {
    app: null, // Main app instance
    gpuCompute: null,
    
    positionVariable: null,
    normalVariable: null,
    initialPositionTexture: null,
    initialNormalTexture: null,
    WIDTH: 0,
    HEIGHT: 0,
    AREA: 0,

    init(appInstance, planeWidth, planeHeight, planeResX, planeResY) {
        this.app = appInstance;
        const renderer = this.app.renderer;

        this.WIDTH = planeResX;
        this.HEIGHT = planeResY;
        this.AREA = this.WIDTH * this.HEIGHT;

        if (!renderer.capabilities.isWebGL2) {
            this.app.UIManager.logError("GPGPU Compute requires WebGL2.");
            return;
        }

        if (renderer.capabilities.floatFragmentTextures === false) {
            this.app.UIManager.logError("No float textures support on this GPU.");
            return;
        }

        this.gpuCompute = new GPUComputationRenderer(this.WIDTH, this.HEIGHT, renderer);

        const initialPositionData = new Float32Array(this.AREA * 4);
        const initialNormalData = new Float32Array(this.AREA * 4);

        const halfWidth = planeWidth / 2;
        const halfHeight = planeHeight / 2;

        for (let i = 0; i < this.HEIGHT; i++) {
            for (let j = 0; j < this.WIDTH; j++) {
                const index = (i * this.WIDTH + j);
                const x = (j / (this.WIDTH - 1)) * planeWidth - halfWidth;
                const y = (i / (this.HEIGHT - 1)) * planeHeight - halfHeight;
                const z = 0.0; 

                initialPositionData[index * 4 + 0] = x;
                initialPositionData[index * 4 + 1] = y;
                initialPositionData[index * 4 + 2] = z;
                initialPositionData[index * 4 + 3] = 1.0; 
                
                initialNormalData[index * 4 + 0] = 0.0;
                initialNormalData[index * 4 + 1] = 0.0;
                initialNormalData[index * 4 + 2] = 1.0;
                initialNormalData[index * 4 + 3] = 1.0;
            }
        }

        this.initialPositionTexture = new THREE.DataTexture(initialPositionData, this.WIDTH, this.HEIGHT, THREE.RGBAFormat, THREE.FloatType);
        this.initialPositionTexture.needsUpdate = true;

        this.initialNormalTexture = new THREE.DataTexture(initialNormalData, this.WIDTH, this.HEIGHT, THREE.RGBAFormat, THREE.FloatType);
        this.initialNormalTexture.needsUpdate = true;

        this.positionVariable = this.gpuCompute.addVariable('texturePosition', this.positionShader, this.initialPositionTexture);
        this.normalVariable = this.gpuCompute.addVariable('textureNormal', this.normalShader, this.initialNormalTexture);

        this.gpuCompute.setVariableDependencies(this.normalVariable, [this.positionVariable]);
        this.gpuCompute.setVariableDependencies(this.positionVariable, [this.positionVariable]);

        const planeDimensionsVec2 = new THREE.Vector2(planeWidth, planeHeight);
        
        this.positionVariable.material.uniforms['u_time'] = { value: 0 };
        this.positionVariable.material.uniforms['u_audioLow'] = { value: 0 };
        this.positionVariable.material.uniforms['u_audioMid'] = { value: 0 };
        this.positionVariable.material.uniforms['u_beat'] = { value: 0 };
        this.positionVariable.material.uniforms['u_planeDimensions'] = { value: planeDimensionsVec2 };
        this.positionVariable.material.uniforms['u_deformationStrength'] = { value: 0.0 };
        this.positionVariable.material.uniforms['u_planeOrientation'] = { value: 0 };
        this.positionVariable.material.uniforms['u_mouse'] = { value: new THREE.Vector2(0, 0) }; // NEW
        this.positionVariable.material.uniforms['u_mouseEnabled'] = { value: 0.0 }; // NEW

        this.normalVariable.material.uniforms['u_time'] = { value: 0 };
        this.normalVariable.material.uniforms['u_audioLow'] = { value: 0 };
        this.normalVariable.material.uniforms['u_planeDimensions'] = { value: planeDimensionsVec2 };
        this.normalVariable.material.uniforms['u_deformationStrength'] = { value: 0.0 };
        this.normalVariable.material.uniforms['u_planeOrientation'] = { value: 0 };
        this.normalVariable.material.uniforms['u_mouse'] = { value: new THREE.Vector2(0, 0) }; // NEW
        this.normalVariable.material.uniforms['u_mouseEnabled'] = { value: 0.0 }; // NEW


        const error = this.gpuCompute.init();
        if (error !== null) {
            this.app.UIManager.logError("GPGPU Init Error: " + error);
            console.error("GPGPU Init Error:", error);
        } else {
            this.app.UIManager.logSuccess("GPGPU Compute Initialized.");
        }
    },

    update(delta) {
        if (!this.gpuCompute) return;

        const S = this.app.vizSettings;
        const A = this.app.AudioProcessor;
        const M = this.app.mouseState;
        const orientationMap = { 'xy': 0, 'xz': 1, 'yz': 2 };
        const orientationValue = orientationMap[S.planeOrientation] || 0;

        const positionUniforms = this.positionVariable.material.uniforms;
        positionUniforms['u_time'].value = this.app.currentTime;
        positionUniforms['u_audioLow'].value = A.energy.low;
        positionUniforms['u_audioMid'].value = A.energy.mid;
        positionUniforms['u_beat'].value = A.triggers.beat ? 1.0 : 0.0;
        positionUniforms['u_deformationStrength'].value = S.deformationStrength;
        positionUniforms['u_planeOrientation'].value = orientationValue;
        // NEW: Update mouse uniforms
        positionUniforms['u_mouse'].value.set(M.x / window.innerWidth, 1.0 - M.y / window.innerHeight);
        positionUniforms['u_mouseEnabled'].value = S.enableShaderMouse ? 1.0 : 0.0;

        const normalUniforms = this.normalVariable.material.uniforms;
        normalUniforms['u_time'].value = this.app.currentTime;
        normalUniforms['u_audioLow'].value = A.energy.low;
        normalUniforms['u_deformationStrength'].value = S.deformationStrength;
        normalUniforms['u_planeOrientation'].value = orientationValue;
        // NEW: Update mouse uniforms
        normalUniforms['u_mouse'].value.set(M.x / window.innerWidth, 1.0 - M.y / window.innerHeight);
        normalUniforms['u_mouseEnabled'].value = S.enableShaderMouse ? 1.0 : 0.0;

        this.gpuCompute.compute();
    },

    positionShader: `
        uniform float u_time;
        uniform float u_audioLow;
        uniform vec2 u_planeDimensions;
        uniform float u_deformationStrength;
        uniform int u_planeOrientation;
        uniform vec2 u_mouse; // NEW
        uniform float u_mouseEnabled; // NEW

        void main() {
            vec2 uv = gl_FragCoord.xy / resolution.xy;
            vec3 pos;

            if (u_planeOrientation == 1) { // XZ (Floor)
                pos = vec3((uv.x - 0.5) * u_planeDimensions.x, 0.0, (uv.y - 0.5) * u_planeDimensions.y);
                pos.y += u_audioLow * u_deformationStrength;
            } else if (u_planeOrientation == 2) { // YZ (Side Wall)
                pos = vec3(0.0, (uv.y - 0.5) * u_planeDimensions.y, (uv.x - 0.5) * u_planeDimensions.x);
                pos.x -= u_audioLow * u_deformationStrength;
            } else { // XY (Wall) - Default
                pos = vec3((uv.x - 0.5) * u_planeDimensions.x, (uv.y - 0.5) * u_planeDimensions.y, 0.0);
                pos.z += u_audioLow * u_deformationStrength;
            }

            // NEW: Add mouse deformation
            float mouseDist = distance(uv, u_mouse);
            float mouseEffect = 1.0 - smoothstep(0.0, 0.15, mouseDist);
            float displacement = -5.0 * mouseEffect * u_mouseEnabled;

            if (u_planeOrientation == 1) { // XZ
                pos.y += displacement;
            } else if (u_planeOrientation == 2) { // YZ
                pos.x += displacement;
            } else { // XY
                pos.z += displacement;
            }

            gl_FragColor = vec4(pos, 1.0);
        }
    `,
    normalShader: `
        uniform float u_time;
        uniform float u_audioLow;
        uniform vec2 u_planeDimensions;
        uniform float u_deformationStrength;
        uniform int u_planeOrientation;
        uniform vec2 u_mouse; // NEW
        uniform float u_mouseEnabled; // NEW

        vec3 getDeformedPosition(vec2 uv) {
            vec3 pos;
            
            if (u_planeOrientation == 1) { // XZ (Floor)
                pos = vec3((uv.x - 0.5) * u_planeDimensions.x, 0.0, (uv.y - 0.5) * u_planeDimensions.y);
                pos.y += u_audioLow * u_deformationStrength;
            } else if (u_planeOrientation == 2) { // YZ (Side Wall)
                 pos = vec3(0.0, (uv.y - 0.5) * u_planeDimensions.y, (uv.x - 0.5) * u_planeDimensions.x);
                pos.x -= u_audioLow * u_deformationStrength;
            } else { // XY (Wall) - Default
                pos = vec3((uv.x - 0.5) * u_planeDimensions.x, (uv.y - 0.5) * u_planeDimensions.y, 0.0);
                pos.z += u_audioLow * u_deformationStrength;
            }

            // NEW: Add mouse deformation (must match position shader)
            float mouseDist = distance(uv, u_mouse);
            float mouseEffect = 1.0 - smoothstep(0.0, 0.15, mouseDist);
            float displacement = -5.0 * mouseEffect * u_mouseEnabled;

            if (u_planeOrientation == 1) { // XZ
                pos.y += displacement;
            } else if (u_planeOrientation == 2) { // YZ
                pos.x += displacement;
            } else { // XY
                pos.z += displacement;
            }

            return pos;
        }

        void main() {
            vec2 uv = gl_FragCoord.xy / resolution.xy;
            float dx = 1.0 / resolution.x;
            float dy = 1.0 / resolution.y;

            vec3 p_center = getDeformedPosition(uv);
            vec3 p_right  = getDeformedPosition(uv + vec2(dx, 0.0));
            vec3 p_up     = getDeformedPosition(uv + vec2(0.0, dy));
            
            vec3 tangent = p_right - p_center;
            vec3 bitangent = p_up - p_center;

            vec3 normal = normalize(cross(tangent, bitangent));
            gl_FragColor = vec4(normal, 1.0);
        }
    `
};