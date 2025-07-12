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
        this.normalVariable = this.gpuCompute.addVariable('textureNormal', this.normalShader, this.initialPositionTexture);
        
        this.gpuCompute.setVariableDependencies(this.positionVariable, []); 
        this.gpuCompute.setVariableDependencies(this.normalVariable, [this.positionVariable]);
        
        const planeDimensionsVec2 = new THREE.Vector2(planeWidth, planeHeight);
        
        const uniforms = {
            u_initialPosition: { value: this.initialPositionTexture },
            u_time: { value: 0 },
            u_audioLow: { value: 0 },
            u_audioTexture: { value: this.app.AudioProcessor.audioTexture }, 
            u_planeDimensions: { value: planeDimensionsVec2 },
            u_isLegacyMode: { value: true },
            u_enableAudioDeform: { value: true },
            u_deformationStrength: { value: 0.0 },
            u_enablePeel: { value: 0.0 },
            u_peelAmount: { value: 0.0 },
            u_peelCurl: { value: 0.0 },
            u_peelEnableAudio: { value: true },
            u_peelTextureAmount: { value: 0.0 },
            u_peelDrift: { value: 0.0 },
            u_peelAudio: { value: 0.0 },
            u_warpMode: { value: 0 },
            u_sagAmount: { value: 0.0 },
            u_sagFalloffSharpness: { value: 0.0 },
            u_sagAudioMod: { value: 0.0 },
            u_droopAmount: { value: 0.0 },
            u_droopAudioMod: { value: 0.0 },
            u_droopFalloffSharpness: { value: 0.0 },
            u_droopSupportedWidthFactor: { value: 0.0 },
            u_droopSupportedDepthFactor: { value: 0.0 },
            u_cylinderRadius: { value: 0.0 },
            u_cylinderHeightScale: { value: 0.0 },
            u_cylinderAxisAlignment: { value: 0 },
            u_cylinderArcAngle: { value: 0.0 },
            u_cylinderArcOffset: { value: 0.0 },
            u_bendAngle: { value: 0.0 },
            u_bendAudioMod: { value: 0.0 },
            u_bendFalloffSharpness: { value: 0.0 },
            u_bendAxis: { value: 0 },
            u_foldAngle: { value: 0.0 },
            u_foldDepth: { value: 0.0 },
            u_foldRoundness: { value: 0.0 },
            u_foldAudioMod: { value: 0.0 },
            u_foldNudge: { value: 0.0 },
            u_enableFoldCrease: { value: false },
            u_foldCreaseDepth: { value: 0.0 },
            u_foldCreaseSharpness: { value: 0.0 },
            u_enableFoldTuck: { value: false },
            u_foldTuckAmount: { value: 0.0 },
            u_foldTuckReach: { value: 0.0 },
            u_gpgpu_enableWaterRipple: { value: false }, // Renamed uniform
            u_gpgpu_rippleSpeed: { value: 0.5 },
            u_gpgpu_rippleStrength: { value: 1.0 },
            u_gpgpu_rippleFrequency: { value: 15.0 },
            u_gpgpu_enableEqRipple: { value: false },
            u_gpgpu_eqRippleStrength: { value: 2.0 },
            u_gpgpu_eqRippleBarCount: { value: 64.0 },
            u_gpgpu_eqRippleBarWidth: { value: 0.8 },
            u_gpgpu_eqRippleRangeStart: { value: 0.0 },
            u_gpgpu_eqRippleRangeEnd: { value: 1.0 },
        };

        this.positionVariable.material.uniforms = uniforms;
        this.normalVariable.material.uniforms = uniforms;

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

        const isLegacyMode = S.deformationEngine === 'legacy';
        uniforms.u_isLegacyMode.value = isLegacyMode;

        if (isLegacyMode) {
            const warpModeMap = { 'none': 0, 'sag': 2, 'droop': 5, 'cylinder': 4, 'bend': 3, 'fold': 1 };
            uniforms.u_warpMode.value = warpModeMap[S.warpMode] || 0;
            
            let peelAudioValue = 0.0;
            if (S.peelEnableAudio) {
                peelAudioValue = A.energy.low;
            }
            
            uniforms.u_enableAudioDeform.value = S.enableAudioDeform;
            uniforms.u_deformationStrength.value = S.deformationStrength;
            uniforms.u_enablePeel.value = S.enablePeel ? 1.0 : 0.0;
            uniforms.u_peelAmount.value = S.peelAmount;
            uniforms.u_peelCurl.value = S.peelCurl;
            uniforms.u_peelEnableAudio.value = S.peelEnableAudio;
            uniforms.u_peelTextureAmount.value = S.peelTextureAmount;
            uniforms.u_peelDrift.value = S.peelDrift;
            uniforms.u_peelAudio.value = peelAudioValue; 
            uniforms.u_sagAmount.value = S.sagAmount;
            uniforms.u_sagFalloffSharpness.value = S.sagFalloffSharpness;
            uniforms.u_sagAudioMod.value = S.sagAudioMod;
            uniforms.u_droopAmount.value = S.droopAmount;
            uniforms.u_droopAudioMod.value = S.droopAudioMod;
            uniforms.u_droopFalloffSharpness.value = S.droopFalloffSharpness;
            uniforms.u_droopSupportedWidthFactor.value = S.droopSupportedWidthFactor;
            uniforms.u_droopSupportedDepthFactor.value = S.droopSupportedDepthFactor;
            uniforms.u_cylinderRadius.value = S.cylinderRadius;
            uniforms.u_cylinderHeightScale.value = S.cylinderHeightScale;
            const cylAxisMap = { 'y': 0, 'x': 1, 'z': 2 };
            uniforms.u_cylinderAxisAlignment.value = cylAxisMap[S.cylinderAxisAlignment] || 0;
            uniforms.u_cylinderArcAngle.value = S.cylinderArcAngle * (Math.PI / 180.0);
            uniforms.u_cylinderArcOffset.value = S.cylinderArcOffset * (Math.PI / 180.0);
            uniforms.u_bendAngle.value = S.bendAngle * (Math.PI / 180.0);
            uniforms.u_bendAudioMod.value = S.bendAudioMod;
            uniforms.u_bendFalloffSharpness.value = S.bendFalloffSharpness;
            uniforms.u_bendAxis.value = S.bendAxis === 'primary' ? 0 : 1;
            uniforms.u_foldAngle.value = S.foldAngle * (Math.PI / 180.0);
            uniforms.u_foldDepth.value = S.foldDepth;
            uniforms.u_foldRoundness.value = S.foldRoundness;
            uniforms.u_foldAudioMod.value = S.foldAudioMod * (Math.PI / 180.0);
            uniforms.u_foldNudge.value = S.foldNudge;
            uniforms.u_enableFoldCrease.value = S.enableFoldCrease;
            uniforms.u_foldCreaseDepth.value = S.foldCreaseDepth;
            uniforms.u_foldCreaseSharpness.value = S.foldCreaseSharpness;
            uniforms.u_enableFoldTuck.value = S.enableFoldTuck;
            uniforms.u_foldTuckAmount.value = S.foldTuckAmount;
            uniforms.u_foldTuckReach.value = S.foldTuckReach;

        } else {
            // --- GPGPU MODE UNIFORMS ---
            uniforms.u_gpgpu_enableWaterRipple.value = S.gpgpu_enableWaterRipple;
            uniforms.u_gpgpu_rippleSpeed.value = S.gpgpu_rippleSpeed;
            uniforms.u_gpgpu_rippleStrength.value = S.gpgpu_rippleStrength;
            uniforms.u_gpgpu_rippleFrequency.value = S.gpgpu_rippleFrequency;
            uniforms.u_gpgpu_enableEqRipple.value = S.gpgpu_enableEqRipple;
            uniforms.u_gpgpu_eqRippleStrength.value = S.gpgpu_eqRippleStrength;
            uniforms.u_gpgpu_eqRippleBarCount.value = S.gpgpu_eqRippleBarCount;
            uniforms.u_gpgpu_eqRippleBarWidth.value = S.gpgpu_eqRippleBarWidth;
            uniforms.u_gpgpu_eqRippleRangeStart.value = S.gpgpu_eqRippleRangeStart;
            uniforms.u_gpgpu_eqRippleRangeEnd.value = S.gpgpu_eqRippleRangeEnd;
        }

        // --- GLOBAL UNIFORMS (always updated) ---
        uniforms.u_time.value = this.app.currentTime;
        uniforms.u_audioLow.value = A.energy.low;
        if (A.audioTexture) { 
            uniforms.u_audioTexture.value = A.audioTexture;
        }
        
        this.gpuCompute.compute();
    },

    uniformsShaderCode: `
        uniform sampler2D u_initialPosition;
        uniform float u_time;
        uniform float u_audioLow;
        uniform sampler2D u_audioTexture; 
        uniform vec2 u_planeDimensions;
        uniform bool u_isLegacyMode;
        uniform bool u_enableAudioDeform;
        uniform float u_deformationStrength;
        uniform float u_enablePeel;
        uniform float u_peelAmount;
        uniform float u_peelCurl;
        uniform bool u_peelEnableAudio;
        uniform float u_peelTextureAmount;
        uniform float u_peelDrift;
        uniform float u_peelAudio;
        uniform int u_warpMode;
        uniform float u_sagAmount;
        uniform float u_sagFalloffSharpness;
        uniform float u_sagAudioMod;
        uniform float u_droopAmount;
        uniform float u_droopAudioMod;
        uniform float u_droopFalloffSharpness;
        uniform float u_droopSupportedWidthFactor;
        uniform float u_droopSupportedDepthFactor;
        uniform float u_cylinderRadius;
        uniform float u_cylinderHeightScale;
        uniform int u_cylinderAxisAlignment;
        uniform float u_cylinderArcAngle;
        uniform float u_cylinderArcOffset;
        uniform float u_bendAngle;
        uniform float u_bendAudioMod;
        uniform float u_bendFalloffSharpness;
        uniform int u_bendAxis;
        uniform float u_foldAngle;
        uniform float u_foldDepth;
        uniform float u_foldRoundness;
        uniform float u_foldAudioMod;
        uniform float u_foldNudge;
        uniform bool u_enableFoldCrease;
        uniform float u_foldCreaseDepth;
        uniform float u_foldCreaseSharpness;
        uniform bool u_enableFoldTuck;
        uniform float u_foldTuckAmount;
        uniform float u_foldTuckReach;
        uniform bool u_gpgpu_enableWaterRipple; // Renamed
        uniform float u_gpgpu_rippleSpeed;
        uniform float u_gpgpu_rippleStrength;
        uniform float u_gpgpu_rippleFrequency;
        uniform bool u_gpgpu_enableEqRipple; 
        uniform float u_gpgpu_eqRippleStrength;
        uniform float u_gpgpu_eqRippleBarCount;
        uniform float u_gpgpu_eqRippleBarWidth;
        uniform float u_gpgpu_eqRippleRangeStart;
        uniform float u_gpgpu_eqRippleRangeEnd;
    `,

    commonShaderCode: `
        const float PI = 3.14159265359;
        const float EPSILON_SHADER = 1e-6;

        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
        float snoise(vec2 v) {
            const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
            vec2 i  = floor(v + dot(v, C.yy) );
            vec2 x0 = v -   i + dot(i, C.xx);
            vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
            vec4 x12 = x0.xyxy + C.xxzz;
            x12.xy -= i1;
            i = mod289(i);
            vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
            vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
            m = m*m; m = m*m;
            vec3 x = 2.0 * fract(p * C.www) - 1.0;
            vec3 h = abs(x) - 0.5;
            vec3 ox = floor(x + 0.5);
            vec3 a0 = x - ox;
            m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
            vec3 g;
            g.x  = a0.x  * x0.x  + h.x  * x0.y;
            g.yz = a0.yz * x12.xz + h.yz * x12.yw;
            return 130.0 * dot(m, g);
        }
        
        vec2 safeNormalize(vec2 v) { float l = length(v); return (l > EPSILON_SHADER) ? v / l : vec2(0.0); }
        mat3 rotationMatrix3(vec3 axis, float angle){axis=normalize(axis);float s=sin(angle);float c=cos(angle);float oc=1.0-c;return mat3(oc*axis.x*axis.x+c,oc*axis.x*axis.y-axis.z*s,oc*axis.z*axis.x+axis.y*s,oc*axis.x*axis.y+axis.z*s,oc*axis.y*axis.y+c,oc*axis.y*axis.z-axis.x*s,oc*axis.z*axis.x-axis.y*s,oc*axis.y*axis.z+axis.x*s,oc*axis.z*axis.z+c);}

        vec3 getDisplacementNormal() {
            return vec3(0.0, 0.0, 1.0);
        }

        vec3 calculateEqRipple(vec2 uv, sampler2D audioTex, float strength, float barCount, float barWidth, float rangeStart, float rangeEnd) {
            float rangeWidth = rangeEnd - rangeStart;
            if (rangeWidth <= EPSILON_SHADER || uv.x < rangeStart || uv.x > rangeEnd) {
                return vec3(0.0);
            }

            float remappedUvX = (uv.x - rangeStart) / rangeWidth;
            
            float barIndexFloat = remappedUvX * barCount;
            float barIndexInt = floor(barIndexFloat);

            float texelCoordX = (barIndexInt + 0.5) / barCount;
            
            float audioValue = texture2D(audioTex, vec2(texelCoordX, 0.5)).r;
            
            float barProgress = fract(barIndexFloat);
            float halfBarW = barWidth * 0.5;
            float window = step(0.5 - halfBarW, barProgress) - step(0.5 + halfBarW, barProgress);

            float displacement = audioValue * strength * window;
            return getDisplacementNormal() * displacement;
        }

        vec3 calculateWaterRipple(vec2 uv, float time, float audio, float speed, float strength, float frequency) {
            float dist = distance(uv, vec2(0.5));
            float ripple = sin(dist * frequency - time * speed) * (1.0 - dist);
            float audio_factor = 1.0 + audio * 2.0;
            return getDisplacementNormal() * ripple * strength * audio_factor;
        }

        vec3 calculatePeel(vec2 uv, float time, float audio, float peelAmount, float peelCurl, float peelDrift, float peelTextureAmount) {
            vec2 centeredUv = uv - 0.5;
            float cornerStrength = pow(length(centeredUv) * 1.414, 4.0);
            float time_offset = 0.0; 
            float peelAnimation = (sin(time * 0.5 + time_offset) + 1.0) * 0.5;
            float totalAmount = peelAmount * peelAnimation * (1.0 + audio * 3.0);
            float displacement = cornerStrength * totalAmount * 10.0;
            displacement += snoise(uv * 20.0 + vec2(time * 0.1, 0.0)) * peelTextureAmount * displacement;
            float drift_animation = sin(time * 0.2 + time_offset) * peelDrift;
            float final_curl = peelCurl + drift_animation;
            vec2 offset_2d = safeNormalize(centeredUv) * -1.0 * displacement * final_curl;
            vec3 displacement_vec = getDisplacementNormal() * displacement;
            displacement_vec.xy += offset_2d;
            return displacement_vec;
        }

        vec3 calculateSag(vec2 uv, float audio, float sagAmount, float sagFalloffSharpness, float sagAudioMod) {
            vec2 uv_centered = uv - 0.5;
            float dist_from_center = length(uv_centered) / 0.7071;
            dist_from_center = clamp(dist_from_center, 0.0, 1.0);
            float sag_mask = 1.0 - pow(dist_from_center, sagFalloffSharpness);
            float total_sag_amount = sagAmount * (1.0 + audio * sagAudioMod);
            float sag_displacement = total_sag_amount * sag_mask;
            return getDisplacementNormal() * -sag_displacement;
        }

        vec3 calculateDroop(vec2 uv, float audio, float droopAmount, float droopAudioMod, float droopFalloffSharpness, float droopSupportedWidthFactor, float droopSupportedDepthFactor) {
            vec2 centered_uv = uv - 0.5;
            float supported_half_w = droopSupportedWidthFactor * 0.5;
            float supported_half_h = droopSupportedDepthFactor * 0.5;
            float dist_outside_w = max(0.0, abs(centered_uv.x) - supported_half_w);
            float dist_outside_h = max(0.0, abs(centered_uv.y) - supported_half_h);
            float unsupported_range_w = 0.5 - supported_half_w;
            float unsupported_range_h = 0.5 - supported_half_h;
            float normalized_dist_w = (unsupported_range_w > EPSILON_SHADER) ? dist_outside_w / unsupported_range_w : 0.0;
            float normalized_dist_h = (unsupported_range_h > EPSILON_SHADER) ? dist_outside_h / unsupported_range_h : 0.0;
            float droop_factor_w = 1.0 - (1.0 - normalized_dist_w) * (1.0 - normalized_dist_w);
            float droop_factor_h = 1.0 - (1.0 - normalized_dist_h) * (1.0 - normalized_dist_h);
            float combined_droop_factor = max(droop_factor_w, droop_factor_h);
            float final_droop_mask = pow(combined_droop_factor, droopFalloffSharpness);
            float total_droop_amount = droopAmount * (1.0 + audio * droopAudioMod);
            float droop_displacement = total_droop_amount * final_droop_mask;
            return getDisplacementNormal() * -droop_displacement;
        }

        vec3 calculateCylinder(vec2 uv, float audio, vec2 planeDimensions, float cylinderRadius, float cylinderHeightScale, int cylinderAxisAlignment, float cylinderArcAngle, float cylinderArcOffset, float deformationStrength) {
            float angle = -(cylinderArcOffset + uv.x * cylinderArcAngle);
            float length_coord = (uv.y - 0.5) * planeDimensions.y * cylinderHeightScale;
            vec3 p;
            vec3 normal_dir;
            if (cylinderAxisAlignment == 1) { p = vec3(length_coord, cos(angle) * cylinderRadius, sin(angle) * cylinderRadius); normal_dir = normalize(vec3(0.0, p.y, p.z)); } 
            else if (cylinderAxisAlignment == 2) { p = vec3(cos(angle) * cylinderRadius, sin(angle) * cylinderRadius, length_coord); normal_dir = normalize(vec3(p.x, p.y, 0.0)); } 
            else { p = vec3(cos(angle) * cylinderRadius, length_coord, sin(angle) * cylinderRadius); normal_dir = normalize(vec3(p.x, 0.0, p.z)); }
            p += normal_dir * audio * deformationStrength;
            return p;
        }

        vec3 calculateBend(vec3 p, vec2 uv, float audio, vec2 planeSize, float bendAngle, float bendAudioMod, float bendFalloffSharpness, int bendAxis) {
            float falloff_coord = (bendAxis == 0) ? abs(uv.y - 0.5) * 2.0 : abs(uv.x - 0.5) * 2.0;
            float falloff_multiplier = pow(falloff_coord, bendFalloffSharpness);
            float total_bend_angle = bendAngle * (1.0 + audio * bendAudioMod) * falloff_multiplier;
            if (abs(total_bend_angle) < EPSILON_SHADER) { return p; }
            vec3 segment_axis = (bendAxis == 0) ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
            float segment_extent = (bendAxis == 0) ? planeSize.y : planeSize.x;
            vec3 bend_axis_dir = normalize(cross(getDisplacementNormal(), segment_axis));
            float half_extent = segment_extent * 0.5;
            float bend_radius = half_extent / max(EPSILON_SHADER, abs(sin(total_bend_angle * 0.5)));
            float segment_val = dot(p, segment_axis);
            float angle_on_arc = (segment_val / max(EPSILON_SHADER, half_extent)) * (total_bend_angle * 0.5);
            vec3 bent_position = bend_axis_dir * dot(p, bend_axis_dir);
            bent_position += segment_axis * (sin(angle_on_arc) * bend_radius);
            bent_position += getDisplacementNormal() * ((cos(angle_on_arc) - 1.0) * bend_radius * -sign(total_bend_angle));
            return bent_position;
        }

        vec3 calculateFold(vec3 flat_pos, vec2 uv_param, float audio, vec2 planeSize, float foldAngle, float foldDepth, float foldRoundness, float foldAudioMod, float foldNudge, bool enableFoldCrease, float foldCreaseDepth, float foldCreaseSharpness, bool enableFoldTuck, float foldTuckAmount, float foldTuckReach, float deformationStrength) {
            vec2 local_uv; int corner_index; 
            if(uv_param.x<0.5&&uv_param.y<0.5){local_uv=uv_param;corner_index=0;}else if(uv_param.x>0.5&&uv_param.y<0.5){local_uv=vec2(1.0-uv_param.x,uv_param.y);corner_index=1;}else if(uv_param.x<0.5&&uv_param.y>0.5){local_uv=vec2(uv_param.x,1.0-uv_param.y);corner_index=2;}else{local_uv=vec2(1.0-uv_param.x,1.0-uv_param.y);corner_index=3;}
            vec3 axis_U = vec3(1.0, 0.0, 0.0);
            vec3 axis_V = vec3(0.0, 1.0, 0.0);
            vec3 axis_W = getDisplacementNormal();
            float uv_sum_diag=local_uv.x+local_uv.y;
            if(uv_sum_diag>=foldDepth+foldRoundness+EPSILON_SHADER){return flat_pos + axis_W * audio * deformationStrength;}
            float arm_U=foldDepth*planeSize.x;float arm_V=foldDepth*planeSize.y;
            vec3 corner_sign=(corner_index==0)?vec3(-1,-1,1):(corner_index==1)?vec3(1,-1,-1):(corner_index==2)?vec3(-1,1,-1):vec3(1,1,1);
            vec3 hinge_start=corner_sign.x*axis_U*(planeSize.x*0.5-arm_U)+corner_sign.y*axis_V*(planeSize.y*0.5);
            vec3 hinge_end=corner_sign.x*axis_U*(planeSize.x*0.5)+corner_sign.y*axis_V*(planeSize.y*0.5-arm_V);
            vec3 hinge_axis=normalize(hinge_end-hinge_start);
            float main_fold_angle=(-foldAngle+foldAudioMod*audio)*corner_sign.z;
            float blend_factor=1.0-smoothstep(foldDepth-foldRoundness,foldDepth+u_foldRoundness,uv_sum_diag);
            float actual_rotation_angle=main_fold_angle*blend_factor;
            mat3 R = rotationMatrix3(hinge_axis, actual_rotation_angle);
            vec3 folded_pos = hinge_start + R * (flat_pos - hinge_start);
            vec3 transformed_normal = R * axis_W;
            if(abs(foldNudge)>0.001){float progress_along_hinge=clamp(dot(flat_pos-hinge_start,hinge_axis)/length(hinge_end-hinge_start),0.0,1.0);float arch_factor=sin(progress_along_hinge*PI);folded_pos+=transformed_normal*foldNudge*arch_factor*blend_factor;}
            if(enableFoldTuck){float tuck_falloff=1.0-smoothstep(0.0,foldTuckReach,length(local_uv));if(tuck_falloff>0.0){vec3 outward_vector=normalize(corner_sign.x*axis_U+corner_sign.y*axis_V);float tuck_strength=foldTuckAmount*-0.5;folded_pos+=outward_vector*tuck_strength*tuck_falloff*blend_factor;}}
            if(enableFoldCrease){float dist_from_diag=abs(local_uv.x-local_uv.y)/1.4142;float crease_mask=1.0-smoothstep(0.0,foldDepth*0.5,dist_from_diag);crease_mask=pow(crease_mask,foldCreaseSharpness*0.5);folded_pos+=transformed_normal*foldCreaseDepth*crease_mask*blend_factor;}
            folded_pos+=transformed_normal*audio*deformationStrength;
            return folded_pos;
        }
    `,

    get positionShader() { return `
        ${this.uniformsShaderCode}
        ${this.commonShaderCode}

        void main() {
            vec2 uv = gl_FragCoord.xy / resolution.xy;
            vec3 pos = texture2D(u_initialPosition, uv).xyz;
            vec3 totalDisplacement = vec3(0.0);

            if (u_isLegacyMode) { // Legacy Mode Branch
                if (u_warpMode > 0) {
                    if (u_warpMode == 1) { 
                        pos = calculateFold(pos, uv, u_audioLow, u_planeDimensions, u_foldAngle, u_foldDepth, u_foldRoundness, u_foldAudioMod, u_foldNudge, u_enableFoldCrease, u_foldCreaseDepth, u_foldCreaseSharpness, u_enableFoldTuck, u_foldTuckAmount, u_foldTuckReach, u_deformationStrength);
                    } else if (u_warpMode == 3) {
                        pos = calculateBend(pos, uv, u_audioLow, u_planeDimensions, u_bendAngle, u_bendAudioMod, u_bendFalloffSharpness, u_bendAxis);
                    } else if (u_warpMode == 4) {
                        pos = calculateCylinder(uv, u_audioLow, u_planeDimensions, u_cylinderRadius, u_cylinderHeightScale, u_cylinderAxisAlignment, u_cylinderArcAngle, u_cylinderArcOffset, u_deformationStrength);
                    } else {
                        if (u_enableAudioDeform) {
                            float noise = snoise(vec2(uv.x * 2.0, u_time * 0.1));
                            float audioDeform = u_audioLow * (1.0 + noise * 0.5);
                            totalDisplacement += getDisplacementNormal() * audioDeform * u_deformationStrength;
                        }
                        if (u_warpMode == 2) {
                            totalDisplacement += calculateSag(uv, u_audioLow, u_sagAmount, u_sagFalloffSharpness, u_sagAudioMod); 
                        } else if (u_warpMode == 5) {
                            totalDisplacement += calculateDroop(uv, u_audioLow, u_droopAmount, u_droopAudioMod, u_droopFalloffSharpness, u_droopSupportedWidthFactor, u_droopSupportedDepthFactor); 
                        }
                    }
                } else { 
                    if (u_enableAudioDeform) {
                        float noise = snoise(vec2(uv.x * 2.0, u_time * 0.1));
                        float audioDeform = u_audioLow * (1.0 + noise * 0.5);
                        totalDisplacement += getDisplacementNormal() * audioDeform * u_deformationStrength;
                    }
                }
                
                if (u_enablePeel > 0.5) {
                    float audio = u_peelEnableAudio ? u_peelAudio : 0.0;
                    totalDisplacement += calculatePeel(uv, u_time, audio, u_peelAmount, u_peelCurl, u_peelDrift, u_peelTextureAmount);
                }
                pos += totalDisplacement;

            } else { // GPGPU Mode Branch
                if (u_gpgpu_enableWaterRipple) {
                    totalDisplacement += calculateWaterRipple(uv, u_time, u_audioLow, u_gpgpu_rippleSpeed, u_gpgpu_rippleStrength, u_gpgpu_rippleFrequency);
                }
                if (u_gpgpu_enableEqRipple) { 
                    totalDisplacement += calculateEqRipple(uv, u_audioTexture, u_gpgpu_eqRippleStrength, u_gpgpu_eqRippleBarCount, u_gpgpu_eqRippleBarWidth, u_gpgpu_eqRippleRangeStart, u_gpgpu_eqRippleRangeEnd);
                }
                pos += totalDisplacement;
            }

            gl_FragColor = vec4(pos, 1.0);
        }
    `},

    get normalShader() { return `
        ${this.uniformsShaderCode}
        ${this.commonShaderCode}
        
        vec3 getDeformedPosition(vec2 uv) {
            vec3 pos = texture2D(u_initialPosition, uv).xyz;
            vec3 totalDisplacement = vec3(0.0);

            if (u_isLegacyMode) { 
                if (u_warpMode > 0) {
                     if (u_warpMode == 1) {
                        pos = calculateFold(pos, uv, u_audioLow, u_planeDimensions, u_foldAngle, u_foldDepth, u_foldRoundness, u_foldAudioMod, u_foldNudge, u_enableFoldCrease, u_foldCreaseDepth, u_foldCreaseSharpness, u_enableFoldTuck, u_foldTuckAmount, u_foldTuckReach, u_deformationStrength);
                    } else if (u_warpMode == 3) {
                        pos = calculateBend(pos, uv, u_audioLow, u_planeDimensions, u_bendAngle, u_bendAudioMod, u_bendFalloffSharpness, u_bendAxis);
                    } else if (u_warpMode == 4) {
                        pos = calculateCylinder(uv, u_audioLow, u_planeDimensions, u_cylinderRadius, u_cylinderHeightScale, u_cylinderAxisAlignment, u_cylinderArcAngle, u_cylinderArcOffset, u_deformationStrength);
                    } else {
                        if (u_enableAudioDeform) {
                            float noise = snoise(vec2(uv.x * 2.0, u_time * 0.1));
                            float audioDeform = u_audioLow * (1.0 + noise * 0.5);
                           totalDisplacement += getDisplacementNormal() * audioDeform * u_deformationStrength;
                        }
                        if (u_warpMode == 2) {
                            totalDisplacement += calculateSag(uv, u_audioLow, u_sagAmount, u_sagFalloffSharpness, u_sagAudioMod); 
                        } else if (u_warpMode == 5) {
                            totalDisplacement += calculateDroop(uv, u_audioLow, u_droopAmount, u_droopAudioMod, u_droopFalloffSharpness, u_droopSupportedWidthFactor, u_droopSupportedDepthFactor); 
                        }
                    }
                } else {
                    if (u_enableAudioDeform) {
                        float noise = snoise(vec2(uv.x * 2.0, u_time * 0.1));
                        float audioDeform = u_audioLow * (1.0 + noise * 0.5);
                        totalDisplacement += getDisplacementNormal() * audioDeform * u_deformationStrength;
                    }
                }
           
                if (u_enablePeel > 0.5) {
                    float audio = u_peelEnableAudio ? u_peelAudio : 0.0;
                    totalDisplacement += calculatePeel(uv, u_time, audio, u_peelAmount, u_peelCurl, u_peelDrift, u_peelTextureAmount);
                }
                pos += totalDisplacement;

            } else { 
                if (u_gpgpu_enableWaterRipple) {
                    totalDisplacement += calculateWaterRipple(uv, u_time, u_audioLow, u_gpgpu_rippleSpeed, u_gpgpu_rippleStrength, u_gpgpu_rippleFrequency);
                }
                if (u_gpgpu_enableEqRipple) { 
                     totalDisplacement += calculateEqRipple(uv, u_audioTexture, u_gpgpu_eqRippleStrength, u_gpgpu_eqRippleBarCount, u_gpgpu_eqRippleBarWidth, u_gpgpu_eqRippleRangeStart, u_gpgpu_eqRippleRangeEnd);
                }
                pos += totalDisplacement;
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
    `}
};