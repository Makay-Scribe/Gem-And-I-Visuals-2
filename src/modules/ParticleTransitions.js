export const ParticleTransitions = {
    app: null,
    transitionAnimation: null,
    activeTransitionPreset: 'default',

    transitionPresets: {
        'default': {
            duration: 2000, // Fast snap (2 seconds)
            particle_flowStrength: 0.1, // Low noise
            particle_flowSpeed: 0.1,
            particle_flowScale: 0.1,
            particle_attractionStrength: 5.0, // Strong snap (with new shader)
            particle_size_mix: 0.0,
            particle_twinkleIntensity: 0.0,
        },
        'pour': {
            duration: 8000,
            particle_flowStrength: 9.0,
            particle_flowSpeed: 9.5,
            particle_flowScale: 9.2,
            particle_attractionStrength: 9.5,
        },
        'liquid': {
            duration: 8000,
            particle_flowStrength: 1.0,
            particle_flowSpeed: 0.2,
            particle_flowScale: 0.05,
            particle_attractionStrength: 3.0,
        },
        'explode': {
            duration: 12000,
            particle_flowStrength: 8.0,
            particle_flowSpeed: 2.0,
            particle_flowScale: 0.5,
            particle_attractionStrength: 0.01,
        },
        'nebula': {
            duration: 20000,
            particle_flowStrength: 0.5,
            particle_flowSpeed: 0.1,
            particle_flowScale: 0.02,
            particle_attractionStrength: 0.5,
            particle_twinkleIntensity: 1.0,
        },
        'melt': {
            duration: 10000,
            particle_flowStrength: 0.5,
            particle_flowSpeed: 0.1,
            particle_attractionStrength: 0.5, 
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
            particle_attractionStrength: 15.0,
        },
        'cosmic_dust': {
            duration: 12000,
            particle_flowStrength: 0.5,
            particle_flowScale: 0.8,
            particle_attractionStrength: 0.2,
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
            particle_attractionStrength: 4.0,
        },
        'flow': {
            duration: 12000,
            particle_flowStrength: 0.0, 
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
        }
    },

    // UPDATED: Now accepts an override (e.g. 'default')
    run(presetOverride = null) {
        if (this.transitionAnimation) {
            this.interrupt(); // Auto-interrupt existing
        }

        const S = this.app.vizSettings;
        const startValue = S.particle_morphProgress;
        
        // Determine direction
        let endValue;
        if (startValue < 0.5) {
            endValue = 0.95; // Go to Model
        } else {
            endValue = 0.0; // Go to Canvas
        }

        // Logic: If going to Model, use Active Preset. 
        // UNLESS override is provided (e.g. user clicked "Go To 3D Model").
        let targetPresetId = (endValue > 0.5) ? this.activeTransitionPreset : 'default';
        
        if (presetOverride) {
            targetPresetId = presetOverride;
        }
        
        if (!this.transitionPresets[targetPresetId]) return;
        
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
        
        // Ensure size/twinkle reset if going to canvas
        this.transitionAnimation.targetParams.particle_size_mix = (endValue > 0.5) ? (targetPreset.particle_size_mix || 0.0) : 0.0;
        this.transitionAnimation.targetParams.particle_twinkleIntensity = (endValue > 0.5) ? (targetPreset.particle_twinkleIntensity || 0.0) : 0.0;
        
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

        if (anim.presetId !== 'flow') {
            Object.keys(anim.targetParams).forEach(key => {
                if (S[key] !== undefined && key.startsWith('particle_')) {
                    S[key] = this.app.THREE.MathUtils.lerp(anim.startParams[key], anim.targetParams[key], ease);
                }
            });
        }

        if(CM.velocityVariable) {
            // Custom Logic for complex presets
            if (anim.presetId === 'flow') {
                if (progress < 0.2) {
                    S.particle_attractionStrength = -10.0; 
                    S.particle_flowStrength = 50.0;
                    S.particle_flowSpeed = 10.0;
                } else if (progress < 0.6) {
                    S.particle_attractionStrength = 0.0;
                    S.particle_flowStrength = 50.0;
                    S.particle_flowSpeed = 5.0;
                } else {
                    const snapProgress = (progress - 0.6) / 0.4;
                    S.particle_flowStrength = this.app.THREE.MathUtils.lerp(50.0, 0.0, snapProgress);
                    S.particle_attractionStrength = this.app.THREE.MathUtils.lerp(0.0, 100.0, snapProgress * snapProgress);
                }
            }
            else if (anim.presetId === 'supernova') {
                const bellCurve = Math.sin(progress * Math.PI); 
                S.particle_flowStrength = this.app.THREE.MathUtils.lerp(anim.startParams.particle_flowStrength, 20.0, bellCurve);
                const attractionDelay = 0.7;
                const attractionProgress = Math.max(0.0, (progress - attractionDelay) / (1.0 - attractionDelay));
                S.particle_attractionStrength = this.app.THREE.MathUtils.lerp(0.1, 20.0, attractionProgress * attractionProgress);
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