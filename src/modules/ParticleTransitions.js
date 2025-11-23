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
            duration: 4000, 
            particle_flowStrength: 0.2,
            particle_flowSpeed: 0.2,
            particle_flowScale: 0.1,
            particle_attractionStrength: 5.0, 
            particle_size_mix: 0.0,
            particle_twinkleIntensity: 0.0,
        },
        'pour': {
            duration: 8000,
            particle_flowStrength: 2.0,
            particle_flowSpeed: 0.5,
            particle_flowScale: 0.2,
            particle_attractionStrength: 3.0,
        },
        'liquid': {
            duration: 8000,
            particle_flowStrength: 1.0,
            particle_flowSpeed: 0.2,
            particle_flowScale: 0.05,
            particle_attractionStrength: 8.0,
        },
        'explode': {
            duration: 15000,
            particle_flowStrength: 8.0,
            particle_flowSpeed: 2.0,
            particle_flowScale: 0.5,
            particle_attractionStrength: 0.1,
        },
        'nebula': {
            duration: 20000,
            particle_flowStrength: 0.5,
            particle_flowSpeed: 0.1,
            particle_flowScale: 0.02,
            particle_attractionStrength: 2.0,
            particle_twinkleIntensity: 1.0,
        },
        'melt': {
            duration: 10000,
            particle_flowStrength: 0.5,
            particle_flowSpeed: 0.1,
            particle_attractionStrength: 1.0, 
        },
        'supernova': {
            duration: 15000,
            particle_flowStrength: 15.0,
            particle_flowSpeed: 3.0,
            particle_attractionStrength: 0.0,
            particle_twinkleIntensity: 1.0,
        },
        'gravity_well': {
            duration: 15000,
            particle_flowStrength: 0.2,
            particle_attractionStrength: 10.0,
        },
        'cosmic_dust': {
            duration: 12000,
            particle_flowStrength: 0.5,
            particle_flowScale: 0.8,
            particle_attractionStrength: 0.5,
            particle_size_mix: 1.0,
        },
        'dissolve': {
            duration: 8000,
            particle_flowStrength: 1.5,
            particle_flowSpeed: 1.0,
            particle_attractionStrength: 0.0,
        },
        'swarm': {
            duration: 12000,
            particle_flowStrength: 5.0,
            particle_flowSpeed: 4.0,
            particle_flowScale: 0.1,
            particle_attractionStrength: 5.0,
        },
        
        // --- THE CHAOS EXPERIMENT ---
        'flow': {
            duration: 12000,
            particle_flowStrength: 0.0, // Will be overridden in update()
            particle_flowSpeed: 0.0,
            particle_flowScale: 0.5, 
            particle_attractionStrength: 0.0,
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
        
        let endValue;
        if (startValue < 0.5) {
            endValue = 0.95;
        } else {
            endValue = 0.0;
        }

        const targetPresetId = (endValue > 0.5) ? this.activeTransitionPreset : 'default';
        
        if (!this.transitionPresets[targetPresetId]) {
            console.error(`Attempted to run transition with undefined preset: ${targetPresetId}`);
            return;
        }
        
        const targetPreset = this.transitionPresets[targetPresetId];
        const defaultPreset = this.transitionPresets['default'];

        const duration = targetPreset.duration || 4000;

        this.transitionAnimation = {
            startTime: performance.now(),
            startValue,
            endValue,
            duration,
            presetId: targetPresetId,
            startParams: {},
            targetParams: {}
        };

        Object.keys(defaultPreset).forEach(key => {
            if (key !== 'duration') {
                this.transitionAnimation.startParams[key] = S[key];
                this.transitionAnimation.targetParams[key] = (targetPreset[key] !== undefined) ? targetPreset[key] : defaultPreset[key];
            }
        });
        
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

        const ease = 1 - Math.pow(1 - progress, 4); 
        
        S.particle_morphProgress = this.app.THREE.MathUtils.lerp(anim.startValue, anim.endValue, ease);
        if (this.app.UIManager) this.app.UIManager.handleMorphSlider(S.particle_morphProgress);

        // Standard Interpolation for most presets
        if (anim.presetId !== 'flow') {
            Object.keys(anim.targetParams).forEach(key => {
                if (S[key] !== undefined && key.startsWith('particle_')) {
                    S[key] = this.app.THREE.MathUtils.lerp(anim.startParams[key], anim.targetParams[key], ease);
                }
            });
        }

        if(CM.velocityVariable) {
            
            // --- CUSTOM LOGIC FOR EXISTING PRESETS ---
            if (anim.presetId === 'explode' || anim.presetId === 'supernova') {
                const bellCurve = Math.sin(progress * Math.PI); 
                const peakFlow = (anim.presetId === 'supernova') ? 20.0 : 10.0;
                S.particle_flowStrength = this.app.THREE.MathUtils.lerp(anim.startParams.particle_flowStrength, peakFlow, bellCurve);
                
                const attractionDelay = 0.7;
                const attractionProgress = Math.max(0.0, (progress - attractionDelay) / (1.0 - attractionDelay));
                S.particle_attractionStrength = this.app.THREE.MathUtils.lerp(0.1, 40.0, attractionProgress * attractionProgress);
            }
            
            else if (anim.presetId === 'gravity_well') {
                const turbulencePhase = Math.min(1.0, progress / 0.5);
                S.particle_flowStrength = this.app.THREE.MathUtils.lerp(0.2, 4.0, Math.sin(turbulencePhase * Math.PI));
                
                const snapDelay = 0.75;
                if (progress > snapDelay) {
                    const snapProgress = (progress - snapDelay) / (1.0 - snapDelay);
                    S.particle_attractionStrength = this.app.THREE.MathUtils.lerp(0.0, 50.0, snapProgress * snapProgress); 
                } else {
                    S.particle_attractionStrength = 0.0;
                }
            }

            // --- THE CHAOS EXPERIMENT (PRESET: FLOW) ---
            else if (anim.presetId === 'flow') {
                
                // PHASE 1: REPULSION (0% - 20%)
                // Blast particles outwards aggressively
                if (progress < 0.2) {
                    // Negative attraction = Repulsion
                    S.particle_attractionStrength = -20.0; 
                    // High boiling noise
                    S.particle_flowStrength = 50.0;
                    S.particle_flowSpeed = 10.0;
                }
                // PHASE 2: THE BLENDER (20% - 60%)
                // Let them cook in the noise field
                else if (progress < 0.6) {
                    S.particle_attractionStrength = 0.0; // No homing
                    S.particle_flowStrength = 50.0;      // Max Chaos
                    S.particle_flowSpeed = 5.0;
                }
                // PHASE 3: THE VACUUM (60% - 100%)
                // Suck them back in
                else {
                    const snapProgress = (progress - 0.6) / 0.4;
                    // Ease out the chaos
                    S.particle_flowStrength = this.app.THREE.MathUtils.lerp(50.0, 0.0, snapProgress);
                    // Ramp up the magnet
                    S.particle_attractionStrength = this.app.THREE.MathUtils.lerp(0.0, 100.0, snapProgress * snapProgress);
                }
            }
        }

        if (this.app.UIManager) this.app.UIManager.syncSlidersToSettings();

        if (progress >= 1) {
            Object.keys(anim.targetParams).forEach(key => {
                S[key] = anim.targetParams[key];
            });
            S.particle_morphProgress = anim.endValue;
            
            if (this.app.UIManager) {
                this.app.UIManager.enableParticleSliders();
                this.app.UIManager.syncSlidersToSettings();
            }
            this.transitionAnimation = null;
        }
    }
};