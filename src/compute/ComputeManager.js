import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';
import * as THREE from 'three'; // Explicitly import THREE

export const ComputeManager = {
    app: null, // Main app instance
    gpuCompute: null,
    
    positionVariable: null,
    velocityVariable: null, 
    normalVariable: null,
    paintVariable: null,
    initialPositionTexture: null,

    positionShaderTemplate: '',
    velocityShaderTemplate: '',
    normalShaderTemplate: '',
    paintShaderTemplate: '',
    commonShaderCode: '',
    currentUserCode: '',

    WIDTH: 0,
    HEIGHT: 0,
    
    init(appInstance, planeWidth, planeHeight, planeResX, planeResY) {
        this.app = appInstance;
        this.WIDTH = planeResX;
        this.HEIGHT = planeResY;
        
        const renderer = this.app.renderer;
        if (!renderer.capabilities.isWebGL2) {
            this.app.UIManager.logError("GPGPU Compute requires WebGL2.");
            return false;
        }
        if (renderer.capabilities.floatFragmentTextures === false) {
            this.app.UIManager.logError("No float textures support on this GPU.");
            return false;
        }

        this.loadShaderTemplates();
        
        this.gpuCompute = new GPUComputationRenderer(this.WIDTH, this.HEIGHT, renderer);

        this.recompile(this.app.vizSettings.fxLabCodeEditor); 

        return true;
    },
    
    recompile(userCode = '') {
        console.log("ComputeManager: (Re)compiling shaders...");
        this.currentUserCode = userCode;

        if (!this.gpuCompute) {
            console.error("GPGPU renderer not initialized. Cannot recompile.");
            this.gpuCompute = new GPUComputationRenderer(this.WIDTH, this.HEIGHT, this.app.renderer);
        }
        
        let finalUserCode = userCode.trim();
        if (finalUserCode.length === 0) {
            finalUserCode = `
                vec3 userDeformation(vec3 initialPos, vec2 uv, float time, sampler2D audioTexture) {
                    return initialPos;
                }
            `;
        }

        const planeArea = this.WIDTH * this.HEIGHT;
        const initialPositionData = new Float32Array(planeArea * 4);
        const initialVelocityData = new Float32Array(planeArea * 4);
        const initialPaintData = new Float32Array(planeArea * 4);
        
        const halfWidth = this.app.ImagePlaneManager.planeDimensions.x / 2;
        const halfHeight = this.app.ImagePlaneManager.planeDimensions.y / 2;

        for (let i = 0; i < this.HEIGHT; i++) {
            for (let j = 0; j < this.WIDTH; j++) {
                const index = (i * this.WIDTH + j);
                const x = (j / (this.WIDTH - 1)) * this.app.ImagePlaneManager.planeDimensions.x - halfWidth;
                const y = (i / (this.HEIGHT - 1)) * this.app.ImagePlaneManager.planeDimensions.y - halfHeight;
                initialPositionData[index * 4 + 0] = x;
                initialPositionData[index * 4 + 1] = y;
                initialPositionData[index * 4 + 2] = 0.0;
                initialPositionData[index * 4 + 3] = 1.0; 
            }
        }

        this.initialPositionTexture = new THREE.DataTexture(initialPositionData, this.WIDTH, this.HEIGHT, THREE.RGBAFormat, THREE.FloatType);
        this.initialPositionTexture.needsUpdate = true;
        
        const initialVelocityTexture = new THREE.DataTexture(initialVelocityData, this.WIDTH, this.HEIGHT, THREE.RGBAFormat, THREE.FloatType);
        initialVelocityTexture.needsUpdate = true;
        
        const initialPaintTexture = new THREE.DataTexture(initialPaintData, this.WIDTH, this.HEIGHT, THREE.RGBAFormat, THREE.FloatType);
        initialPaintTexture.needsUpdate = true;
        
        const finalCommonCode = this.commonShaderCode.replace('// USER_CODE_INJECTION_POINT', finalUserCode);
        
        if (this.gpuCompute.variables) {
            this.gpuCompute.variables.forEach(variable => {
                if (variable.renderTargets) {
                    variable.renderTargets.forEach(rt => rt.dispose());
                }
            });
            this.gpuCompute.variables.length = 0;
        }

        this.positionVariable = this.gpuCompute.addVariable('texturePosition', this.positionShaderTemplate, this.initialPositionTexture);
        this.velocityVariable = this.gpuCompute.addVariable('textureVelocity', this.velocityShaderTemplate, initialVelocityTexture);
        this.paintVariable = this.gpuCompute.addVariable('texturePaint', this.paintShaderTemplate, initialPaintTexture);
        this.normalVariable = this.gpuCompute.addVariable('textureNormal', this.normalShaderTemplate, this.initialPositionTexture);
        
        this.positionVariable.material.fragmentShader = finalCommonCode + this.positionShaderTemplate;
        this.normalVariable.material.fragmentShader = finalCommonCode + this.normalShaderTemplate;
        this.paintVariable.material.fragmentShader = finalCommonCode + this.paintShaderTemplate;
        this.velocityVariable.material.fragmentShader = finalCommonCode + this.velocityShaderTemplate;

        this.gpuCompute.setVariableDependencies(this.velocityVariable, [this.positionVariable, this.velocityVariable]);
        this.gpuCompute.setVariableDependencies(this.paintVariable, [this.paintVariable]); 
        this.gpuCompute.setVariableDependencies(this.positionVariable, [this.positionVariable, this.velocityVariable, this.paintVariable]);
        this.gpuCompute.setVariableDependencies(this.normalVariable, [this.positionVariable]);

        const planeDimensionsVec2 = this.app.ImagePlaneManager.planeDimensions.clone();
        
        // ** THE FIX IS HERE (Part 1/2) **
        // Create a SINGLE uniforms object that will be shared by all GPGPU materials.
        const sharedUniforms = {
            u_initialPosition: { value: this.initialPositionTexture },
            u_audioDataTexture: { value: new THREE.DataTexture(new Uint8Array([0]), 1, 1, THREE.RedFormat) }, 
            u_morphSource: { value: 0 },
            u_morphTarget: { value: 0 },
            u_morphMix: { value: 0.0 },
            u_deltaTime: { value: 0.0 },
            u_stiffness: { value: 0.8 },
            u_damping: { value: 0.05 },
            u_gravity: { value: 9.8 },
            u_audioWindStrength: { value: 0.0 },
            u_time: { value: 0 },
            u_audioLow: { value: 0 },
            u_planeDimensions: { value: planeDimensionsVec2 },
            u_deformationStrength: { value: 0.0 },
            u_beat: { value: 0.0 },
            u_paintEnable: { value: false },
            u_paintSplatStrength: { value: 1.0 },
            u_paintFadeSpeed: { value: 0.5 },
            u_userFxActive: { value: userCode.trim().length > 0 },
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
        };
        
        // Assign the SAME uniforms object to each material.
        this.positionVariable.material.uniforms = sharedUniforms;
        this.velocityVariable.material.uniforms = sharedUniforms;
        this.paintVariable.material.uniforms = sharedUniforms;
        this.normalVariable.material.uniforms = sharedUniforms;

        const error = this.gpuCompute.init();
        if (error !== null) {
            this.app.UIManager.logError("FX Lab Shader Compile Error: " + error);
            console.error("GPGPU Recompile Error:", error);
        } else {
            this.app.UIManager.logSuccess("FX Lab Shader Compiled Successfully.");
        }
    },

    update(delta) {
        if (!this.gpuCompute) return;

        const S = this.app.vizSettings;
        const A = this.app.AudioProcessor;
        
        // ** THE FIX IS HERE (Part 2/2) **
        // We only need to get the uniforms object ONCE, because all materials share it.
        const uniforms = this.positionVariable.material.uniforms;
        
        uniforms.u_deltaTime.value = delta;
        
        uniforms.u_stiffness.value = S.clothStiffness;
        uniforms.u_damping.value = S.clothDamping;
        uniforms.u_gravity.value = S.clothGravity;
        uniforms.u_audioWindStrength.value = S.clothAudioWind * A.energy.overall;

        const warpModeMap = { 'none': 0, 'fold': 1, 'sag': 2, 'bend': 3, 'cylinder': 4, 'droop': 5 };
        uniforms.u_warpMode.value = warpModeMap[S.warpMode] || 0;
        
        uniforms.u_time.value = this.app.currentTime;
        uniforms.u_audioLow.value = A.energy.low;
        uniforms.u_deformationStrength.value = S.deformationStrength;
        uniforms.u_beat.value = A.triggers.beat ? 1.0 : 0.0;
        
        uniforms.u_morphSource.value = this.app.ImagePlaneManager.sourceMorphTarget;
        uniforms.u_morphTarget.value = this.app.ImagePlaneManager.targetMorphTarget;
        uniforms.u_morphMix.value = S.morphMix;
        if (A.audioDataTexture) {
            uniforms.u_audioDataTexture.value = A.audioDataTexture;
        }

        uniforms.u_paintEnable.value = S.paintEnable;
        uniforms.u_paintSplatStrength.value = S.paintSplatStrength;
        uniforms.u_paintFadeSpeed.value = S.paintFadeSpeed;

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
        
        this.gpuCompute.compute();
    },
    
    loadShaderTemplates() {
        this.commonShaderCode = `
            const float PI = 3.14159265359;
            const float EPSILON_SHADER = 1e-6;
            uniform bool u_userFxActive;
            mat3 rotationMatrix3(vec3 axis, float angle){axis=normalize(axis);float s=sin(angle);float c=cos(angle);float oc=1.0-c;return mat3(oc*axis.x*axis.x+c,oc*axis.x*axis.y-axis.z*s,oc*axis.z*axis.x+axis.y*s,oc*axis.x*axis.y+axis.z*s,oc*axis.y*axis.y+c,oc*axis.y*axis.z-axis.x*s,oc*axis.z*axis.x-axis.y*s,oc*axis.y*axis.z+axis.x*s,oc*axis.z*axis.z+c);}

            // --- Start of Re-integrated V1 Logic ---
            // Note: These have been adapted to deform an XY plane along its Z axis.
            vec3 calculateCylinder(vec2 uv, vec2 planeDimensions, float cylinderRadius, float cylinderHeightScale, int cylinderAxisAlignment, float cylinderArcAngle, float cylinderArcOffset) {
                float angle = -(cylinderArcOffset + uv.x * cylinderArcAngle);
                float length_coord = (uv.y - 0.5) * planeDimensions.y * cylinderHeightScale;
                vec3 p;
                if (cylinderAxisAlignment == 1) { p = vec3(length_coord, cos(angle) * cylinderRadius, sin(angle) * cylinderRadius); } 
                else if (cylinderAxisAlignment == 2) { p = vec3(cos(angle) * cylinderRadius, sin(angle) * cylinderRadius, length_coord); } 
                else { p = vec3(cos(angle) * cylinderRadius, length_coord, sin(angle) * cylinderRadius); }
                return p;
            }
            vec3 calculateBend(vec3 p, vec2 uv, vec2 planeSize, float bendAngle, float bendFalloffSharpness, int bendAxis) {
                float falloff_coord = (bendAxis == 0) ? abs(uv.y - 0.5) * 2.0 : abs(uv.x - 0.5) * 2.0;
                float falloff_multiplier = pow(falloff_coord, bendFalloffSharpness);
                float total_bend_angle = bendAngle * falloff_multiplier;
                if (abs(total_bend_angle) < EPSILON_SHADER) return p;
                vec3 segment_axis = (bendAxis == 0) ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
                float segment_extent = (bendAxis == 0) ? planeSize.y : planeSize.x;
                vec3 bend_axis_dir = normalize(cross(vec3(0.0, 0.0, 1.0), segment_axis));
                float half_extent = segment_extent * 0.5;
                float bend_radius = half_extent / max(EPSILON_SHADER, abs(sin(total_bend_angle * 0.5)));
                float segment_val = dot(p, segment_axis);
                float angle_on_arc = (segment_val / max(EPSILON_SHADER, half_extent)) * (total_bend_angle * 0.5);
                vec3 bent_position = bend_axis_dir * dot(p, bend_axis_dir);
                bent_position += segment_axis * (sin(angle_on_arc) * bend_radius);
                bent_position += vec3(0.0, 0.0, 1.0) * ((cos(angle_on_arc) - 1.0) * bend_radius * -sign(total_bend_angle));
                return bent_position;
            }
            vec3 calculateSag(vec3 p, vec2 uv, float sagAmount, float sagFalloffSharpness) {
                float dist_from_center = length(uv - 0.5) / 0.7071;
                float sag_mask = 1.0 - pow(dist_from_center, sagFalloffSharpness);
                p.z -= sagAmount * sag_mask;
                return p;
            }
            vec3 calculateDroop(vec3 p, vec2 uv, float droopAmount, float droopFalloffSharpness, float droopSupportedWidthFactor, float droopSupportedDepthFactor) {
                vec2 centered_uv = uv - 0.5;
                float supported_half_w = droopSupportedWidthFactor * 0.5;
                float supported_half_h = droopSupportedDepthFactor * 0.5;
                float dist_outside_w = max(0.0, abs(centered_uv.x) - supported_half_w);
                float dist_outside_h = max(0.0, abs(centered_uv.y) - supported_half_h);
                float unsupported_range_w = 0.5 - supported_half_w;
                float unsupported_range_h = 0.5 - supported_half_h;
                float normalized_dist_w = (unsupported_range_w > EPSILON_SHADER) ? dist_outside_w / unsupported_range_w : 0.0;
                float normalized_dist_h = (unsupported_range_h > EPSILON_SHADER) ? dist_outside_h / unsupported_range_h : 0.0;
                float droop_factor = pow(max(normalized_dist_w, normalized_dist_h), droopFalloffSharpness);
                p.z -= droopAmount * droop_factor;
                return p;
            }
            vec3 calculateFold(vec3 p, vec2 uv, vec2 planeSize, float foldAngle, float foldDepth, float foldRoundness, float foldNudge, bool enableCrease, float creaseDepth, float creaseSharpness, bool enableTuck, float tuckAmount, float tuckReach) {
                vec2 local_uv; int corner_index; if(uv.x<0.5&&uv.y<0.5){local_uv=uv;corner_index=0;}else if(uv.x>0.5&&uv.y<0.5){local_uv=vec2(1.0-uv.x,uv.y);corner_index=1;}else if(uv.x<0.5&&uv.y>0.5){local_uv=vec2(uv.x,1.0-uv.y);corner_index=2;}else{local_uv=vec2(1.0-uv.x,1.0-uv.y);corner_index=3;}
                float uv_sum_diag=local_uv.x+local_uv.y; if(uv_sum_diag>=foldDepth+foldRoundness+EPSILON_SHADER){return p;}
                vec3 axis_U=vec3(1,0,0); vec3 axis_V=vec3(0,1,0); vec3 axis_W=vec3(0,0,1);
                float arm_U=foldDepth*planeSize.x;float arm_V=foldDepth*planeSize.y;
                vec3 corner_sign=(corner_index==0)?vec3(-1,-1,1):(corner_index==1)?vec3(1,-1,-1):(corner_index==2)?vec3(-1,1,-1):vec3(1,1,1);
                vec3 hinge_start=corner_sign.x*axis_U*(planeSize.x*0.5-arm_U)+corner_sign.y*axis_V*(planeSize.y*0.5);
                vec3 hinge_end=corner_sign.x*axis_U*(planeSize.x*0.5)+corner_sign.y*axis_V*(planeSize.y*0.5-arm_V);
                vec3 hinge_axis=normalize(hinge_end-hinge_start);
                float blend_factor=1.0-smoothstep(foldDepth-foldRoundness,foldDepth+foldRoundness,uv_sum_diag);
                float actual_rotation_angle=-foldAngle*corner_sign.z*blend_factor;
                mat3 R_fold=rotationMatrix3(hinge_axis, actual_rotation_angle);
                vec3 folded_pos=hinge_start + R_fold * (p - hinge_start);
                vec3 transformed_normal=R_fold*axis_W;
                if(abs(foldNudge)>0.001){vec3 vec_from_hinge_start=p-hinge_start;float hinge_segment_length=length(hinge_end-hinge_start);float projection=dot(vec_from_hinge_start,hinge_axis);float progress_along_hinge=clamp(projection/hinge_segment_length,0.0,1.0);float arch_factor=sin(progress_along_hinge*PI);folded_pos+=transformed_normal*foldNudge*arch_factor*blend_factor;}
                return folded_pos;
            }
            // --- End of Re-integrated V1 Logic ---

            vec3 getFlatState(vec3 initialPos) { return initialPos; }
            vec3 getSpectralWaveState(vec3 initialPos, vec2 uv, sampler2D audioTexture, float strength) { vec3 pos = initialPos; pos.z += texture2D(audioTexture, vec2(uv.x, 0.0)).r * strength; return pos; }
            vec3 getClothState(vec3 simulatedPos) { return simulatedPos; }
            
            // USER_CODE_INJECTION_POINT

            vec3 calculateTargetState(int mode, vec3 initialPos, vec2 uv, sampler2D audioTexture, float strength, float time, vec3 clothPos) {
                if (mode == 1) { return getSpectralWaveState(initialPos, uv, audioTexture, strength); }
                else if (mode == 2) { return getClothState(clothPos); }
                else if (mode == 4) { return getClothState(clothPos); }
                else if (mode == 3) {
                    if (u_userFxActive) {
                        return userDeformation(initialPos, uv, time, audioTexture);
                    } else {
                        return initialPos;
                    }
                }
                else { return getFlatState(initialPos); }
            }
        `;

        this.velocityShaderTemplate = `
            uniform float u_deltaTime;
            uniform float u_stiffness;
            uniform float u_damping;
            uniform float u_gravity;
            uniform float u_audioWindStrength;
            uniform vec2 u_planeDimensions;

            void main() {
                vec2 uv = gl_FragCoord.xy / resolution.xy;
                if (uv.y > 0.99) { gl_FragColor = vec4(0.0); return; }

                float mass = 1.0;
                vec3 myPos = texture2D(texturePosition, uv).xyz;
                vec3 myVel = texture2D(textureVelocity, uv).xyz;
                vec3 totalForce = vec3(0.0);
                float restDistanceX = u_planeDimensions.x / resolution.x;
                float restDistanceY = u_planeDimensions.y / resolution.y;
                vec2 texelSize = 1.0 / resolution;

                vec3 leftPos = texture2D(texturePosition, uv - texelSize.xx).xyz;
                vec3 rightPos = texture2D(texturePosition, uv + texelSize.xx).xyz;
                vec3 upPos = texture2D(texturePosition, uv + texelSize.yy).xyz;
                vec3 downPos = texture2D(texturePosition, uv - texelSize.yy).xyz;

                if (uv.x > 0.01) totalForce += -u_stiffness * (distance(myPos, leftPos) - restDistanceX) * normalize(myPos - leftPos);
                if (uv.x < 0.99) totalForce += -u_stiffness * (distance(myPos, rightPos) - restDistanceX) * normalize(myPos - rightPos);
                if (uv.y < 0.99) totalForce += -u_stiffness * (distance(myPos, upPos) - restDistanceY) * normalize(myPos - upPos);
                if (uv.y > 0.01) totalForce += -u_stiffness * (distance(myPos, downPos) - restDistanceY) * normalize(myPos - downPos);

                totalForce -= myVel * u_damping;
                totalForce += vec3(0.0, -u_gravity, 0.0);
                totalForce += vec3(0.1, 0.2, 1.0) * u_audioWindStrength;
                
                vec3 acceleration = totalForce / mass;
                vec3 newVel = myVel + acceleration * u_deltaTime;
                
                gl_FragColor = vec4(newVel, 1.0);
            }
        `;
        
        this.paintShaderTemplate = `
            uniform float u_beat;
            uniform float u_deltaTime;
            uniform bool u_paintEnable;
            uniform float u_paintSplatStrength;
            uniform float u_paintFadeSpeed;
            uniform float u_time;
            
            float rand(vec2 co){ return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453); }

            void main() {
                vec2 uv = gl_FragCoord.xy / resolution.xy;
                vec4 currentPaint = texture2D(texturePaint, uv);
                vec4 newPaint = currentPaint;
                if (u_paintEnable && u_beat > 0.5) {
                    vec2 splatPos = vec2(rand(vec2(u_time * 0.1, 0.0)), rand(vec2(u_time * 0.1, 1.0)));
                    newPaint.r += smoothstep(0.1, 0.0, distance(uv, splatPos)) * u_paintSplatStrength;
                }
                newPaint.r *= (1.0 - u_paintFadeSpeed * u_deltaTime);
                gl_FragColor = newPaint;
            }
        `;

        this.positionShaderTemplate = `
            uniform float u_deltaTime;
            uniform sampler2D u_initialPosition;
            uniform sampler2D u_audioDataTexture;
            uniform int u_morphSource;
            uniform int u_morphTarget;
            uniform float u_morphMix;
            uniform float u_deformationStrength;
            uniform float u_time;
            uniform bool u_paintEnable;
            uniform int u_warpMode;
            uniform float u_audioLow;
            
            uniform float u_sagAmount; uniform float u_sagFalloffSharpness; uniform float u_sagAudioMod;
            uniform float u_droopAmount; uniform float u_droopAudioMod; uniform float u_droopFalloffSharpness; uniform float u_droopSupportedWidthFactor; uniform float u_droopSupportedDepthFactor;
            uniform float u_cylinderRadius; uniform float u_cylinderHeightScale; uniform int u_cylinderAxisAlignment; uniform float u_cylinderArcAngle; uniform float u_cylinderArcOffset;
            uniform float u_bendAngle; uniform float u_bendAudioMod; uniform float u_bendFalloffSharpness; uniform int u_bendAxis;
            uniform float u_foldAngle; uniform float u_foldDepth; uniform float u_foldRoundness; uniform float u_foldAudioMod; uniform float u_foldNudge;
            uniform bool u_enableFoldCrease; uniform float u_foldCreaseDepth; uniform float u_foldCreaseSharpness;
            uniform bool u_enableFoldTuck; uniform float u_foldTuckAmount; uniform float u_foldTuckReach;
            uniform vec2 u_planeDimensions;

            void main() {
                vec2 uv = gl_FragCoord.xy / resolution.xy;
                vec3 initialPos = texture2D(u_initialPosition, uv).xyz;
                
                vec3 prevPos = texture2D(texturePosition, uv).xyz;
                vec3 velocity = texture2D(textureVelocity, uv).xyz;
                vec3 clothPos = prevPos + velocity * u_deltaTime;
                
                if (uv.y > 0.99) { clothPos = initialPos; }

                vec3 finalPos;

                if (u_warpMode != 0) {
                    // --- LEGACY WARP MODE ---
                    if (u_warpMode == 1) { finalPos = calculateFold(initialPos, uv, u_planeDimensions, u_foldAngle + u_foldAudioMod * u_audioLow, u_foldDepth, u_foldRoundness, u_foldNudge, u_enableFoldCrease, u_foldCreaseDepth, u_foldCreaseSharpness, u_enableFoldTuck, u_foldTuckAmount, u_foldTuckReach); }
                    else if (u_warpMode == 2) { finalPos = calculateSag(initialPos, uv, u_sagAmount * (1.0 + u_sagAudioMod * u_audioLow), u_sagFalloffSharpness); }
                    else if (u_warpMode == 3) { finalPos = calculateBend(initialPos, uv, u_planeDimensions, u_bendAngle * (1.0 + u_bendAudioMod * u_audioLow), u_bendFalloffSharpness, u_bendAxis); }
                    else if (u_warpMode == 4) { finalPos = calculateCylinder(uv, u_planeDimensions, u_cylinderRadius, u_cylinderHeightScale, u_cylinderAxisAlignment, u_cylinderArcAngle, u_cylinderArcOffset); }
                    else if (u_warpMode == 5) { finalPos = calculateDroop(initialPos, uv, u_droopAmount * (1.0 + u_droopAudioMod * u_audioLow), u_droopFalloffSharpness, u_droopSupportedWidthFactor, u_droopSupportedDepthFactor); }
                    else { finalPos = initialPos; }

                } else {
                    // --- NEW MORPHING MODE ---
                    vec3 sourceStatePos = calculateTargetState(u_morphSource, initialPos, uv, u_audioDataTexture, u_deformationStrength, u_time, clothPos);
                    vec3 targetStatePos = calculateTargetState(u_morphTarget, initialPos, uv, u_audioDataTexture, u_deformationStrength, u_time, clothPos);
                    finalPos = mix(sourceStatePos, targetStatePos, u_morphMix);
                }

                if (u_paintEnable) {
                    vec4 paintData = texture2D(texturePaint, uv);
                    finalPos.z += paintData.r;
                }

                gl_FragColor = vec4(finalPos, 1.0);
            }
        `;

        this.normalShaderTemplate = `
            void main() {
                vec2 uv = gl_FragCoord.xy / resolution.xy;
                float dx = 1.0 / resolution.x;
                float dy = 1.0 / resolution.y;
                vec3 p_center = texture2D(texturePosition, uv).xyz;
                vec3 p_right  = texture2D(texturePosition, uv + vec2(dx, 0.0)).xyz;
                vec3 p_up     = texture2D(texturePosition, uv + vec2(0.0, dy)).xyz;
                vec3 tangent = p_right - p_center;
                vec3 bitangent = p_up - p_center;
                vec3 normal = normalize(cross(tangent, bitangent));
                gl_FragColor = vec4(normal, 1.0);
            }
        `;
    }
};