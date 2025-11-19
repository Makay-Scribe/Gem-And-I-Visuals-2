import THREE from '../three-singleton.js';

/*
================================================================================================
FLUID SIMULATION DIRECTOR
================================================================================================
This module is the "Conductor" for all fluid-based artistic transitions.
It directs the unified ComputeManager (Particles/FluidSim).
*/

export const FluidDirector = {
    app: null,
    activeScript: null, // The currently running animation script

    currentState: 'IDLE_ON_CANVAS', // 'IDLE_ON_CANVAS', 'ANIMATING_TO_MODEL', 'IDLE_ON_MODEL', 'ANIMATING_TO_CANVAS'
    nextState: null, // Stores the target state after an animation finishes.

    scripts: {
        'cosmicGeode': {
            duration: 18000,
            onStart(CM) {
                if (this.app.ImagePlaneManager.fluidMaterial) {
                    this.app.ImagePlaneManager.fluidMaterial.blending = THREE.AdditiveBlending;
                }
                const uniforms = CM.velocityVariable.material.uniforms;
                uniforms.u_vortexCenter.value.x = 0;
                uniforms.u_vortexCenter.value.y = 0;
            },
            forward(CM, progress, easedProgress) {
                if (!CM.velocityVariable) return;
                const uniforms = CM.velocityVariable.material.uniforms;
                const S = this.app.vizSettings;

                uniforms.u_gravity.value.set(0,0,0);
                S.fluid_gravity = 0.0;
                S.ash_twinkleIntensity = 0.0;

                if (progress < 0.4) { // ACT I: COLLAPSE
                    const phaseProgress = progress / 0.4;
                    S.fluid_cohesionStrength = THREE.MathUtils.lerp(0.0, 8.0, phaseProgress);
                    uniforms.u_cohesionStrength.value = S.fluid_cohesionStrength;
                    
                    uniforms.u_vortexStrength.value = THREE.MathUtils.lerp(0.0, 25.0, phaseProgress);
                    S.fluid_curlStrength = 0.0;
                    uniforms.fluid_curlStrength.value = S.fluid_curlStrength;
                    
                    S.fire_visual_progress = phaseProgress * 0.8;
                    S.particle_size_mix = 0.0;
                    S.particle_morphProgress = phaseProgress; 
                }
                else if (progress < 0.5) { // ACT II: CHURN
                    const phaseProgress = (progress - 0.4) / 0.1;
                    S.fluid_cohesionStrength = 8.0;
                    uniforms.u_cohesionStrength.value = S.fluid_cohesionStrength;

                    uniforms.u_vortexStrength.value = THREE.MathUtils.lerp(25.0, 0.0, phaseProgress);
                    
                    S.fluid_curlStrength = THREE.MathUtils.lerp(0.0, 10.0, phaseProgress);
                    uniforms.fluid_curlStrength.value = S.fluid_curlStrength;
                    S.fluid_curlScale = 1.0;
                    uniforms.fluid_curlScale.value = S.fluid_curlScale;

                    S.fire_visual_progress = 0.8;
                    S.particle_morphProgress = 1.0; 
                }
                else { // ACT III: GROWTH
                    const phaseProgress = (progress - 0.5) / 0.5;
                    S.fluid_cohesionStrength = THREE.MathUtils.lerp(8.0, 0.0, phaseProgress);
                    uniforms.u_cohesionStrength.value = S.fluid_cohesionStrength;

                    S.fluid_curlStrength = THREE.MathUtils.lerp(10.0, 0.0, phaseProgress);
                    uniforms.fluid_curlStrength.value = S.fluid_curlStrength;

                    uniforms.u_targetState.value = 1;
                    uniforms.fluid_attractionStrength.value = THREE.MathUtils.lerp(0.0, 3.5, phaseProgress);
                    
                    const bloomCurve = Math.sin(phaseProgress * Math.PI);
                    uniforms.u_explosionStrength.value = 5.0 * bloomCurve;

                    S.fire_visual_progress = THREE.MathUtils.lerp(0.8, 0.0, phaseProgress);
                    S.particle_morphProgress = 1.0; 
                    S.particle_twinkleIntensity = phaseProgress;
                    S.particle_size_mix = THREE.MathUtils.lerp(0.0, 1.0, phaseProgress);
                }
            },
            reverse(CM, progress, easedProgress) {
                const S = this.app.vizSettings;
                const uniforms = CM.velocityVariable.material.uniforms;
                
                uniforms.u_targetState.value = 0;
                uniforms.fluid_attractionStrength.value = 3.0 * easedProgress;
                S.fluid_cohesionStrength = 0.0;
                uniforms.u_cohesionStrength.value = 0.0;

                S.particle_morphProgress = 1.0 - easedProgress;
                S.particle_size_mix = 1.0 - easedProgress;
                S.particle_twinkleIntensity = 1.0 - easedProgress;
                S.fire_visual_progress = 0.0;
            },
            onEnd(CM) {
                const S = this.app.vizSettings;
                if (this.app.ImagePlaneManager.fluidMaterial) {
                    this.app.ImagePlaneManager.fluidMaterial.blending = THREE.NormalBlending;
                }
                S.fire_visual_progress = 0.0;
                S.ash_twinkleIntensity = 0.0;
                S.fluid_cohesionStrength = 0.0;
                if(CM.velocityVariable) CM.velocityVariable.material.uniforms.u_cohesionStrength.value = 0.0;
            }
        },

        'fireAndAsh': {
            duration: 20000,
            onStart(CM) {
                if (this.app.ImagePlaneManager.fluidMaterial) {
                    this.app.ImagePlaneManager.fluidMaterial.blending = THREE.AdditiveBlending;
                }
            },
            forward(CM, progress, easedProgress) {
                if (!CM.velocityVariable || !this.app.ImagePlaneManager.fluidMaterial) return;
                const uniforms = CM.velocityVariable.material.uniforms;
                const S = this.app.vizSettings;

                uniforms.u_vortexStrength.value = 0.0;
                uniforms.u_explosionStrength.value = 0.0;
                S.ash_twinkleIntensity = 0.0;
                
                if (progress < 0.25) { // ACT I: ERUPTION
                    const phaseProgress = progress / 0.25;
                    S.fluid_gravity = THREE.MathUtils.lerp(0.0, 15.0, phaseProgress);
                    uniforms.u_gravity.value.y = S.fluid_gravity;
                    S.fluid_curlStrength = THREE.MathUtils.lerp(0.0, 20.0, phaseProgress);
                    uniforms.fluid_curlStrength.value = S.fluid_curlStrength;
                    S.fluid_curlScale = 0.5;
                    uniforms.fluid_curlScale.value = S.fluid_curlScale;
                    S.fluid_curlSpeed = 1.5;
                    uniforms.fluid_curlSpeed.value = S.fluid_curlSpeed;
                    
                    S.fire_visual_progress = phaseProgress;
                    S.particle_size_mix = 0.0;
                }
                else if (progress < 0.5) { // ACT II: RISING EMBERS
                    const phaseProgress = (progress - 0.25) / 0.25;
                    S.fluid_gravity = THREE.MathUtils.lerp(15.0, 0.0, phaseProgress);
                    uniforms.u_gravity.value.y = S.fluid_gravity;
                    S.fluid_curlStrength = THREE.MathUtils.lerp(20.0, 5.0, phaseProgress);
                    uniforms.fluid_curlStrength.value = S.fluid_curlStrength;
                    
                    S.fire_visual_progress = THREE.MathUtils.lerp(1.0, 0.6, phaseProgress);
                    S.particle_size_mix = THREE.MathUtils.lerp(0.0, 0.5, phaseProgress);
                }
                else if (progress < 0.8) { // ACT III: THE TURN & ASH FALL
                    const phaseProgress = (progress - 0.5) / 0.3;
                    S.fluid_gravity = THREE.MathUtils.lerp(0.0, -2.0, phaseProgress);
                    uniforms.u_gravity.value.y = S.fluid_gravity;
                    uniforms.u_gravity.value.x = THREE.MathUtils.lerp(0.0, 1.0, phaseProgress);
                    S.fluid_curlStrength = THREE.MathUtils.lerp(5.0, 1.0, phaseProgress);
                    uniforms.fluid_curlStrength.value = S.fluid_curlStrength;
                    
                    S.fire_visual_progress = THREE.MathUtils.lerp(0.6, 0.0, phaseProgress);
                    S.ash_twinkleIntensity = phaseProgress;
                }
                else { // ACT IV: SETTLING
                    const phaseProgress = (progress - 0.8) / 0.2;
                    S.fluid_gravity = THREE.MathUtils.lerp(-2.0, 0.0, phaseProgress);
                    uniforms.u_gravity.value.y = S.fluid_gravity;
                    uniforms.u_gravity.value.x = THREE.MathUtils.lerp(1.0, 0.0, phaseProgress);
                    uniforms.u_targetState.value = 1;
                    uniforms.fluid_attractionStrength.value = THREE.MathUtils.lerp(0.0, 3.0, phaseProgress);
                    
                    S.fire_visual_progress = 0.0;
                    S.ash_twinkleIntensity = 1.0;
                    S.particle_morphProgress = phaseProgress;
                    S.particle_size_mix = THREE.MathUtils.lerp(0.5, 1.0, phaseProgress);
                    S.particle_twinkleIntensity = phaseProgress;
                }
            },
            reverse(CM, progress, easedProgress) {
                const S = this.app.vizSettings;
                const uniforms = CM.velocityVariable.material.uniforms;
                uniforms.u_targetState.value = 0;
                uniforms.fluid_attractionStrength.value = 3.0 * easedProgress;
                S.particle_morphProgress = 1.0 - easedProgress;
                S.particle_size_mix = 1.0 - easedProgress;
                S.particle_twinkleIntensity = 1.0 - easedProgress;
                S.fire_visual_progress = 0.0;
                S.ash_twinkleIntensity = 0.0;
            },
            onEnd(CM) {
                const S = this.app.vizSettings;
                if (this.app.ImagePlaneManager.fluidMaterial) {
                    this.app.ImagePlaneManager.fluidMaterial.blending = THREE.NormalBlending;
                }
                S.fire_visual_progress = 0.0;
                S.ash_twinkleIntensity = 0.0;
            }
        },

        'meltAndReform': {
            duration: 17000,
            forward(CM, progress, easedProgress) {
                if (!CM.velocityVariable || !this.app.ImagePlaneManager.fluidMaterial) return;
                const uniforms = CM.velocityVariable.material.uniforms;
                const S = this.app.vizSettings;
                uniforms.fluid_curlStrength.value = 0.0;
                uniforms.u_vortexStrength.value = 0.0;
                uniforms.u_explosionStrength.value = 0.0;
                if (progress <= 0.5) {
                    const meltProgress = progress / 0.5;
                    uniforms.u_gravity.value.y = THREE.MathUtils.lerp(0.0, -9.8, meltProgress);
                    uniforms.fluid_attractionStrength.value = 0.0;
                    uniforms.u_targetState.value = 0;
                    S.particle_morphProgress = 0.0;
                    S.particle_size_mix = 0.0;
                    S.particle_twinkleIntensity = 0.0;
                } else {
                    const reformProgress = (progress - 0.5) / 0.5;
                    uniforms.u_gravity.value.y = THREE.MathUtils.lerp(-9.8, 0.0, reformProgress);
                    uniforms.u_targetState.value = 1;
                    uniforms.fluid_attractionStrength.value = THREE.MathUtils.lerp(0.0, 3.0, reformProgress);
                    S.particle_morphProgress = reformProgress;
                    S.particle_size_mix = reformProgress;
                    S.particle_twinkleIntensity = reformProgress;
                }
            },
            reverse(CM, progress, easedProgress) {
                 if (!CM.velocityVariable || !this.app.ImagePlaneManager.fluidMaterial) return;
                const uniforms = CM.velocityVariable.material.uniforms;
                const S = this.app.vizSettings;
                uniforms.fluid_curlStrength.value = 0.0;
                uniforms.u_vortexStrength.value = 0.0;
                uniforms.u_explosionStrength.value = 0.0;
                uniforms.u_gravity.value.y = 0.0;
                uniforms.u_targetState.value = 0;
                uniforms.fluid_attractionStrength.value = 3.0 * easedProgress;
                S.particle_morphProgress = 1.0 - easedProgress;
                S.particle_size_mix = 1.0 - easedProgress;
                S.particle_twinkleIntensity = 1.0 - easedProgress;
            }
        },
        'explosion': {
            duration: 8000,
            forward(CM, progress, easedProgress) {
                if (!CM.velocityVariable || !this.app.ImagePlaneManager.fluidMaterial) return;
                const uniforms = CM.velocityVariable.material.uniforms;
                const S = this.app.vizSettings;
                uniforms.u_vortexStrength.value = 0.0;
                uniforms.u_explosionStrength.value = 0.0;
                uniforms.u_gravity.value.y = 0.0;
                const chaosProgress = Math.min(1.0, progress / 0.7);
                const chaosCurve = Math.sin(chaosProgress * Math.PI);
                uniforms.fluid_curlStrength.value = 15.0 * chaosCurve;
                uniforms.fluid_curlScale.value = 0.2;
                uniforms.fluid_curlSpeed.value = 0.8;
                uniforms.fluid_attractionStrength.value = 0.0;
                if (progress > 0.6) {
                    const reassembleProgress = (progress - 0.6) / 0.4;
                    uniforms.u_targetState.value = 1;
                    uniforms.fluid_attractionStrength.value = 3.0 * reassembleProgress;
                    S.particle_morphProgress = reassembleProgress;
                    S.particle_size_mix = reassembleProgress;
                    S.particle_twinkleIntensity = reassembleProgress;
                }
            },
            reverse(CM, progress, easedProgress) {
                if (!CM.velocityVariable || !this.app.ImagePlaneManager.fluidMaterial) return;
                const uniforms = CM.velocityVariable.material.uniforms;
                const S = this.app.vizSettings;
                uniforms.fluid_curlStrength.value = 0.0;
                uniforms.u_vortexStrength.value = 0.0;
                uniforms.u_explosionStrength.value = 0.0;
                uniforms.u_gravity.value.y = 0.0;
                uniforms.u_targetState.value = 0;
                uniforms.fluid_attractionStrength.value = 3.0 * easedProgress;
                S.particle_morphProgress = 1.0 - easedProgress;
                S.particle_size_mix = 1.0 - easedProgress;
                S.particle_twinkleIntensity = 1.0 - easedProgress;
            }
        },
        'vortex': {
            duration: 10000,
            onStart(CM) {
                const uniforms = CM.velocityVariable.material.uniforms;
                const planeSize = this.app.ImagePlaneManager.planeDimensions;
                uniforms.u_vortexCenter.value.x = (Math.random() - 0.5) * planeSize.x * 0.5;
                uniforms.u_vortexCenter.value.y = (Math.random() - 0.5) * planeSize.y * 0.5;
            },
            forward(CM, progress, easedProgress) {
                if (!CM.velocityVariable || !this.app.ImagePlaneManager.fluidMaterial) return;
                const uniforms = CM.velocityVariable.material.uniforms;
                const S = this.app.vizSettings;
                uniforms.fluid_curlStrength.value = 0.0;
                uniforms.u_explosionStrength.value = 0.0;
                const vortexProgress = Math.min(1.0, progress / 0.8);
                const vortexCurve = Math.sin(vortexProgress * Math.PI);
                uniforms.u_vortexStrength.value = 15.0 * vortexCurve;
                uniforms.u_gravity.value.y = 5.0 * vortexCurve;
                uniforms.fluid_attractionStrength.value = 0.0;
                if (progress > 0.6) {
                    const reformProgress = (progress - 0.6) / 0.4;
                    uniforms.u_targetState.value = 1;
                    uniforms.fluid_attractionStrength.value = 3.0 * reformProgress;
                    S.particle_morphProgress = reformProgress;
                    S.particle_size_mix = reformProgress;
                    S.particle_twinkleIntensity = reformProgress;
                }
            },
            reverse(CM, progress, easedProgress) {
                if (!CM.velocityVariable || !this.app.ImagePlaneManager.fluidMaterial) return;
                const uniforms = CM.velocityVariable.material.uniforms;
                const S = this.app.vizSettings;
                uniforms.fluid_curlStrength.value = 0.0;
                uniforms.u_vortexStrength.value = 0.0;
                uniforms.u_explosionStrength.value = 0.0;
                uniforms.u_gravity.value.y = 0.0;
                uniforms.u_targetState.value = 0;
                uniforms.fluid_attractionStrength.value = 3.0 * easedProgress;
                S.particle_morphProgress = 1.0 - easedProgress;
                S.particle_size_mix = 1.0 - easedProgress;
                S.particle_twinkleIntensity = 1.0 - easedProgress;
            }
        },
        'swirl_reform': {
            duration: 9000,
            forward(CM, progress, easedProgress) {
                if (!CM.velocityVariable || !this.app.ImagePlaneManager.fluidMaterial) return;
                const uniforms = CM.velocityVariable.material.uniforms;
                const S = this.app.vizSettings;
                uniforms.u_vortexStrength.value = 0.0;
                uniforms.u_explosionStrength.value = 0.0;
                uniforms.u_gravity.value.y = 0.0;
                const swirlProgress = Math.min(1.0, progress / 0.8);
                const swirlCurve = Math.sin(swirlProgress * Math.PI);
                uniforms.fluid_curlStrength.value = 5.0 * swirlCurve;
                uniforms.fluid_curlScale.value = 0.05;
                uniforms.fluid_curlSpeed.value = 0.5;
                uniforms.fluid_attractionStrength.value = 0.0;
                if (progress > 0.6) {
                    const reformProgress = (progress - 0.6) / 0.4;
                    uniforms.u_targetState.value = 1;
                    uniforms.fluid_attractionStrength.value = 3.0 * reformProgress;
                    S.particle_morphProgress = reformProgress;
                    S.particle_size_mix = reformProgress;
                    S.particle_twinkleIntensity = reformProgress;
                }
            },
            reverse(CM, progress, easedProgress) {
                if (!CM.velocityVariable || !this.app.ImagePlaneManager.fluidMaterial) return;
                const uniforms = CM.velocityVariable.material.uniforms;
                const S = this.app.vizSettings;
                uniforms.u_vortexStrength.value = 0.0;
                uniforms.u_explosionStrength.value = 0.0;
                uniforms.u_gravity.value.y = 0.0;
                const chaosProgress = Math.min(1.0, progress / 0.8);
                const chaosCurve = Math.sin(chaosProgress * Math.PI);
                uniforms.fluid_curlStrength.value = 5.0 * chaosCurve;
                uniforms.fluid_curlScale.value = 0.05;
                uniforms.fluid_curlSpeed.value = 0.5;
                uniforms.fluid_attractionStrength.value = 0.0;
                if (progress > 0.6) {
                    const reformProgress = (progress - 0.6) / 0.4;
                    uniforms.u_targetState.value = 0;
                    uniforms.fluid_attractionStrength.value = 3.0 * reformProgress;
                    S.particle_morphProgress = 1.0 - reformProgress;
                    S.particle_size_mix = 1.0 - reformProgress;
                    S.particle_twinkleIntensity = 1.0 - reformProgress;
                }
            }
        },
        'reset': {
            duration: 4000,
            update(CM, progress, easedProgress) {
                if (!CM.velocityVariable || !this.app.ImagePlaneManager.fluidMaterial) return;
                const uniforms = CM.velocityVariable.material.uniforms;
                const S = this.app.vizSettings;
                uniforms.fluid_attractionStrength.value = 3.0 * easedProgress;
                uniforms.u_targetState.value = 0;
                S.particle_morphProgress = THREE.MathUtils.lerp(S.particle_morphProgress, 0.0, 0.1);
            }
        }
    },

    init(appInstance) {
        this.app = appInstance;
    },
    
    _resetUniforms() {
        const CM = this.app.ComputeManager;
        if (!CM || !CM.gpuCompute || !CM.velocityVariable) return;
        
        CM._resetFluidUniforms();
    },

    run(scriptId = 'meltAndReform') {
        if (this.currentState.startsWith('ANIMATING')) { return; }
        const modelReady = this.app.isDefaultSculptureBaked;
        const CM = this.app.ComputeManager;
        const script = this.scripts[scriptId];
        if (!script || !CM || !CM.gpuCompute || !CM.velocityVariable) { return; }
        if (script.onStart) { script.onStart.call(this, CM); }

        let animationFunction;
        let nextIdleState;
        let newAnimatingState;
        const isCurrentlyOnCanvas = this.currentState === 'IDLE_ON_CANVAS';
        
        if (scriptId === 'reset') {
            if (isCurrentlyOnCanvas) return;
            animationFunction = script.update;
            newAnimatingState = 'ANIMATING_TO_CANVAS';
            nextIdleState = 'IDLE_ON_CANVAS';
        } else {
            if (isCurrentlyOnCanvas) {
                if (!modelReady) {
                     this.app.UIManager.logError("Cannot transition to 3D Model. Please load and 'Bake' a GLB model first.");
                     return;
                }
                animationFunction = script.forward;
                newAnimatingState = 'ANIMATING_TO_MODEL';
                nextIdleState = 'IDLE_ON_MODEL';
            } 
            else { // isCurrentlyOnModel
                animationFunction = script.reverse;
                newAnimatingState = 'ANIMATING_TO_CANVAS';
                nextIdleState = 'IDLE_ON_CANVAS';
            }
        }

        if (animationFunction) {
            this.currentState = newAnimatingState;
            this.nextState = nextIdleState;
            this._resetUniforms();
            this.activeScript = {
                id: scriptId,
                startTime: this.app.currentTime,
                duration: script.duration || 10000,
                update: animationFunction.bind(this),
                onEnd: script.onEnd ? script.onEnd.bind(this) : null
            };
            if(this.app.UIManager) this.app.UIManager.setFluidControlsDisabled(true);
        }
    },
    
    interruptAndStop() {
        if (!this.activeScript) return;
        if (this.activeScript.onEnd) { this.activeScript.onEnd(this.app.ComputeManager); }
        this.activeScript = null;
        this._resetUniforms();
        if (this.app.UIManager) this.app.UIManager.setFluidControlsDisabled(false);
        this.currentState = this.nextState === 'IDLE_ON_MODEL' ? 'IDLE_ON_CANVAS' : 'IDLE_ON_MODEL';
        this.nextState = null;
    },

    stop() {
        if (!this.activeScript) return;
        if (this.activeScript.onEnd) { this.activeScript.onEnd(this.app.ComputeManager); }
        this.activeScript = null;
        if (this.nextState) {
            this.currentState = this.nextState;
            this.nextState = null;
        } else {
            this.currentState = 'IDLE_ON_CANVAS';
        }
        if(this.app.UIManager) this.app.UIManager.setFluidControlsDisabled(false);
    },

    update() {
        if (!this.activeScript) return;
        const CM = this.app.ComputeManager;
        if (!CM || !CM.gpuCompute) { this.stop(); return; }
        const elapsedTime = (this.app.currentTime - this.activeScript.startTime) * 1000;
        let progress = Math.min(1.0, elapsedTime / this.activeScript.duration);
        const easedProgress = 0.5 - 0.5 * Math.cos(progress * Math.PI);
        this.activeScript.update(CM, progress, easedProgress);
        if (progress >= 1.0) {
            this.activeScript.update(CM, 1.0, 1.0); 
            this.stop();
        }
    }
};