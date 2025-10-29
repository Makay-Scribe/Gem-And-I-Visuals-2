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

    // --- Scripts (The "Sheet Music") ---
    // Each script is an object with an `update` function that gets called every frame.
    // The `update` function is responsible for calculating the shader uniforms based on time.
    scripts: {
        'default': {
            // The "at rest" state. No forces active.
            update(FSIM, progress, easedProgress) {
                const uniforms = FSIM.velocityVariable.material.uniforms;
                uniforms.u_attractionStrength.value = 0.0;
                uniforms.u_pressureStrength.value = 0.0;
                uniforms.u_gravity.value.y = 0.0;
                
                // Also reset color mix in the render material
                if (this.app.ImagePlaneManager.fluidMaterial) {
                    this.app.ImagePlaneManager.fluidMaterial.uniforms.u_particleColorMix.value = 0.0;
                }
            }
        },

        'meltAndReform': {
            duration: 12000, // 12 seconds for the full animation
            update(FSIM, progress, easedProgress) {
                const uniforms = FSIM.velocityVariable.material.uniforms;
                const renderUniforms = this.app.ImagePlaneManager.fluidMaterial.uniforms;
                
                // Phase 1: Melt (First 40% of the animation)
                const meltPhaseEnd = 0.4;
                if (progress < meltPhaseEnd) {
                    const meltProgress = progress / meltPhaseEnd;
                    uniforms.u_gravity.value.y = -9.8 * meltProgress; 
                    uniforms.u_pressureStrength.value = 1.0;          
                    uniforms.u_attractionStrength.value = 0.0;        
                    uniforms.u_targetState.value = 0; // Target is the canvas
                    renderUniforms.u_particleColorMix.value = 0.0; // Color is the canvas
                }
                
                // Phase 2: Gather (Next 30% of the animation)
                const gatherPhaseEnd = 0.7;
                if (progress >= meltPhaseEnd && progress < gatherPhaseEnd) {
                    const gatherProgress = (progress - meltPhaseEnd) / (gatherPhaseEnd - meltPhaseEnd);
                    uniforms.u_gravity.value.y = THREE.MathUtils.lerp(-9.8, 0.0, gatherProgress); 
                    uniforms.u_pressureStrength.value = 1.0;                                     
                    uniforms.u_attractionStrength.value = THREE.MathUtils.lerp(0.0, 0.5, gatherProgress); 
                    uniforms.u_targetState.value = 1; // Target is now the 3D model
                    
                    // ** THE FIX IS HERE: Start fading in the model color **
                    renderUniforms.u_particleColorMix.value = THREE.MathUtils.lerp(0.0, 1.0, gatherProgress);
                }

                // Phase 3: Reform (Final 30% of the animation)
                if (progress >= gatherPhaseEnd) {
                    const reformProgress = (progress - gatherPhaseEnd) / (1.0 - gatherPhaseEnd);
                    uniforms.u_gravity.value.y = 0.0;                                                
                    uniforms.u_pressureStrength.value = THREE.MathUtils.lerp(1.0, 0.0, reformProgress); 
                    uniforms.u_attractionStrength.value = THREE.MathUtils.lerp(0.5, 2.0, reformProgress); 
                    uniforms.u_targetState.value = 1; // Target is the 3D model
                    
                    // ** THE FIX IS HERE: Ensure the model color is fully visible **
                    renderUniforms.u_particleColorMix.value = 1.0;
                }
            }
        }
    },

    init(appInstance) {
        this.app = appInstance;
    },
    
    // Called by UIManager when a preset button is clicked
    run(scriptId = 'default') {
        const FSIM = this.app.FluidSimulationContainer;
        const IPM = this.app.ImagePlaneManager;

        if (!this.scripts[scriptId]) {
            console.warn(`FluidDirector: Script "${scriptId}" not found.`);
            return;
        }
        
        // Safety checks
        if (!FSIM || !FSIM.gpuCompute || !FSIM.velocityVariable) {
            console.error("FluidDirector cannot run: FluidSimulationContainer is not ready.");
            return;
        }
        if (!IPM || !IPM.fluidMaterial) {
            console.error("FluidDirector cannot run: Fluid render material is not ready.");
            return;
        }


        this.activeScript = {
            id: scriptId,
            startTime: this.app.currentTime,
            duration: this.scripts[scriptId].duration || 1000, // Default 1s duration
            update: this.scripts[scriptId].update.bind(this) // Bind 'this' to access this.app
        };
    },

    stop() {
        this.activeScript = null;
        // Immediately apply the default "at rest" script to reset all forces
        this.scripts['default'].update.call(this, this.app.FluidSimulationContainer, 1, 1);
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
        
        // Use an ease-in-out function for smooth acceleration and deceleration
        const easedProgress = progress < 0.5 
            ? 4 * progress * progress * progress 
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        
        // Call the update function of the currently active script
        this.activeScript.update(FSIM, progress, easedProgress);

        // If the animation is finished, stop the script
        if (progress >= 1.0) {
            this.activeScript = null;
            // Optionally, you could chain scripts here in the future
        }
    }
};