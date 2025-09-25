/*
================================================================================================
PARTICLE TRANSITION & AI ACTION MANAGER
================================================================================================
This module is the "Conductor" for all creative particle transition effects. It will also serve
as the primary API endpoint for the future AI Agent.

------------------------------------------------------------------------------------------------
FUTURE AI INTEGRATION PLAN
------------------------------------------------------------------------------------------------

1.  ARCHITECTURAL GOAL:
    To create an autonomous system where a local AI Agent can make real-time, creative
    visual decisions based on music analysis and/or user interaction (e.g., chat commands).
    The visualizer will act as the "render engine" for the AI's directorial choices.

2.  KEY COMPONENTS:
    a.  VISUALIZER (This Project):
        - This `ParticleTransitions.js` module will expose simple functions like `run('presetName')`.
        - A WebSocket CLIENT will be added to `main.js` to listen for commands from the AI Agent.

    b.  LOCAL LLM RUNNER (Ollama):
        - A separate application (Ollama) will run a small, local LLM (e.g., Llama 3 8B).
        - Its job is to act as the "reasoning brain," translating simple prompts into specific function calls.

    c.  AI AGENT (New Backend Project - e.g., Node.js):
        - This is the central hub. It's a new server application we will build.
        - It hosts a WebSocket SERVER to broadcast commands to the visualizer.
        - It contains an AUDIO ANALYSIS module to extract BPM, energy, and spectral data from music.
        - It listens for optional inputs (like a local command from a dashboard, or a Twitch chat).
        - It formats the data into a prompt for Ollama and receives a function call in response.
        - It then sends that function call as a command over the WebSocket to this visualizer.

3.  WORKFLOW EXAMPLE (AI AS VJ):
    - Agent analyzes a song: "Energy is HIGH, BPM is 128."
    - Agent prompts Ollama: "Given HIGH energy, choose one: run('supernova'), run('cosmic_dust')..."
    - Ollama responds: `run('supernova')`
    - Agent sends WebSocket message: `{ "command": "run", "preset": "supernova" }`
    - Visualizer's `main.js` receives the message and calls `ParticleTransitions.run('supernova')`.

This structure keeps the AI logic completely separate from the visual rendering logic, allowing
us to develop and enhance both systems independently.
------------------------------------------------------------------------------------------------
*/

export const ParticleTransitions = {
    app: null,

    // --- State ---
    transitionAnimation: null,
    activeTransitionPreset: 'default',

    // --- Presets ---
    // This object contains the "at rest" state for each transition.
    // The animation logic itself is handled in `updateTransitionAnimation`.
    transitionPresets: {
        'default': {
            particle_flowStrength: 0.0,
            particle_flowSpeed: 0.0,
            particle_flowScale: 0.1,
            particle_attractionStrength: 0.1,
            particle_size_mix: 0.0,
            particle_twinkleIntensity: 0.0,
        },
        'pour': {},
        'liquid': {},
        'explode': {},
        'nebula': {},
        'melt': {},
        'supernova': {},
        'gravity_well': {},
        'cosmic_dust': {},
        'dissolve': {},
        'swarm': {},
        'flow': {}
    },

    init(appInstance) {
        this.app = appInstance;
    },
    
    // Called by UIManager when a preset button is clicked
    setActivePreset(presetId) {
        if (this.transitionPresets[presetId]) {
            this.activeTransitionPreset = presetId;
            // You could add logic here to immediately apply some base settings if desired
        } else {
            console.warn(`Attempted to set non-existent preset: ${presetId}`);
        }
    },

    // Called by UIManager when the "Run Transition" button is clicked
    run() {
        if (this.transitionAnimation) return; // Prevent multiple transitions at once

        const S = this.app.vizSettings;
        const startValue = S.particle_morphProgress;
        
        let endValue;
        if (startValue < 0.5) {
            endValue = 0.95;
        } else {
            endValue = 0.0;
        }

        const duration = (this.activeTransitionPreset === 'pour' || this.activeTransitionPreset === 'melt') ? 7000 : 4000;
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

        // Populate start and target parameters, falling back to default for any missing keys
        Object.keys(defaultPreset).forEach(key => {
            this.transitionAnimation.startParams[key] = S[key];
            this.transitionAnimation.targetParams[key] = (targetPreset[key] !== undefined) ? targetPreset[key] : defaultPreset[key];
        });
        
        // Special-case parameters that depend on direction
        this.transitionAnimation.targetParams.particle_size_mix = (endValue > 0.5) ? 0.75 : 0.0;
        this.transitionAnimation.targetParams.particle_twinkleIntensity = (endValue > 0.5) ? 0.5 : 0.0;
    },

    // This is the "Conductor" that runs every frame during a transition
    update() {
        if (!this.transitionAnimation) return;

        const now = performance.now();
        const anim = this.transitionAnimation;
        const elapsedTime = now - anim.startTime;
        let progress = Math.min(1.0, elapsedTime / anim.duration);
        
        const S = this.app.vizSettings;
        const ease = 1 - Math.pow(1 - progress, 4); 
        
        const pUniformsV = this.app.ComputeManager.particleVelocityVar.material.uniforms;
        
        // UIManager handles disabling the sliders
        this.app.UIManager.setMorphState(this.app.THREE.MathUtils.lerp(anim.startValue, anim.endValue, ease));

        switch(anim.presetId) {
            case 'explode': {
                const bellCurve = Math.sin(progress * Math.PI); 
                const peakFlow = 5.0; 
                S.particle_flowStrength = this.app.THREE.MathUtils.lerp(anim.startParams.particle_flowStrength, peakFlow, bellCurve);
                
                const attractionDelay = 0.7;
                const attractionProgress = Math.max(0.0, (progress - attractionDelay) / (1.0 - attractionDelay));
                S.particle_attractionStrength = this.app.THREE.MathUtils.lerp(0.01, anim.targetParams.particle_attractionStrength, attractionProgress);
                break;
            }
            case 'melt': {
                S.particle_flowStrength = 0.0;
                S.particle_attractionStrength = 0.0;

                const bellCurve = Math.sin(progress * Math.PI);
                const meltPhaseProgress = Math.min(1.0, progress / 0.5); 
                pUniformsV.u_meltProgress.value = meltPhaseProgress;
                
                const reformPhaseProgress = Math.min(1.0, Math.max(0.0, (progress - 0.8) / 0.2)); 
                if(reformPhaseProgress > 0) {
                    S.particle_attractionStrength = this.app.THREE.MathUtils.lerp(0.0, anim.targetParams.particle_attractionStrength, reformPhaseProgress);
                } else {
                     pUniformsV.u_gravity.value.y = -0.1 * bellCurve; 
                     pUniformsV.u_vortexStrength.value = 5.0 * bellCurve;
                }
                break;
            }
            case 'liquid':
            case 'nebula':
            case 'pour':
            case 'supernova':
            case 'gravity_well':
            case 'cosmic_dust':
            case 'dissolve':
            case 'swarm':
            case 'flow':
            default:
                Object.keys(anim.targetParams).forEach(key => {
                    if (S[key] !== undefined && key.startsWith('particle_')) {
                        S[key] = this.app.THREE.MathUtils.lerp(anim.startParams[key], anim.targetParams[key], ease);
                    }
                });
                break;
        }

        const twinkleDelay = 0.2;
        const twinkleProgress = Math.max(0.0, (progress - twinkleDelay) / (1.0 - twinkleDelay));
        S.particle_twinkleIntensity = this.app.THREE.MathUtils.lerp(anim.startParams.particle_twinkleIntensity, anim.targetParams.particle_twinkleIntensity, twinkleProgress);
        S.particle_size_mix = this.app.THREE.MathUtils.lerp(anim.startParams.particle_size_mix, anim.targetParams.particle_size_mix, ease);

        this.app.UIManager.syncSlidersToSettings();

        if (progress >= 1) {
            this.app.UIManager.setMorphState(anim.endValue);
            Object.keys(anim.targetParams).forEach(key => {
                S[key] = anim.targetParams[key];
            });
            pUniformsV.u_gravity.value.y = 0.0;
            pUniformsV.u_vortexStrength.value = 0.0;
            pUniformsV.u_meltProgress.value = 0.0;
            
            this.app.UIManager.enableParticleSliders(); // Re-enable sliders
            this.app.UIManager.syncSlidersToSettings();
            this.transitionAnimation = null;
        }
    }
};