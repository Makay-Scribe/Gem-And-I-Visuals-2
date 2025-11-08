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
            duration: 12000,
            forward(CM, progress, easedProgress) {
                if (!CM.velocityVariable || !this.app.ImagePlaneManager.fluidMaterial) return;
                const uniforms = CM.velocityVariable.material.uniforms;
                const renderUniforms = this.app.ImagePlaneManager.fluidMaterial.uniforms;

                // ACT I: Breakup (0.0 -> 0.4) - Particles start melting downwards
                const meltProgress = Math.min(1.0, progress / 0.4);
                uniforms.u_gravity.value.y = -9.8 * meltProgress;
                uniforms.fluid_attractionStrength.value = 0.0;
                uniforms.u_targetState.value = 0; // Still targeting the canvas
                
                // ACT II: Chaos (0.4 -> 0.7) - Gravity fades, attraction to model begins
                if (progress > 0.4) {
                    const gatherProgress = Math.min(1.0, (progress - 0.4) / 0.3);
                    uniforms.u_gravity.value.y = THREE.MathUtils.lerp(-9.8, 0.0, gatherProgress);
                    uniforms.u_targetState.value = 1; // Switch target to the 3D model
                    uniforms.fluid_attractionStrength.value = THREE.MathUtils.lerp(0.0, 0.5, gatherProgress);
                    renderUniforms.u_particleColorMix.value = gatherProgress;
                }

                // ACT III: Reform (0.7 -> 1.0) - Strong attraction to finalize on model
                if (progress > 0.7) {
                    const reformProgress = (progress - 0.7) / 0.3;
                    uniforms.fluid_attractionStrength.value = THREE.MathUtils.lerp(0.5, 3.0, reformProgress);
                }
            },
            reverse(CM, progress, easedProgress) {
                if (!CM.velocityVariable || !this.app.ImagePlaneManager.fluidMaterial) return;
                const uniforms = CM.velocityVariable.material.uniforms;
                const renderUniforms = this.app.ImagePlaneManager.fluidMaterial.uniforms;

                // ACT I: Breakup (0.0 -> 0.3) - Particles dissolve and float up slightly
                const dissolveProgress = Math.min(1.0, progress / 0.3);
                uniforms.u_gravity.value.y = 2.0 * dissolveProgress;
                uniforms.fluid_attractionStrength.value = 0.0;
                uniforms.u_targetState.value = 1; // Still targeting the model
                renderUniforms.u_particleColorMix.value = 1.0 - dissolveProgress;

                // ACT II: Chaos (0.3 -> 0.7) - Gravity reverses to pull particles down
                if (progress > 0.3) {
                    const fallProgress = Math.min(1.0, (progress - 0.3) / 0.4);
                    uniforms.u_gravity.value.y = THREE.MathUtils.lerp(2.0, -9.8, fallProgress);
                    uniforms.u_targetState.value = 0; // Switch target back to canvas
                }

                // ACT III: Reform (0.7 -> 1.0) - Gravity fades, strong attraction to canvas
                if (progress > 0.7) {
                    const settleProgress = (progress - 0.7) / 0.3;
                    uniforms.u_gravity.value.y = THREE.MathUtils.lerp(-9.8, 0.0, settleProgress);
                    uniforms.fluid_attractionStrength.value = THREE.MathUtils.lerp(0.0, 3.0, settleProgress);
                }
            }
        },
        'explosion': {
            duration: 8000,
            forward(CM, progress, easedProgress) {
                if (!CM.velocityVariable || !this.app.ImagePlaneManager.fluidMaterial) return;
                const uniforms = CM.velocityVariable.material.uniforms;
                const renderUniforms = this.app.ImagePlaneManager.fluidMaterial.uniforms;
                
                // ACT I & II: Breakup & Chaos (0.0 -> 0.7) - A single shockwave pulse
                const shockwaveProgress = Math.min(1.0, progress / 0.7);
                const shockwave = Math.sin(shockwaveProgress * Math.PI); // A single curve up and down
                uniforms.u_explosionStrength.value = 50.0 * shockwave;
                uniforms.fluid_attractionStrength.value = 0.0;

                // ACT III: Reform (0.5 -> 1.0) - Strong attraction to model
                if (progress > 0.5) {
                    const reassembleProgress = (progress - 0.5) / 0.5;
                    uniforms.u_targetState.value = 1;
                    uniforms.fluid_attractionStrength.value = 3.0 * reassembleProgress;
                    renderUniforms.u_particleColorMix.value = reassembleProgress;
                }
            },
            reverse(CM, progress, easedProgress) {
                if (!CM.velocityVariable || !this.app.ImagePlaneManager.fluidMaterial) return;
                const uniforms = CM.velocityVariable.material.uniforms;
                const renderUniforms = this.app.ImagePlaneManager.fluidMaterial.uniforms;

                uniforms.u_targetState.value = 0;
                uniforms.fluid_attractionStrength.value = 3.0 * easedProgress;
                renderUniforms.u_particleColorMix.value = 1.0 - easedProgress;
            }
        },
        'vortex': {
            duration: 10000,
            forward(CM, progress, easedProgress) {
                if (!CM.velocityVariable || !this.app.ImagePlaneManager.fluidMaterial) return;
                const uniforms = CM.velocityVariable.material.uniforms;
                const renderUniforms = this.app.ImagePlaneManager.fluidMaterial.uniforms;

                // ACT I & II: Breakup & Chaos (0.0 -> 0.8) - Vortex ramps up and then down
                const vortexProgress = Math.min(1.0, progress / 0.8);
                const vortexCurve = Math.sin(vortexProgress * Math.PI);
                uniforms.u_vortexStrength.value = 15.0 * vortexCurve;
                uniforms.u_gravity.value.y = 5.0 * vortexCurve;
                uniforms.fluid_attractionStrength.value = 0.0;

                // ACT III: Reform (0.6 -> 1.0) - Strong attraction to model
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

                // ACT I & II: Breakup & Chaos (0.0 -> 0.8) - Curl noise ramps up and then down
                const swirlProgress = Math.min(1.0, progress / 0.8);
                const swirlCurve = Math.sin(swirlProgress * Math.PI);
                uniforms.fluid_curlStrength.value = 5.0 * swirlCurve;
                uniforms.fluid_curlScale.value = 0.05;
                uniforms.fluid_curlSpeed.value = 0.5;
                uniforms.fluid_attractionStrength.value = 0.0;

                // ACT III: Reform (0.6 -> 1.0) - Strong attraction to model
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

                // ACT I & II: Breakup & Chaos (0.0 -> 0.8) - Swirl away from the model
                const chaosProgress = Math.min(1.0, progress / 0.8);
                const chaosCurve = Math.sin(chaosProgress * Math.PI);
                uniforms.fluid_curlStrength.value = 5.0 * chaosCurve;
                uniforms.fluid_curlScale.value = 0.05;
                uniforms.fluid_curlSpeed.value = 0.5;
                uniforms.fluid_attractionStrength.value = 0.0;

                // ACT III: Reform (0.6 -> 1.0) - Strong attraction back to canvas
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
        
        // This now calls the dedicated reset helper in ComputeManager
        CM._resetFluidUniforms();
    },

    run(scriptId = 'meltAndReform') {
        console.log(`FluidDirector: Attempting to run '${scriptId}'. Current state: ${this.currentState}.`);
        
        if (this.currentState.startsWith('ANIMATING')) {
            console.warn("FluidDirector: Animation already in progress. Vetoing run command.");
            return;
        }
        
        const modelReady = this.app.isDefaultSculptureBaked;
        console.log(`FluidDirector: Model Texture Ready: ${modelReady}.`);

        const CM = this.app.ComputeManager;
        const script = this.scripts[scriptId];

        if (!script || !CM || !CM.gpuCompute || !CM.velocityVariable) {
            console.error("FluidDirector cannot run: Compute Manager or script is not ready.");
            return;
        }

        let animationFunction;
        let nextIdleState;
        let newAnimatingState;

        const isCurrentlyOnCanvas = this.currentState === 'IDLE_ON_CANVAS';
        const isCurrentlyOnModel = this.currentState === 'IDLE_ON_MODEL';
        
        if (scriptId === 'reset') {
            if (isCurrentlyOnCanvas) {
                console.log("FluidDirector: Already on canvas, RESET unnecessary.");
                return;
            }
            animationFunction = script.update;
            newAnimatingState = 'ANIMATING_TO_CANVAS';
            nextIdleState = 'IDLE_ON_CANVAS';
        } else {
            if (isCurrentlyOnCanvas) {
                if (!modelReady) {
                     this.app.UIManager.logError("Cannot transition to 3D Model. Please load and 'Bake' a GLB model first.");
                     console.error("FluidDirector: Vetoed forward transition, 3D Model has not been baked.");
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
            else {
                console.error(`FluidDirector: Cannot start transition. Invalid current state: ${this.currentState}`);
                return;
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
                update: animationFunction.bind(this)
            };
            if(this.app.UIManager) this.app.UIManager.setFluidControlsDisabled(true);
        } else {
             console.error(`FluidDirector: Could not determine an animation function to run for script '${scriptId}' from state '${this.currentState}'.`);
        }
    },
    
    interruptAndStop() {
        if (!this.activeScript) return;
        console.log("FluidDirector: Animation interrupted by user.");
        this.activeScript = null;
        this._resetUniforms();
        
        const CM = this.app.ComputeManager;
        if (CM) {
            if(this.app.UIManager) this.app.UIManager.setFluidControlsDisabled(false);
            this.currentState = this.nextState || 'IDLE_ON_CANVAS';
            this.nextState = null;
        }
    },

    stop() {
        this.activeScript = null;
        this._resetUniforms();

        const CM = this.app.ComputeManager;
        if (CM) {
            if (this.nextState) {
                this.currentState = this.nextState;
                this.nextState = null;
            } else {
                this.currentState = 'IDLE_ON_CANVAS';
            }
            
            console.log(`FluidDirector: Transition complete. New state: ${this.currentState}`);
            
            if(this.app.UIManager) this.app.UIManager.setFluidControlsDisabled(false);
        }
    },

    update() {
        if (!this.activeScript) return;

        const CM = this.app.ComputeManager;
        if (!CM || !CM.gpuCompute) {
            this.stop();
            return;
        }

        const elapsedTime = this.app.currentTime - this.activeScript.startTime;
        let progress = Math.min(1.0, elapsedTime / this.activeScript.duration);
        
        const easedProgress = 0.5 - 0.5 * Math.cos(progress * Math.PI);
        
        this.activeScript.update(CM, progress, easedProgress);

        if (progress >= 1.0) {
            this.stop();
        }
    }
};