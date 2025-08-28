import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';

export const ComputeManager = {
    app: null, // Main app instance
    gpuCompute: null,
    
    positionVariable: null,
    previousPositionVariable: null, 
    normalVariable: null, 
    initialPositionTexture: null,

    clothEnableTime: -1, 

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
                initialPositionData[index * 4 + 3] = 1.0; // W component is 1.0
            }
        }

        this.initialPositionTexture = new this.app.THREE.DataTexture(initialPositionData, this.WIDTH, this.HEIGHT, this.app.THREE.RGBAFormat, this.app.THREE.FloatType);
        this.initialPositionTexture.needsUpdate = true;
        
        this.positionVariable = this.gpuCompute.addVariable('texturePosition', this.positionShader, this.initialPositionTexture);
        this.previousPositionVariable = this.gpuCompute.addVariable('texturePreviousPosition', this.copyShader, this.initialPositionTexture);

        this.gpuCompute.setVariableDependencies(this.positionVariable, [this.positionVariable, this.previousPositionVariable]);
        this.gpuCompute.setVariableDependencies(this.previousPositionVariable, [this.positionVariable]);
        
        // ** THE FIX IS HERE: All legacy uniforms have been removed **
        const uniforms = {
            u_initialPosition: { value: this.initialPositionTexture },
            u_time: { value: 0 },
            u_delta: { value: 0 },
            u_audioLow: { value: 0 },
            u_audioTexture: { value: this.app.AudioProcessor.audioTexture }, 
            u_planeDimensions: { value: new this.app.THREE.Vector2(planeWidth, planeHeight) },
            u_gpgpu_enableWaterRipple: { value: false },
            u_gpgpu_rippleSpeed: { value: 0.5 },
            u_gpgpu_rippleStrength: { value: 1.0 },
            u_gpgpu_rippleFrequency: { value: 15.0 },
            u_gpgpu_enableEqRipple: { value: false },
            u_gpgpu_eqRippleStrength: { value: 2.0 },
            u_gpgpu_eqRippleSmoothing: { value: 0.5 },
            u_gpgpu_eqRippleBarCount: { value: 64.0 },
            u_gpgpu_eqRippleBarWidth: { value: 0.8 },
            u_gpgpu_eqRippleRangeStart: { value: 0.0 },
            u_gpgpu_eqRippleRangeEnd: { value: 1.0 },
            u_gpgpu_eqRippleStyle: { value: 0 },
            u_gpgpu_enableCloth: { value: false },
            u_gpgpu_clothDamping: { value: 1.0 },
            u_gpgpu_clothStiffness: { value: 0.8 },
            u_gpgpu_clothAudioForce: { value: 500.0 },
            u_gpgpu_clothForceRadius: { value: 0.3 },
            gpgpu_clothIterations: { value: 1 },
            gpgpu_clothPinMode: { value: 1 },
            u_gpgpu_tetherStrength: { value: 82.0 },
            u_gpgpu_ambientWindStrength: { value: 4.0 },
            u_gpgpu_ambientWindSpeed: { value: 0.3 },
            u_gpgpu_ambientWindScale: { value: 2.0 },
            u_gpgpu_directionalWind: { value: new this.app.THREE.Vector3(0, 1.6, 5.8) },
            u_gpgpu_clothBlendTime: { value: 9.6 },
            u_gpgpu_clothBlendFactor: { value: 0.0 },
            u_gpgpu_enableFold: { value: false },
            u_gpgpu_foldAngle: { value: 0.0 },
            u_gpgpu_foldDepth: { value: 0.0 },
            u_gpgpu_foldRoundness: { value: 0.0 },
            u_gpgpu_foldAudioMod: { value: 0.0 },
            u_gpgpu_foldNudge: { value: 0.0 },
            u_gpgpu_enableFoldCrease: { value: false },
            u_gpgpu_foldCreaseDepth: { value: 0.0 },
            u_gpgpu_foldCreaseSharpness: { value: 0.0 },
            u_gpgpu_enableFoldTuck: { value: false },
            u_gpgpu_foldTuckAmount: { value: 0.0 },
            u_gpgpu_foldTuckReach: { value: 0.0 },
            u_gpgpu_enableCylinder: { value: false },
            u_gpgpu_cylinderRadius: { value: 0.0 },
            u_gpgpu_cylinderHeightScale: { value: 0.0 },
            u_gpgpu_cylinderAxisAlignment: { value: 0 },
            u_gpgpu_cylinderArcAngle: { value: 0.0 },
            u_gpgpu_cylinderArcOffset: { value: 0.0 },
            u_gpgpu_enableSag: { value: false },
            u_gpgpu_sagAmount: { value: 0.0 },
            u_gpgpu_sagFalloffSharpness: { value: 0.0 },
            u_gpgpu_sagAudioMod: { value: 0.0 },
            u_gpgpu_enableDroop: { value: false },
            u_gpgpu_droopAmount: { value: 0.0 },
            u_gpgpu_droopAudioMod: { value: 0.0 },
            u_gpgpu_droopFalloffSharpness: { value: 0.0 },
            u_gpgpu_droopSupportedWidthFactor: { value: 0.0 },
            u_gpgpu_droopSupportedDepthFactor: { value: 0.0 },
            u_gpgpu_enablePeel: { value: false },
            u_gpgpu_peelAmount: { value: 0.0 },
            u_gpgpu_peelCurl: { value: 0.0 },
            u_gpgpu_peelEnableAudio: { value: true },
            u_gpgpu_peelTextureAmount: { value: 0.0 },
            u_gpgpu_peelDrift: { value: 0.0 },
        };

        this.positionVariable.material.uniforms = uniforms;
        this.previousPositionVariable.material.uniforms = uniforms;

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
        const uniforms = this.positionVariable.material.uniforms;

        // ** THE FIX IS HERE: The entire if(isLegacyMode) block has been removed **
        
        // --- GPGPU MODE UNIFORMS ---
        if (S.gpgpu_enableCloth && this.clothEnableTime < 0) {
            this.clothEnableTime = this.app.currentTime;
        } else if (!S.gpgpu_enableCloth) {
            this.clothEnableTime = -1;
        }

        let blendFactor = 0.0;
        if (this.clothEnableTime > 0) {
            const elapsedTime = this.app.currentTime - this.clothEnableTime;
            const blendDuration = S.gpgpu_clothBlendTime > 0 ? S.gpgpu_clothBlendTime : 0.01;
            blendFactor = Math.min(elapsedTime / blendDuration, 1.0);
        }
        uniforms.u_gpgpu_clothBlendFactor.value = blendFactor;

        uniforms.u_gpgpu_enableWaterRipple.value = S.gpgpu_enableWaterRipple;
        uniforms.u_gpgpu_rippleSpeed.value = S.gpgpu_rippleSpeed;
        uniforms.u_gpgpu_rippleStrength.value = S.gpgpu_rippleStrength;
        uniforms.u_gpgpu_rippleFrequency.value = S.gpgpu_rippleFrequency;
        uniforms.u_gpgpu_enableEqRipple.value = S.gpgpu_enableEqRipple;
        uniforms.u_gpgpu_eqRippleStrength.value = S.gpgpu_eqRippleStrength;
        const styleMap = { 'Left': 0, 'Center': 1, 'Full': 2 };
        uniforms.u_gpgpu_eqRippleStyle.value = styleMap[S.gpgpu_eqRippleStyle] || 0;
        uniforms.u_gpgpu_eqRippleBarCount.value = S.gpgpu_eqRippleBarCount;
        uniforms.u_gpgpu_eqRippleBarWidth.value = S.gpgpu_eqRippleBarWidth;
        uniforms.u_gpgpu_eqRippleRangeStart.value = S.gpgpu_eqRippleRangeStart;
        uniforms.u_gpgpu_eqRippleRangeEnd.value = S.gpgpu_eqRippleRangeEnd;
        uniforms.u_gpgpu_enableCloth.value = S.gpgpu_enableCloth;
        uniforms.u_gpgpu_clothDamping.value = S.gpgpu_clothDamping;
        uniforms.u_gpgpu_clothStiffness.value = S.gpgpu_clothStiffness;
        uniforms.u_gpgpu_clothAudioForce.value = S.gpgpu_clothAudioForce;
        uniforms.u_gpgpu_clothForceRadius.value = S.gpgpu_clothForceRadius;
        uniforms.gpgpu_clothIterations.value = S.gpgpu_clothIterations;
        const pinModeMap = { 'none': 0, 'corners': 1, 'top_edge': 2, 'center': 3 };
        uniforms.gpgpu_clothPinMode.value = pinModeMap[S.gpgpu_clothPinMode] || 0;
        uniforms.u_gpgpu_tetherStrength.value = S.gpgpu_tetherStrength;
        uniforms.u_gpgpu_ambientWindStrength.value = S.gpgpu_ambientWindStrength;
        uniforms.u_gpgpu_ambientWindSpeed.value = S.gpgpu_ambientWindSpeed;
        uniforms.u_gpgpu_ambientWindScale.value = S.gpgpu_ambientWindScale;
        uniforms.u_gpgpu_directionalWind.value.set(S.gpgpu_directionalWindX, S.gpgpu_directionalWindY, S.gpgpu_directionalWindZ);

        uniforms.u_gpgpu_enableFold.value = S.gpgpu_enableFold;
        uniforms.u_gpgpu_foldAngle.value = S.gpgpu_foldAngle * (Math.PI / 180.0);
        uniforms.u_gpgpu_foldDepth.value = S.gpgpu_foldDepth;
        uniforms.u_gpgpu_foldRoundness.value = S.gpgpu_foldRoundness;
        uniforms.u_gpgpu_foldAudioMod.value = S.gpgpu_foldAudioMod * (Math.PI / 180.0);
        uniforms.u_gpgpu_foldNudge.value = S.gpgpu_foldNudge;
        uniforms.u_gpgpu_enableFoldCrease.value = S.gpgpu_enableFoldCrease;
        uniforms.u_gpgpu_foldCreaseDepth.value = S.gpgpu_foldCreaseDepth;
        uniforms.u_gpgpu_foldCreaseSharpness.value = S.gpgpu_foldCreaseSharpness;
        uniforms.u_gpgpu_enableFoldTuck.value = S.gpgpu_enableFoldTuck;
        uniforms.u_gpgpu_foldTuckAmount.value = S.gpgpu_foldTuckAmount;
        uniforms.u_gpgpu_foldTuckReach.value = S.gpgpu_foldTuckReach;

        uniforms.u_gpgpu_enableCylinder.value = S.gpgpu_enableCylinder;
        uniforms.u_gpgpu_cylinderRadius.value = S.gpgpu_cylinderRadius;
        uniforms.u_gpgpu_cylinderHeightScale.value = S.gpgpu_cylinderHeightScale;
        const cylAxisMapGpgpu = { 'y': 0, 'x': 1, 'z': 2 };
        uniforms.u_gpgpu_cylinderAxisAlignment.value = cylAxisMapGpgpu[S.gpgpu_cylinderAxisAlignment] || 0;
        uniforms.u_gpgpu_cylinderArcAngle.value = S.gpgpu_cylinderArcAngle * (Math.PI / 180.0);
        uniforms.u_gpgpu_cylinderArcOffset.value = S.gpgpu_cylinderArcOffset * (Math.PI / 180.0);

        uniforms.u_gpgpu_enableSag.value = S.gpgpu_enableSag;
        uniforms.u_gpgpu_sagAmount.value = S.gpgpu_sagAmount;
        uniforms.u_gpgpu_sagFalloffSharpness.value = S.gpgpu_sagFalloffSharpness;
        uniforms.u_gpgpu_sagAudioMod.value = S.gpgpu_sagAudioMod;
        uniforms.u_gpgpu_enableDroop.value = S.gpgpu_enableDroop;
        uniforms.u_gpgpu_droopAmount.value = S.gpgpu_droopAmount;
        uniforms.u_gpgpu_droopAudioMod.value = S.gpgpu_droopAudioMod;
        uniforms.u_gpgpu_droopFalloffSharpness.value = S.gpgpu_droopFalloffSharpness;
        uniforms.u_gpgpu_droopSupportedWidthFactor.value = S.gpgpu_droopSupportedWidthFactor;
        uniforms.u_gpgpu_droopSupportedDepthFactor.value = S.gpgpu_droopSupportedDepthFactor;
        
        uniforms.u_gpgpu_enablePeel.value = S.gpgpu_enablePeel;
        uniforms.u_gpgpu_peelAmount.value = S.gpgpu_peelAmount;
        uniforms.u_gpgpu_peelCurl.value = S.gpgpu_peelCurl;
        uniforms.u_gpgpu_peelEnableAudio.value = S.gpgpu_peelEnableAudio;
        uniforms.u_gpgpu_peelTextureAmount.value = S.gpgpu_peelTextureAmount;
        uniforms.u_gpgpu_peelDrift.value = S.gpgpu_peelDrift;
        

        // --- GLOBAL UNIFORMS (always updated) ---
        uniforms.u_time.value = this.app.currentTime;
        uniforms.u_delta.value = delta;
        uniforms.u_audioLow.value = A.energy.low;
        if (A.audioTexture) { 
            uniforms.u_audioTexture.value = A.audioTexture;
        }
        
        this.gpuCompute.compute();
    },

    // ** THE FIX IS HERE: All legacy uniform declarations have been removed **
    uniformsShaderCode: `
        #define texturePosition texturePosition 
        #define texturePreviousPosition texturePreviousPosition
        
        uniform sampler2D u_initialPosition;
        uniform float u_time;
        uniform float u_delta;
        uniform float u_audioLow;
        uniform sampler2D u_audioTexture; 
        uniform vec2 u_planeDimensions;

        uniform bool u_gpgpu_enableWaterRipple;
        uniform float u_gpgpu_rippleSpeed;
        uniform float u_gpgpu_rippleStrength;
        uniform float u_gpgpu_rippleFrequency;
        uniform bool u_gpgpu_enableEqRipple; 
        uniform float u_gpgpu_eqRippleStrength;
        uniform int u_gpgpu_eqRippleStyle;
        uniform float u_gpgpu_eqRippleBarCount;
        uniform float u_gpgpu_eqRippleBarWidth;
        uniform float u_gpgpu_eqRippleRangeStart;
        uniform float u_gpgpu_eqRippleRangeEnd;
        uniform bool u_gpgpu_enableCloth;
        uniform float u_gpgpu_clothDamping;
        uniform float u_gpgpu_clothStiffness;
        uniform float u_gpgpu_clothAudioForce;
        uniform float u_gpgpu_clothForceRadius;
        uniform int gpgpu_clothIterations;
        uniform int gpgpu_clothPinMode;
        uniform float u_gpgpu_tetherStrength;
        uniform float u_gpgpu_ambientWindStrength;
        uniform float u_gpgpu_ambientWindSpeed;
        uniform float u_gpgpu_ambientWindScale;
        uniform vec3 u_gpgpu_directionalWind;
        uniform float u_gpgpu_clothBlendTime;
        uniform float u_gpgpu_clothBlendFactor;
        
        uniform bool u_gpgpu_enableFold;
        uniform float u_gpgpu_foldAngle;
        uniform float u_gpgpu_foldDepth;
        uniform float u_gpgpu_foldRoundness;
        uniform float u_gpgpu_foldAudioMod;
        uniform float u_gpgpu_foldNudge;
        uniform bool u_gpgpu_enableFoldCrease;
        uniform float u_gpgpu_foldCreaseDepth;
        uniform float u_gpgpu_foldCreaseSharpness;
        uniform bool u_gpgpu_enableFoldTuck;
        uniform float u_gpgpu_foldTuckAmount;
        uniform float u_gpgpu_foldTuckReach;

        uniform bool u_gpgpu_enableCylinder;
        uniform float u_gpgpu_cylinderRadius;
        uniform float u_gpgpu_cylinderHeightScale;
        uniform int u_gpgpu_cylinderAxisAlignment;
        uniform float u_gpgpu_cylinderArcAngle;
        uniform float u_gpgpu_cylinderArcOffset;

        uniform bool u_gpgpu_enableSag;
        uniform float u_gpgpu_sagAmount;
        uniform float u_gpgpu_sagFalloffSharpness;
        uniform float u_gpgpu_sagAudioMod;
        uniform bool u_gpgpu_enableDroop;
        uniform float u_gpgpu_droopAmount;
        uniform float u_gpgpu_droopAudioMod;
        uniform float u_gpgpu_droopFalloffSharpness;
        uniform float u_gpgpu_droopSupportedWidthFactor;
        uniform float u_gpgpu_droopSupportedDepthFactor;

        uniform bool u_gpgpu_enablePeel;
        uniform float u_gpgpu_peelAmount;
        uniform float u_gpgpu_peelCurl;
        uniform bool u_gpgpu_peelEnableAudio;
        uniform float u_gpgpu_peelTextureAmount;
        uniform float u_gpgpu_peelDrift;
    `,

    commonShaderCode: `
        const float PI = 3.14159265359;
        const float EPSILON_SHADER = 1e-6;
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

        float snoise(vec3 v) {
            const vec2 C = vec2(1.0/6.0, 1.0/3.0) ;
            const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
            vec3 i  = floor(v + dot(v, C.yyy) );
            vec3 x0 = v - i + dot(i, C.xxx) ;
            vec3 g = step(x0.yzx, x0.xyz);
            vec3 l = 1.0 - g;
            vec3 i1 = min( g.xyz, l.zxy );
            vec3 i2 = max( g.xyz, l.zxy );
            vec3 x1 = x0 - i1 + C.xxx;
            vec3 x2 = x0 - i2 + C.yyy;
            vec3 x3 = x0 - D.yyy;
            i = mod289(i);
            vec4 p = permute( permute( permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
                + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
            float n_ = 0.142857142857;
            vec3 ns = n_ * D.wyz - D.xzx;
            vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
            vec4 x_ = floor(j * ns.z);
            vec4 y_ = floor(j - 7.0 * x_ );
            vec4 x = x_ *ns.x + ns.yyyy;
            vec4 y = y_ *ns.x + ns.yyyy;
            vec4 h = 1.0 - abs(x) - abs(y);
            vec4 b0 = vec4( x.xy, y.xy );
            vec4 b1 = vec4( x.zw, y.zw );
            vec4 s0 = floor(b0)*2.0 + 1.0;
            vec4 s1 = floor(b1)*2.0 + 1.0;
            vec4 sh = -step(h, vec4(0.0));
            vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
            vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
            vec3 p0 = vec3(a0.xy,h.x);
            vec3 p1 = vec3(a0.zw,h.y);
            vec3 p2 = vec3(a1.xy,h.z);
            vec3 p3 = vec3(a1.zw,h.w);
            vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
            p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
            vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
            m = m * m;
            return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
        }
        
        vec2 safeNormalize(vec2 v) { float l = length(v); return (l > EPSILON_SHADER) ? v / l : vec2(0.0); }
        mat3 rotationMatrix3(vec3 axis, float angle){axis=normalize(axis);float s=sin(angle);float c=cos(angle);float oc=1.0-c;return mat3(oc*axis.x*axis.x+c,oc*axis.x*axis.y-axis.z*s,oc*axis.z*axis.x+axis.y*s,oc*axis.x*axis.y+axis.z*s,oc*axis.y*axis.y+c,oc*axis.y*axis.z-axis.x*s,oc*axis.z*axis.x-axis.y*s,oc*axis.y*axis.z+axis.x*s,oc*axis.z*axis.z+c);}
        vec3 getDisplacementNormal() { return vec3(0.0, 0.0, 1.0); }
        
        vec3 calculateEqRipple(vec2 uv, sampler2D audioTex, float strength, int style, float barCount, float barWidth, float rangeStart, float rangeEnd) { 
            float rangeWidth = rangeEnd - rangeStart; 
            if (rangeWidth <= 0.0) return vec3(0.0);

            float remappedUvX;
            if (style == 1) { // Center
                remappedUvX = abs(uv.x - 0.5) * 2.0;
            } else if (style == 2) { // Full
                remappedUvX = uv.x;
            } else { // Left (Default)
                remappedUvX = uv.x;
                rangeWidth *= 0.5;
            }

            if (remappedUvX < rangeStart || remappedUvX > rangeEnd) return vec3(0.0);
            
            float finalUvX = (remappedUvX - rangeStart) / rangeWidth;

            float barIndexFloat = finalUvX * barCount; 
            float barIndexInt = floor(barIndexFloat); 
            float texelCoordX = (barIndexInt + 0.5) / barCount; 
            float audioValue = texture2D(audioTex, vec2(texelCoordX, 0.5)).r; 
            float barProgress = fract(barIndexFloat); 
            float halfBarW = barWidth * 0.5; 
            float window = step(0.5 - halfBarW, barProgress) - step(0.5 + halfBarW, barProgress); 
            float displacement = audioValue * strength * window; 
            return getDisplacementNormal() * displacement; 
        }

        vec3 calculateWaterRipple(vec2 uv, float time, float audio, float speed, float strength, float frequency) { float dist = distance(uv, vec2(0.5)); float ripple = sin(dist * frequency - time * speed) * (1.0 - dist); float audio_factor = 1.0 + audio * 2.0; return getDisplacementNormal() * ripple * strength * audio_factor; }
        vec3 calculatePeel(vec2 uv, float time, float audio, float peelAmount, float curl, float drift, float textureAmount) { vec2 centeredUv = uv - 0.5; float cornerStrength = pow(length(centeredUv) * 1.414, 4.0); float time_offset = 0.0;  float peelAnimation = (sin(time * 0.5 + time_offset) + 1.0) * 0.5; float totalAmount = peelAmount * peelAnimation * (1.0 + audio * 3.0); float displacement = cornerStrength * totalAmount * 10.0; displacement += snoise(vec3(uv * 20.0, time * 0.1)) * textureAmount * displacement; float drift_animation = sin(time * 0.2 + time_offset) * drift; float final_curl = curl + drift_animation; vec2 offset_2d = safeNormalize(centeredUv) * -1.0 * displacement * final_curl; vec3 displacement_vec = getDisplacementNormal() * displacement; displacement_vec.xy += offset_2d; return displacement_vec; }
        vec3 calculateSag(vec2 uv, float audio, float sagAmount, float falloffSharpness, float audioMod) { vec2 uv_centered = uv - 0.5; float dist_from_center = length(uv_centered) / 0.7071; dist_from_center = clamp(dist_from_center, 0.0, 1.0); float sag_mask = 1.0 - pow(dist_from_center, falloffSharpness); float total_sag_amount = sagAmount * (1.0 + audio * audioMod); float sag_displacement = total_sag_amount * sag_mask; return getDisplacementNormal() * -sag_displacement; }
        vec3 calculateDroop(vec2 uv, float audio, float droopAmount, float audioMod, float falloffSharpness, float supportedWidthFactor, float supportedDepthFactor) { vec2 centered_uv = uv - 0.5; float supported_half_w = supportedWidthFactor * 0.5; float supported_half_h = supportedDepthFactor * 0.5; float dist_outside_w = max(0.0, abs(centered_uv.x) - supported_half_w); float dist_outside_h = max(0.0, abs(centered_uv.y) - supported_half_h); float unsupported_range_w = 0.5 - supported_half_w; float unsupported_range_h = 0.5 - supported_half_h; float normalized_dist_w = (unsupported_range_w > EPSILON_SHADER) ? dist_outside_w / unsupported_range_w : 0.0; float normalized_dist_h = (unsupported_range_h > EPSILON_SHADER) ? dist_outside_h / unsupported_range_h : 0.0; float droop_factor_w = 1.0 - (1.0 - normalized_dist_w) * (1.0 - normalized_dist_w); float droop_factor_h = 1.0 - (1.0 - normalized_dist_h) * (1.0 - normalized_dist_h); float combined_droop_factor = max(droop_factor_w, droop_factor_h); float final_droop_mask = pow(combined_droop_factor, falloffSharpness); float total_droop_amount = droopAmount * (1.0 + audio * audioMod); float droop_displacement = total_droop_amount * final_droop_mask; return getDisplacementNormal() * -droop_displacement; }
        vec3 calculateCylinder(vec2 uv, float audio, vec2 planeDimensions, float cylinderRadius, float cylinderHeightScale, int cylinderAxisAlignment, float cylinderArcAngle, float cylinderArcOffset, float deformationStrength) { float angle = -(cylinderArcOffset + uv.x * cylinderArcAngle); float length_coord = (uv.y - 0.5) * planeDimensions.y * cylinderHeightScale; vec3 p; vec3 normal_dir; if (cylinderAxisAlignment == 1) { p = vec3(length_coord, cos(angle) * cylinderRadius, sin(angle) * cylinderRadius); normal_dir = normalize(vec3(0.0, p.y, p.z)); }  else if (cylinderAxisAlignment == 2) { p = vec3(cos(angle) * cylinderRadius, sin(angle) * cylinderRadius, length_coord); normal_dir = normalize(vec3(p.x, p.y, 0.0)); }  else { p = vec3(cos(angle) * cylinderRadius, length_coord, sin(angle) * cylinderRadius); normal_dir = normalize(vec3(p.x, 0.0, p.z)); } p += normal_dir * audio * deformationStrength; return p; }
        vec3 calculateBend(vec3 p, vec2 uv, float audio, vec2 planeSize, float bendAngle, float bendAudioMod, float bendFalloffSharpness, int bendAxis) { float falloff_coord = (bendAxis == 0) ? abs(uv.y - 0.5) * 2.0 : abs(uv.x - 0.5) * 2.0; float falloff_multiplier = pow(falloff_coord, bendFalloffSharpness); float total_bend_angle = bendAngle * (1.0 + audio * bendAudioMod) * falloff_multiplier; if (abs(total_bend_angle) < EPSILON_SHADER) { return p; } vec3 segment_axis = (bendAxis == 0) ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0); float segment_extent = (bendAxis == 0) ? planeSize.y : planeSize.x; vec3 bend_axis_dir = normalize(cross(getDisplacementNormal(), segment_axis)); float half_extent = segment_extent * 0.5; float bend_radius = half_extent / max(EPSILON_SHADER, abs(sin(total_bend_angle * 0.5))); float segment_val = dot(p, segment_axis); float angle_on_arc = (segment_val / max(EPSILON_SHADER, half_extent)) * (total_bend_angle * 0.5); vec3 bent_position = bend_axis_dir * dot(p, bend_axis_dir); bent_position += segment_axis * (sin(angle_on_arc) * bend_radius); bent_position += getDisplacementNormal() * ((cos(angle_on_arc) - 1.0) * bend_radius * -sign(total_bend_angle)); return bent_position; }
        vec3 calculateFold(vec3 flat_pos, vec2 uv_param, float audio, vec2 planeSize, float foldAngle, float foldDepth, float foldRoundness, float foldAudioMod, float foldNudge, bool enableFoldCrease, float foldCreaseDepth, float foldCreaseSharpness, bool enableFoldTuck, float foldTuckAmount, float foldTuckReach, float deformationStrength) { vec2 local_uv; int corner_index; if(uv_param.x<0.5&&uv_param.y<0.5){local_uv=uv_param;corner_index=0;}else if(uv_param.x>0.5&&uv_param.y<0.5){local_uv=vec2(1.0-uv_param.x,uv_param.y);corner_index=1;}else if(uv_param.x<0.5&&uv_param.y>0.5){local_uv=vec2(uv_param.x,1.0-uv_param.y);corner_index=2;}else{local_uv=vec2(1.0-uv_param.x,1.0-uv_param.y);corner_index=3;} vec3 axis_U = vec3(1.0, 0.0, 0.0); vec3 axis_V = vec3(0.0, 1.0, 0.0); vec3 axis_W = getDisplacementNormal(); float uv_sum_diag=local_uv.x+local_uv.y; if(uv_sum_diag>=foldDepth+foldRoundness+EPSILON_SHADER){return flat_pos + axis_W * audio * deformationStrength;} float arm_U=foldDepth*planeSize.x;float arm_V=foldDepth*planeSize.y; vec3 corner_sign=(corner_index==0)?vec3(-1,-1,1):(corner_index==1)?vec3(1,-1,-1):(corner_index==2)?vec3(-1,1,-1):vec3(1,1,1); vec3 hinge_start=corner_sign.x*axis_U*(planeSize.x*0.5-arm_U)+corner_sign.y*axis_V*(planeSize.y*0.5); vec3 hinge_end=corner_sign.x*axis_U*(planeSize.x*0.5)+corner_sign.y*axis_V*(planeSize.y*0.5-arm_V); vec3 hinge_axis=normalize(hinge_end-hinge_start); float main_fold_angle=(-foldAngle+foldAudioMod*audio)*corner_sign.z; float blend_factor=1.0-smoothstep(foldDepth-foldRoundness,foldDepth+foldRoundness,uv_sum_diag); float actual_rotation_angle=main_fold_angle*blend_factor; mat3 R = rotationMatrix3(hinge_axis, actual_rotation_angle); vec3 folded_pos = hinge_start + R * (flat_pos - hinge_start); vec3 transformed_normal = R * axis_W; if(abs(foldNudge)>0.001){float progress_along_hinge=clamp(dot(flat_pos-hinge_start,hinge_axis)/length(hinge_end-hinge_start),0.0,1.0);float arch_factor=sin(progress_along_hinge*PI);folded_pos+=transformed_normal*foldNudge*arch_factor*blend_factor;} if(enableFoldTuck){float tuck_falloff=1.0-smoothstep(0.0,foldTuckReach,length(local_uv));if(tuck_falloff>0.0){vec3 outward_vector=normalize(corner_sign.x*axis_U+corner_sign.y*axis_V);float tuck_strength=foldTuckAmount*-0.5;folded_pos+=outward_vector*tuck_strength*tuck_falloff*blend_factor;}} if(enableFoldCrease){float dist_from_diag=abs(local_uv.x-local_uv.y)/1.4142;float crease_mask=1.0-smoothstep(0.0,foldDepth*0.5,dist_from_diag);crease_mask=pow(crease_mask,foldCreaseSharpness*0.5);folded_pos+=transformed_normal*foldCreaseDepth*crease_mask*blend_factor;} folded_pos+=transformed_normal*audio*deformationStrength; return folded_pos; }
        void satisfyConstraints(inout vec3 p, vec2 uv, float stiffness, float restLength) { vec2 texelSize = 1.0 / resolution.xy; vec3 pRight = texture2D(texturePosition, uv + vec2(texelSize.x, 0.0)).xyz; vec3 delta = pRight - p; float deltaLength = length(delta); if (deltaLength > 0.0) { float diff = (deltaLength - restLength) / deltaLength; p += delta * 0.5 * stiffness * diff; } vec3 pLeft = texture2D(texturePosition, uv - vec2(texelSize.x, 0.0)).xyz; delta = pLeft - p; deltaLength = length(delta); if (deltaLength > 0.0) { float diff = (deltaLength - restLength) / deltaLength; p += delta * 0.5 * stiffness * diff; } vec3 pUp = texture2D(texturePosition, uv + vec2(0.0, texelSize.y)).xyz; vec3 deltaUp = pUp - p; float deltaLengthUp = length(deltaUp); if (deltaLengthUp > 0.0) { float diffUp = (deltaLengthUp - restLength) / deltaLengthUp; p += deltaUp * 0.5 * stiffness * diffUp; } vec3 pDown = texture2D(texturePosition, uv - vec2(0.0, texelSize.y)).xyz; vec3 deltaDown = pDown - p; float deltaLengthDown = length(deltaDown); if (deltaLengthDown > 0.0) { float diffDown = (deltaLengthDown - restLength) / deltaLengthDown; p += deltaDown * 0.5 * stiffness * diffDown; } }
    `,

    get copyShader() { return `
        void main() {
            vec2 uv = gl_FragCoord.xy / resolution.xy;
            gl_FragColor = texture2D(texturePosition, uv);
        }
    `},

    get positionShader() { return `
        ${this.uniformsShaderCode}
        ${this.commonShaderCode}

        void main() {
            vec2 uv = gl_FragCoord.xy / resolution.xy;
            vec3 finalPos;
            vec3 initialPos = texture2D(u_initialPosition, uv).xyz;

            // ** THE FIX IS HERE: The entire legacy if/else block has been removed **
            // We now operate only in GPGPU mode.

            vec3 gpgpuPos = initialPos;
            vec3 gpgpuDisplacement = vec3(0.0);

            if (u_gpgpu_enableCylinder) {
                    gpgpuPos = calculateCylinder(uv, u_audioLow, u_planeDimensions,
                                            u_gpgpu_cylinderRadius, u_gpgpu_cylinderHeightScale, 
                                            u_gpgpu_cylinderAxisAlignment, u_gpgpu_cylinderArcAngle, 
                                            u_gpgpu_cylinderArcOffset, 0.0);
            }
            
            if (u_gpgpu_enableFold) {
                gpgpuPos = calculateFold(gpgpuPos, uv, u_audioLow, u_planeDimensions, 
                                        u_gpgpu_foldAngle, u_gpgpu_foldDepth, u_gpgpu_foldRoundness, 
                                        u_gpgpu_foldAudioMod, u_gpgpu_foldNudge, u_gpgpu_enableFoldCrease, 
                                        u_gpgpu_foldCreaseDepth, u_gpgpu_foldCreaseSharpness, 
                                        u_gpgpu_enableFoldTuck, u_gpgpu_foldTuckAmount, u_gpgpu_foldTuckReach, 
                                        0.0);
            }

            if (u_gpgpu_enableSag) {
                gpgpuDisplacement += calculateSag(uv, u_audioLow, u_gpgpu_sagAmount, u_gpgpu_sagFalloffSharpness, u_gpgpu_sagAudioMod);
            }
            if (u_gpgpu_enableDroop) {
                gpgpuDisplacement += calculateDroop(uv, u_audioLow, u_gpgpu_droopAmount, u_gpgpu_droopAudioMod, u_gpgpu_droopFalloffSharpness, u_gpgpu_droopSupportedWidthFactor, u_gpgpu_droopSupportedDepthFactor);
            }
            if (u_gpgpu_enableWaterRipple) { gpgpuDisplacement += calculateWaterRipple(uv, u_time, u_audioLow, u_gpgpu_rippleSpeed, u_gpgpu_rippleStrength, u_gpgpu_rippleFrequency); }
            if (u_gpgpu_enableEqRipple) { gpgpuDisplacement += calculateEqRipple(uv, u_audioTexture, u_gpgpu_eqRippleStrength, u_gpgpu_eqRippleStyle, u_gpgpu_eqRippleBarCount, u_gpgpu_eqRippleBarWidth, u_gpgpu_eqRippleRangeStart, u_gpgpu_eqRippleRangeEnd); }
            if (u_gpgpu_enablePeel) {
                float audio = u_gpgpu_peelEnableAudio ? u_audioLow : 0.0;
                gpgpuDisplacement += calculatePeel(uv, u_time, audio, u_gpgpu_peelAmount, u_gpgpu_peelCurl, u_gpgpu_peelDrift, u_gpgpu_peelTextureAmount);
            }

            finalPos = gpgpuPos + gpgpuDisplacement;

            if (u_gpgpu_enableCloth) {
                vec3 currentPos = texture2D(texturePosition, uv).xyz;
                vec3 prevPos = texture2D(texturePreviousPosition, uv).xyz;
                vec3 velocity = (currentPos - prevPos) * u_gpgpu_clothDamping;
                vec3 totalAcceleration = vec3(0.0);
                vec3 noise_coord_1 = vec3(uv * u_gpgpu_ambientWindScale, u_time * u_gpgpu_ambientWindSpeed);
                vec3 noise_coord_2 = vec3(uv * u_gpgpu_ambientWindScale + 150.0, u_time * u_gpgpu_ambientWindSpeed);
                vec3 noise_coord_3 = vec3(uv * u_gpgpu_ambientWindScale + 300.0, u_time * u_gpgpu_ambientWindSpeed);
                vec3 ambientWind = vec3(snoise(noise_coord_1), snoise(noise_coord_2), snoise(noise_coord_3));
                vec3 windForce = (ambientWind * u_gpgpu_ambientWindStrength) + u_gpgpu_directionalWind;
                windForce *= u_gpgpu_clothBlendFactor;
                vec3 windTargetPos = initialPos + windForce;
                totalAcceleration += (windTargetPos - currentPos) * u_gpgpu_tetherStrength;
                float distFromCenter = distance(uv, vec2(0.5));
                if (distFromCenter < u_gpgpu_clothForceRadius) {
                    float falloff = 1.0 - smoothstep(0.0, u_gpgpu_clothForceRadius, distFromCenter);
                    vec3 audioAccel = vec3(0.0, 0.0, 1.0) * u_audioLow * u_gpgpu_clothAudioForce * falloff;
                    totalAcceleration += audioAccel * u_gpgpu_clothBlendFactor;
                }
                finalPos = currentPos + velocity + totalAcceleration * u_delta * u_delta;
                float restLength = u_planeDimensions.x / resolution.x;
                for (int i = 0; i < gpgpu_clothIterations; i++) {
                    satisfyConstraints(finalPos, uv, u_gpgpu_clothStiffness, restLength);
                }
                if (gpgpu_clothPinMode == 1) { if (uv.x < 0.01 && uv.y < 0.01 || uv.x > 0.99 && uv.y < 0.01 || uv.x < 0.01 && uv.y > 0.99 || uv.x > 0.99 && uv.y > 0.99) { finalPos = initialPos; }
                } else if (gpgpu_clothPinMode == 2) { if (uv.y > 0.99) { finalPos = initialPos; }
                } else if (gpgpu_clothPinMode == 3) { if (distance(uv, vec2(0.5)) < 0.05) { finalPos = initialPos; }
                }
            }
            gl_FragColor = vec4(finalPos, 1.0);
        }
    `},
};