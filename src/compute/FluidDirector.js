import THREE from '../three-singleton.js';

/*
================================================================================================
FLUID SIMULATION DIRECTOR
================================================================================================
This module is the "Conductor" for all fluid-based artistic transitions.
It manages timelines and tells the FluidSimulationContainer which forces to apply and when.
*/

export const FluidDirector = {
    app: null,
    activeScript: null, // The currently running animation script

    currentState: 'IDLE_ON_CANVAS', // 'IDLE_ON_CANVAS', 'ANIMATING_TO_MODEL', 'IDLE_ON_MODEL', 'ANIMATING_TO_CANVAS'
    nextState: null, // Stores the target state after an animation finishes.

    scripts: {
        'meltAndReform': {
            duration: 12000,
            forward(FSIM, progress, easedProgress) {
                if (!FSIM.velocityVariable || !this.app.ImagePlaneManager.fluidMaterial) return;
                
                const uniforms = FSIM.velocityVariable.material.uniforms;
                const renderUniforms = this.app.ImagePlaneManager.fluidMaterial.uniforms;
                
                const meltPhaseEnd = 0.4;
                if (progress < meltPhaseEnd) {
                    const meltProgress = progress / meltPhaseEnd;
                    uniforms.u_gravity.value.y = -9.8 * meltProgress; 
                    uniforms.u_pressureStrength.value = 1.0;          
                    uniforms.u_attractionStrength.value = 0.0;        
                    uniforms.u_targetState.value = 0;
                    renderUniforms.u_particleColorMix.value = 0.0;
                }
                
                const gatherPhaseEnd = 0.7;
                if (progress >= meltPhaseEnd && progress < gatherPhaseEnd) {
                    const gatherProgress = (progress - meltPhaseEnd) / (gatherPhaseEnd - meltPhaseEnd);
                    uniforms.u_gravity.value.y = THREE.MathUtils.lerp(-9.8, 0.0, gatherProgress); 
                    uniforms.u_pressureStrength.value = 1.0;                                     
                    uniforms.u_attractionStrength.value = THREE.MathUtils.lerp(0.0, 0.5, gatherProgress); 
                    uniforms.u_targetState.value = 1;
                    renderUniforms.u_particleColorMix.value = THREE.MathUtils.lerp(0.0, 1.0, gatherProgress);
                }

                if (progress >= gatherPhaseEnd) {
                    const reformProgress = (progress - gatherPhaseEnd) / (1.0 - gatherPhaseEnd);
                    uniforms.u_gravity.value.y = 0.0;                                                
                    uniforms.u_pressureStrength.value = THREE.MathUtils.lerp(1.0, 0.0, reformProgress); 
                    uniforms.u_attractionStrength.value = THREE.MathUtils.lerp(0.5, 2.0, reformProgress); 
                    uniforms.u_targetState.value = 1;
                    renderUniforms.u_particleColorMix.value = 1.0;
                }
            },
            reverse(FSIM, progress, easedProgress) {
                if (!FSIM.velocityVariable || !this.app.ImagePlaneManager.fluidMaterial) return;

                const uniforms = FSIM.velocityVariable.material.uniforms;
                const renderUniforms = this.app.ImagePlaneManager.fluidMaterial.uniforms;
                
                const dissolveEnd = 0.3;
                if (progress < dissolveEnd) {
                    const dissolveProgress = progress / dissolveEnd;
                    uniforms.u_gravity.value.y = 2.0 * dissolveProgress;
                    uniforms.u_pressureStrength.value = 1.5 * dissolveProgress;
                    uniforms.u_attractionStrength.value = 0.0;
                    uniforms.u_targetState.value = 1;
                    renderUniforms.u_particleColorMix.value = 1.0 - dissolveProgress;
                }

                const fallEnd = 0.7;
                if (progress >= dissolveEnd && progress < fallEnd) {
                    const fallProgress = (progress - dissolveEnd) / (fallEnd - dissolveEnd);
                    uniforms.u_gravity.value.y = THREE.MathUtils.lerp(2.0, -9.8, fallProgress);
                    uniforms.u_pressureStrength.value = 1.5;
                    uniforms.u_attractionStrength.value = 0.0;
                    uniforms.u_targetState.value = 0;
                }

                if (progress >= fallEnd) {
                    const settleProgress = (progress - fallEnd) / (1.0 - fallEnd);
                    uniforms.u_gravity.value.y = THREE.MathUtils.lerp(-9.8, 0.0, settleProgress);
                    uniforms.u_pressureStrength.value = THREE.MathUtils.lerp(1.5, 0.0, settleProgress);
                    uniforms.u_attractionStrength.value = THREE.MathUtils.lerp(0.0, 2.0, settleProgress);
                    uniforms.u_targetState.value = 0;
                }
            }
        },
        'explosion': {
            duration: 8000,
            forward(FSIM, progress, easedProgress) {
                if (!FSIM.velocityVariable) return;
                const uniforms = FSIM.velocityVariable.material.uniforms;
                
                const explosionEnd = 0.4;
                if (progress < explosionEnd) {
                    const explosionProgress = progress / explosionEnd;
                    const shockwave = Math.sin(explosionProgress * Math.PI);
                    uniforms.u_explosionStrength.value = 20.0 * shockwave;
                    uniforms.u_pressureStrength.value = 2.0 * shockwave;
                    uniforms.u_attractionStrength.value = 0.0;
                }

                if (progress >= explosionEnd) {
                    const reassembleProgress = (progress - explosionEnd) / (1.0 - explosionEnd);
                    uniforms.u_explosionStrength.value = 0.0;
                    uniforms.u_pressureStrength.value = 0.0;
                    uniforms.u_attractionStrength.value = 2.5 * reassembleProgress;
                    uniforms.u_targetState.value = 1;
                    if (this.app.ImagePlaneManager.fluidMaterial) {
                        this.app.ImagePlaneManager.fluidMaterial.uniforms.u_particleColorMix.value = reassembleProgress;
                    }
                }
            },
            reverse(FSIM, progress, easedProgress) {
                if (!FSIM.velocityVariable) return;
                const uniforms = FSIM.velocityVariable.material.uniforms;
                uniforms.u_attractionStrength.value = 2.0 * easedProgress;
                uniforms.u_pressureStrength.value = 0.0;
                uniforms.u_targetState.value = 0;
                if (this.app.ImagePlaneManager.fluidMaterial) {
                    this.app.ImagePlaneManager.fluidMaterial.uniforms.u_particleColorMix.value = 1.0 - easedProgress;
                }
            }
        },
        'vortex': {
            duration: 10000,
            forward(FSIM, progress, easedProgress) {
                if (!FSIM.velocityVariable) return;
                const uniforms = FSIM.velocityVariable.material.uniforms;

                const vortexCurve = Math.sin(progress * Math.PI);
                uniforms.u_vortexStrength.value = 15.0 * vortexCurve;
                uniforms.u_gravity.value.y = 5.0 * vortexCurve;
                
                uniforms.u_attractionStrength.value = 2.0 * easedProgress;
                uniforms.u_targetState.value = 1;

                if (this.app.ImagePlaneManager.fluidMaterial) {
                    this.app.ImagePlaneManager.fluidMaterial.uniforms.u_particleColorMix.value = easedProgress;
                }
            },
            reverse(FSIM, progress, easedProgress) {
                if (!FSIM.velocityVariable) return;
                const uniforms = FSIM.velocityVariable.material.uniforms;
                uniforms.u_attractionStrength.value = 2.0 * easedProgress;
                uniforms.u_pressureStrength.value = 0.0;
                uniforms.u_targetState.value = 0;
                if (this.app.ImagePlaneManager.fluidMaterial) {
                    this.app.ImagePlaneManager.fluidMaterial.uniforms.u_particleColorMix.value = 1.0 - easedProgress;
                }
            }
        },
        'reset': {
            duration: 4000,
            update(FSIM, progress, easedProgress) {
                if (!FSIM.velocityVariable) return;
                const uniforms = FSIM.velocityVariable.material.uniforms;

                uniforms.u_attractionStrength.value = 2.5 * easedProgress;
                uniforms.u_pressureStrength.value = 0.0;
                uniforms.u_targetState.value = 0;
                
                if (this.app.ImagePlaneManager.fluidMaterial) {
                    const renderUniforms = this.app.ImagePlaneManager.fluidMaterial.uniforms;
                    renderUniforms.u_particleColorMix.value = THREE.MathUtils.lerp(renderUniforms.u_particleColorMix.value, 0.0, 0.1);
                }
            }
        }
    },

    init(appInstance) {
        this.app = appInstance;
    },
    
    // ** THE FIX IS HERE: The run() logic has been completely rewritten for clarity and correctness. **
    run(scriptId = 'meltAndReform') {
        if (this.currentState.startsWith('ANIMATING')) {
            console.warn("FluidDirector: Animation already in progress.");
            return;
        }

        const FSIM = this.app.FluidSimulationContainer;
        const script = this.scripts[scriptId];

        if (!script) {
            console.warn(`FluidDirector: Script "${scriptId}" not found.`);
            return;
        }
        if (!FSIM || !FSIM.gpuCompute || !FSIM.velocityVariable) {
            console.error("FluidDirector cannot run: FluidSimulationContainer is not ready.");
            return;
        }

        let animationFunction;
        let nextIdleState;
        let newAnimatingState;

        if (scriptId === 'reset') {
            if (this.currentState === 'IDLE_ON_CANVAS') return; // Already home
            animationFunction = script.update;
            newAnimatingState = 'ANIMATING_TO_CANVAS';
            nextIdleState = 'IDLE_ON_CANVAS';
            console.log(`FluidDirector: Running RESET animation.`);
        } else {
            if (this.currentState === 'IDLE_ON_CANVAS') {
                animationFunction = script.forward;
                newAnimatingState = 'ANIMATING_TO_MODEL';
                nextIdleState = 'IDLE_ON_MODEL';
                console.log(`FluidDirector: Running FORWARD animation for '${scriptId}'`);
            } else { // Assumes 'IDLE_ON_MODEL'
                animationFunction = script.reverse;
                newAnimatingState = 'ANIMATING_TO_CANVAS';
                nextIdleState = 'IDLE_ON_CANVAS';
                console.log(`FluidDirector: Running REVERSE animation for '${scriptId}'`);
            }
        }

        if (animationFunction) {
            this.currentState = newAnimatingState;
            this.nextState = nextIdleState;
            
            FSIM.startPhysics();
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
        
        const FSIM = this.app.FluidSimulationContainer;
        if (FSIM && FSIM.gpuCompute) {
            if (FSIM.velocityVariable) {
                const uniforms = FSIM.velocityVariable.material.uniforms;
                uniforms.u_explosionStrength.value = 0.0;
                uniforms.u_vortexStrength.value = 0.0;
                uniforms.u_gravity.value.y = 0.0;
                uniforms.u_pressureStrength.value = 0.0;
            }
            
            if(this.app.UIManager) this.app.UIManager.setFluidControlsDisabled(false);
            
            this.currentState = this.nextState || 'IDLE_ON_CANVAS';
            this.nextState = null;
        }
    },

    stop() {
        this.activeScript = null;
        
        const FSIM = this.app.FluidSimulationContainer;
        if (FSIM && FSIM.gpuCompute) {
            if (FSIM.velocityVariable) {
                const uniforms = FSIM.velocityVariable.material.uniforms;
                uniforms.u_explosionStrength.value = 0.0;
                uniforms.u_vortexStrength.value = 0.0;
                uniforms.u_gravity.value.y = 0.0;
            }
            
            if (this.nextState) {
                this.currentState = this.nextState;
                this.nextState = null;
            } else {
                this.currentState = 'IDLE_ON_CANVAS';
            }
            console.log(`FluidDirector: Transition complete. New state: ${this.currentState}`);

            FSIM.stopPhysics();
            if(this.app.UIManager) this.app.UIManager.setFluidControlsDisabled(false);
        }
    },

    update() {
        if (!this.activeScript) {
            return;
        }

        const FSIM = this.app.FluidSimulationContainer;
        if (!FSIM || !FSIM.gpuCompute) {
            this.stop();
            return;
        }

        const elapsedTime = this.app.currentTime - this.activeScript.startTime;
        let progress = Math.min(1.0, elapsedTime / this.activeScript.duration);
        
        const easedProgress = progress < 0.5 
            ? 4 * progress * progress * progress 
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        
        this.activeScript.update(FSIM, progress, easedProgress);

        if (progress >= 1.0) {
            this.stop();
        }
    }
};