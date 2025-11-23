/*
================================================================================================
PARTICLE TRANSITION MANAGER
================================================================================================
Handles the tweening of particle parameters to create effects like "Explode", "Nebula", etc.
Refactored to only support the Unified Particle System.
*/

export const ParticleTransitions = {
    app: null,

    // --- State ---
    transitionAnimation: null,
    activeTransitionPreset: 'default',

    // --- Presets ---
    transitionPresets: {
        'default': {
            particle_flowStrength: 0.0,
            particle_flowSpeed: 0.0,
            particle_flowScale: 0.1,
            particle_attractionStrength: 0.1,
            particle_size_mix: 0.0,
            particle_twinkleIntensity: 0.0,
        },
        'pour': {
            particle_flowStrength: 2.0,
            particle_flowSpeed: 0.5,
            particle_flowScale: 0.2,
            particle_attractionStrength: 0.05,
        },
        'liquid': {
            particle_flowStrength: 1.0,
            particle_flowSpeed: 0.2,
            particle_flowScale: 0.05,
            particle_attractionStrength: 0.2,
        },
        'explode': {
            particle_flowStrength: 5.0,
            particle_flowSpeed: 2.0,
            particle_flowScale: 0.5,
            particle_attractionStrength: 0.01,
        },
        'nebula': {
            particle_flowStrength: 0.5,
            particle_flowSpeed: 0.1,
            particle_flowScale: 0.02,
            particle_attractionStrength: 0.05,
            particle_twinkleIntensity: 1.0,
        },
        'melt': {
            particle_flowStrength: 0.2,
            particle_flowSpeed: 0.1,
            particle_attractionStrength: 0.0, // Let them drift
        },
        'supernova': {
            particle_flowStrength: 8.0,
            particle_flowSpeed: 3.0,
            particle_attractionStrength: 0.0,
            particle_twinkleIntensity: 1.0,
        },
        'gravity_well': {
            // Placeholder for orbital logic
            particle_flowStrength: 0.2,
            particle_attractionStrength: 0.5,
        },
        'cosmic_dust': {
            particle_flowStrength: 0.5,
            particle_flowScale: 0.8,
            particle_attractionStrength: 0.01,
            particle_size_mix: 1.0,
        },
        'dissolve': {
            particle_flowStrength: 1.5,
            particle_flowSpeed: 1.0,
            particle_attractionStrength: 0.0,
        },
        'swarm': {
            particle_flowStrength: 3.0,
            particle_flowSpeed: 4.0,
            particle_flowScale: 0.1,
            particle_attractionStrength: 0.1,
        },
        'flow': {
            particle_flowStrength: 1.0,
            particle_flowSpeed: 0.5,
            particle_flowScale: 0.01,
            particle_attractionStrength: 0.05,
        }
    },

    init(appInstance) {
        this.app = appInstance;
    },

    setActivePreset(presetId) {
        if (this.transitionPresets[presetId]) {
            this.activeTransitionPreset = presetId;
        } else {
            console.warn(`Attempted to set non-existent preset: ${presetId}`);
        }
    },

    run() {
        if (this.transitionAnimation) return;

        const S = this.app.vizSettings;
        const startValue = S.particle_morphProgress;

        // Toggle direction
        let endValue;
        if (startValue < 0.5) {
            endValue = 0.95;
        } else {
            endValue = 0.0;
        }

        const duration = (this.activeTransitionPreset === 'pour' || this.activeTransitionPreset === 'melt') ? 7000 : 4000;

        // If returning to canvas (0.0), force 'default' preset behavior at the end
        // If going to model (1.0), use the active creative preset
        const targetPresetId = (endValue > 0.5) ? this.activeTransitionPreset : 'default';

        if (!this.transitionPresets[targetPresetId]) {
            console.error(`Attempted to run transition with undefined preset: ${targetPresetId}`);
            return;
        }

        const targetPreset = this.transitionPresets[targetPresetId];
        const defaultPreset = this.transitionPresets['default'];

        this.transitionAnimation = {
            startTime: performance.now(),
            startValue,
            endValue,
            duration,
            presetId: this.activeTransitionPreset,
            startParams: {},
            targetParams: {}
        };

        // Capture current state and determine target state
        Object.keys(defaultPreset).forEach(key => {
            this.transitionAnimation.startParams[key] = S[key];
            this.transitionAnimation.targetParams[key] = (targetPreset[key] !== undefined) ? targetPreset[key] : defaultPreset[key];
        });

        // Directional overrides
        this.transitionAnimation.targetParams.particle_size_mix = (endValue > 0.5) ? 0.75 : 0.0;
        this.transitionAnimation.targetParams.particle_twinkleIntensity = (endValue > 0.5) ? 0.5 : 0.0;

        if (this.app.UIManager) this.app.UIManager.disableParticleSliders();
    },

    interrupt() {
        if (this.transitionAnimation) {
            this.transitionAnimation = null;
            if (this.app.UIManager) this.app.UIManager.enableParticleSliders();
        }
    },

    update() {
        if (!this.transitionAnimation) return;

        const now = performance.now();
        const anim = this.transitionAnimation;
        const elapsedTime = now - anim.startTime;
        let progress = Math.min(1.0, elapsedTime / anim.duration);

        const S = this.app.vizSettings;
        const CM = this.app.ComputeManager;

        const ease = 1 - Math.pow(1 - progress, 4); // Ease Out Quart

        // 1. Animate Morph Progress
        S.particle_morphProgress = this.app.THREE.MathUtils.lerp(anim.startValue, anim.endValue, ease);
        if (this.app.UIManager) this.app.UIManager.handleMorphSlider(S.particle_morphProgress);


        // 2. Animate Standard Parameters (Lerp)
        Object.keys(anim.targetParams).forEach(key => {
            if (S[key] !== undefined && key.startsWith('particle_')) {
                S[key] = this.app.THREE.MathUtils.lerp(anim.startParams[key], anim.targetParams[key], ease);
            }
        });

        // 3. Special Case Logic (Procedural Animation curves)
        if (CM.velocityVariable) {
            const pUniformsV = CM.velocityVariable.material.uniforms;

            if (anim.presetId === 'explode' || anim.presetId === 'supernova') {
                // Bell curve for flow strength (Explode in middle, settle at end)
                const bellCurve = Math.sin(progress * Math.PI);
                const peakFlow = (anim.presetId === 'supernova') ? 10.0 : 5.0;

                // Override the linear lerp for flowStrength
                S.particle_flowStrength = this.app.THREE.MathUtils.lerp(anim.startParams.particle_flowStrength, peakFlow, bellCurve);

                // Delay attraction until the explosion dissipates
                const attractionDelay = 0.6;
                const attractionProgress = Math.max(0.0, (progress - attractionDelay) / (1.0 - attractionDelay));
                S.particle_attractionStrength = this.app.THREE.MathUtils.lerp(0.01, anim.targetParams.particle_attractionStrength, attractionProgress);
            }

            else if (anim.presetId === 'gravity_well') {
                // Since we stripped the old SPH gravity well logic, we simulate it 
                // by manipulating the flow/attraction balance.

                // Phase 1: High Turbulence (Chaos)
                const turbulencePhase = Math.min(1.0, progress / 0.5);
                S.particle_flowStrength = this.app.THREE.MathUtils.lerp(0.2, 4.0, Math.sin(turbulencePhase * Math.PI));

                // Phase 2: Hard Snap (Orbit collapse)
                const snapDelay = 0.7;
                if (progress > snapDelay) {
                    const snapProgress = (progress - snapDelay) / (1.0 - snapDelay);
                    S.particle_attractionStrength = this.app.THREE.MathUtils.lerp(0.0, 1.5, snapProgress * snapProgress); // Exponential snap
                } else {
                    S.particle_attractionStrength = 0.0;
                }
            }
        }

        // Update UI Sliders visually
        if (this.app.UIManager) this.app.UIManager.syncSlidersToSettings();

        // 4. Cleanup
        if (progress >= 1) {
            // Snap to final values
            Object.keys(anim.targetParams).forEach(key => {
                S[key] = anim.targetParams[key];
            });
            S.particle_morphProgress = anim.endValue;

            // Reset specific shader overrides
            if (CM.velocityVariable) {
                const pUniformsV = CM.velocityVariable.material.uniforms;
                pUniformsV.u_gravityWellStrength.value = 0.0;
                pUniformsV.u_orbitalStrength.value = 0.0;
            }

            if (this.app.UIManager) {
                this.app.UIManager.enableParticleSliders();
                this.app.UIManager.syncSlidersToSettings();
            }
            this.transitionAnimation = null;
        }
    }
};