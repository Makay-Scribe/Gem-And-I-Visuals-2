import THREE from '../three-singleton.js';

/*
================================================================================================
FLUID SIMULATION DIRECTOR (REFACTORED)
================================================================================================
This module is the "Conductor" for all fluid-based artistic transitions.
It now directs the unified ComputeManager, telling it which forces to apply and when
by modifying the uniforms on its GPGPU variables.
*/

export const FluidDirector = {
    app: null,
    activeScript: null, // The currently running animation script

    currentState: 'IDLE_ON_CANVAS', // 'IDLE_ON_CANVAS', 'ANIMATING_TO_MODEL', 'IDLE_ON_MODEL', 'ANIMATING_TO_CANVAS'
    nextState: null, // Stores the target state after an animation finishes.

    scripts: {
        'meltAndReform': {
            duration: 17000,
            forward(CM, progress, easedProgress) {
                if (!CM.velocityVariable || !this.app.ImagePlaneManager.fluidMaterial) return;
                const uniforms = CM.velocityVariable.material.uniforms;
                const renderUniforms = this.app.ImagePlaneManager.fluidMaterial.uniforms;

                // --- Take Full Control of All Forces ---
                uniforms.fluid_curlStrength.value = 0.0;
                uniforms.u_vortexStrength.value = 0.0;
                uniforms.u_explosionStrength.value = 0.0;
                
                // --- PHASE 1: Melt Down (0% to 50% progress) ---
                if (progress <= 0.5) {
                    const meltProgress = progress / 0.5; // Remap 0->0.5 to 0->1
                    
                    uniforms.u_gravity.value.y = THREE.MathUtils.lerp(0.0, -9.8, meltProgress);
                    uniforms.fluid_attractionStrength.value = 0.0; // CRITICAL: Keep attraction OFF
                    uniforms.u_targetState.value = 0; // Target remains the canvas
                    renderUniforms.u_particleColorMix.value = 0.0;
                }
                // --- PHASE 2: Reform on Model (50% to 100% progress) ---
                else {
                    const reformProgress = (progress - 0.5) / 0.5; // Remap 0.5->1 to 0->1

                    uniforms.u_gravity.value.y = THREE.MathUtils.lerp(-9.8, 0.0, reformProgress); // Fade gravity out
                    uniforms.u_targetState.value = 1; // CRITICAL: Switch target to the 3D model
                    uniforms.fluid_attractionStrength.value = THREE.MathUtils.lerp(0.0, 3.0, reformProgress);
                    renderUniforms.u_particleColorMix.value = reformProgress;
                }
            },
            reverse(CM, progress, easedProgress) {
                 if (!CM.velocityVariable || !this.app.ImagePlaneManager.fluidMaterial) return;
                const uniforms = CM.velocityVariable.material.uniforms;
                const renderUniforms = this.app.ImagePlaneManager.fluidMaterial.uniforms;

                uniforms.fluid_curlStrength.value = 0.0;
                uniforms.u_vortexStrength.value = 0.0;
                uniforms.u_explosionStrength.value = 0.0;
                uniforms.u_gravity.value.y = 0.0;

                uniforms.u_targetState.value = 0;
                uniforms.fluid_attractionStrength.value = 3.0 * easedProgress;
                renderUniforms.u_particleColorMix.value = 1.0 - easedProgress;
            }
        },
        'explosion': {
            duration: 8000,
            forward(CM, progress, easedProgress) {
                if (!CM.velocityVariable || !this.app.ImagePlaneManager.fluidMaterial) return;
                const uniforms = CM.velocityVariable.material.uniforms;
                const renderUniforms = this.app.ImagePlaneManager.fluidMaterial.uniforms;
                
                // --- New "True Explosion" using Curl Noise ---
                uniforms.u_vortexStrength.value = 0.0;
                uniforms.u_explosionStrength.value = 0.0; // Old "shockwave" force is now unused for this effect
                uniforms.u_gravity.value.y = 0.0;
                
                // A single, powerful pulse of chaotic curl noise
                const chaosProgress = Math.min(1.0, progress / 0.7);
                const chaosCurve = Math.sin(chaosProgress * Math.PI);
                uniforms.fluid_curlStrength.value = 15.0 * chaosCurve; // Much higher strength for explosive feel
                uniforms.fluid_curlScale.value = 0.2; // Larger scale for bigger swirls
                uniforms.fluid_curlSpeed.value = 0.8;
                uniforms.fluid_attractionStrength.value = 0.0;

                // Reform phase
                if (progress > 0.6) {
                    const reassembleProgress = (progress - 0.6) / 0.4;
                    uniforms.u_targetState.value = 1;
                    uniforms.fluid_attractionStrength.value = 3.0 * reassembleProgress;
                    renderUniforms.u_particleColorMix.value = reassembleProgress;
                }
            },
            reverse(CM, progress, easedProgress) {
                if (!CM.velocityVariable || !this.app.ImagePlaneManager.fluidMaterial) return;
                const uniforms = CM.velocityVariable.material.uniforms;
                const renderUniforms = this.app.ImagePlaneManager.fluidMaterial.uniforms;

                uniforms.fluid_curlStrength.value = 0.0;
                uniforms.u_vortexStrength.value = 0.0;
                uniforms.u_explosionStrength.value = 0.0;
                uniforms.u_gravity.value.y = 0.0;

                uniforms.u_targetState.value = 0;
                uniforms.fluid_attractionStrength.value = 3.0 * easedProgress;
                renderUniforms.u_particleColorMix.value = 1.0 - easedProgress;
            }
        },
        'vortex': {
            duration: 10000,
            onStart(CM) {
                // --- New Dynamic Vortex Center ---
                // Randomize the center position when the script starts
                const uniforms = CM.velocityVariable.material.uniforms;
                const planeSize = this.app.ImagePlaneManager.planeDimensions;
                uniforms.u_vortexCenter.value.x = (Math.random() - 0.5) * planeSize.x * 0.5;
                uniforms.u_vortexCenter.value.y = (Math.random() - 0.5) * planeSize.y * 0.5;
                console.log(`New Vortex Center: ${uniforms.u_vortexCenter.value.x.toFixed(2)}, ${uniforms.u_vortexCenter.value.y.toFixed(2)}`);
            },
            forward(CM, progress, easedProgress) {
                if (!CM.velocityVariable || !this.app.ImagePlaneManager.fluidMaterial) return;
                const uniforms = CM.velocityVariable.material.uniforms;
                const renderUniforms = this.app.ImagePlaneManager.fluidMaterial.uniforms;

                uniforms.fluid_curlStrength.value = 0.0;
                uniforms.u_explosionStrength.value = 0.0;

                const vortexProgress = Math.min(1.0, progress / 0.8);
                const vortexCurve = Math.sin(vortexProgress * Math.PI);
                uniforms.u_vortexStrength.value = 15.0 * vortexCurve;
                uniforms.u_gravity.value.y = 5.0 * vortexCurve; // Pulls particles "into" the screen
                uniforms.fluid_attractionStrength.value = 0.0;

                if (progress > 0.6) {
                    const reformProgress = (progress - 0.6) / 0.4;
                    uniforms.u_targetState.value = 1;
                    uniforms.fluid_attractionStrength.value = 3.0 * reformProgress;
                    renderUniforms.u_particleColorMix.value = reformProgress;
                }
            },
            reverse(CM, progress, easedProgress) {
                if (!CM.velocityVariable || !this.app.ImagePlaneManager.fluidMaterial) return;
                const uniforms = CM.velocityVariable.material.uniforms;
                const renderUniforms = this.app.ImagePlaneManager.fluidMaterial.uniforms;

                uniforms.fluid_curlStrength.value = 0.0;
                uniforms.u_vortexStrength.value = 0.0;
                uniforms.u_explosionStrength.value = 0.0;
                uniforms.u_gravity.value.y = 0.0;

                uniforms.u_targetState.value = 0;
                uniforms.fluid_attractionStrength.value = 3.0 * easedProgress;
                renderUniforms.u_particleColorMix.value = 1.0 - easedProgress;
            }
        },
        'swirl_reform': {
            duration: 9000,
            forward(CM, progress, easedProgress) {
                if (!CM.velocityVariable || !this.app.ImagePlaneManager.fluidMaterial) return;
                const uniforms = CM.velocityVariable.material.uniforms;
                const renderUniforms = this.app.ImagePlaneManager.fluidMaterial.uniforms;

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
                    renderUniforms.u_particleColorMix.value = reformProgress;
                }
            },
            reverse(CM, progress, easedProgress) {
                if (!CM.velocityVariable || !this.app.ImagePlaneManager.fluidMaterial) return;
                const uniforms = CM.velocityVariable.material.uniforms;
                const renderUniforms = this.app.ImagePlaneManager.fluidMaterial.uniforms;
                
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
                    renderUniforms.u_particleColorMix.value = 1.0 - reformProgress;
                }
            }
        },
        'reset': {
            duration: 4000,
            update(CM, progress, easedProgress) {
                if (!CM.velocityVariable || !this.app.ImagePlaneManager.fluidMaterial) return;
                const uniforms = CM.velocityVariable.material.uniforms;
                const renderUniforms = this.app.ImagePlaneManager.fluidMaterial.uniforms;

                uniforms.fluid_attractionStrength.value = 3.0 * easedProgress;
                uniforms.u_targetState.value = 0;
                renderUniforms.u_particleColorMix.value = THREE.MathUtils.lerp(renderUniforms.u_particleColorMix.value, 0.0, 0.1);
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
        if (this.currentState.startsWith('ANIMATING')) {
            console.warn("FluidDirector: Animation already in progress. Vetoing run command.");
            return;
        }
        
        const modelReady = this.app.isDefaultSculptureBaked;
        const CM = this.app.ComputeManager;
        const script = this.scripts[scriptId];

        if (!script || !CM || !CM.gpuCompute || !CM.velocityVariable) {
            console.error("FluidDirector cannot run: Compute Manager or script is not ready.");
            return;
        }

        // --- Execute onStart hook if it exists ---
        if (script.onStart) {
            script.onStart.call(this, CM);
        }

        let animationFunction;
        let nextIdleState;
        let newAnimatingState;

        const isCurrentlyOnCanvas = this.currentState === 'IDLE_ON_CANVAS';
        const isCurrentlyOnModel = this.currentState === 'IDLE_ON_MODEL';
        
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
            else if (isCurrentlyOnModel) { 
                animationFunction = script.reverse;
                newAnimatingState = 'ANIMATING_TO_CANVAS';
                nextIdleState = 'IDLE_ON_CANVAS';
            }
            else { return; }
        }

        if (animationFunction) {
            this.currentState = newAnimatingState;
            this.nextState = nextIdleState;
            this._resetUniforms();
            
            this.activeScript = {
                id: scriptId,
                startTime: this.app.currentTime,
                duration: script.duration || 10000,
                update: animationFunction.bind(this)
            };
            if(this.app.UIManager) this.app.UIManager.setFluidControlsDisabled(true);
        }
    },
    
    interruptAndStop() {
        if (!this.activeScript) return;
        console.log("FluidDirector: Animation interrupted by user.");
        this.activeScript = null;
        this._resetUniforms();
        
        if (this.app.UIManager) this.app.UIManager.setFluidControlsDisabled(false);
        this.currentState = this.nextState === 'IDLE_ON_MODEL' ? 'IDLE_ON_CANVAS' : 'IDLE_ON_MODEL';
        this.nextState = null;
        console.log(`FluidDirector: Interrupted. Reverting to state: ${this.currentState}`);
    },

    stop() {
        if (!this.activeScript) return;
        
        const finishedScript = this.activeScript;
        this.activeScript = null;
        
        if (this.nextState) {
            this.currentState = this.nextState;
            this.nextState = null;
        } else {
            this.currentState = 'IDLE_ON_CANVAS';
        }
        
        console.log(`FluidDirector: Transition '${finishedScript.id}' complete. New state: ${this.currentState}`);
        
        if(this.app.UIManager) this.app.UIManager.setFluidControlsDisabled(false);
    },

    update() {
        if (!this.activeScript) return;

        const CM = this.app.ComputeManager;
        if (!CM || !CM.gpuCompute) {
            this.stop();
            return;
        }

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