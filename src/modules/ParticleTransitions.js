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
        'gravity_well': {}, // ** THE FIX IS HERE: Added new preset **
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

        const duration = (this.activeTransitionPreset === 'pour' || this.activeTransitionPreset === 'melt' || this.activeTransitionPreset === 'gravity_well') ? 7000 : 4000;
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
        
        if (this.app.UIManager) this.app.UIManager.disableParticleSliders();
    },

    // This is the "Conductor" that runs every frame during a transition
    update() {
        if (!this.transitionAnimation) return;

        const now = performance.now();
        const anim = this.transitionAnimation;
        const elapsedTime = now - anim.startTime;
        let progress = Math.min(1.0, elapsedTime / anim.duration);
        
        const S = this.app.vizSettings;
        const CM = this.app.ComputeManager;

        // Use an ease-out function for smooth deceleration
        const ease = 1 - Math.pow(1 - progress, 4); 
        
        // Update the main morph progress
        S.particle_morphProgress = this.app.THREE.MathUtils.lerp(anim.startValue, anim.endValue, ease);
        if (this.app.UIManager) this.app.UIManager.handleMorphSlider(S.particle_morphProgress);


        // --- GENERIC PARAMETER ANIMATION ---
        // This is the new generic engine. It animates all parameters found in the preset.
        Object.keys(anim.targetParams).forEach(key => {
            if (S[key] !== undefined && key.startsWith('particle_')) {
                S[key] = this.app.THREE.MathUtils.lerp(anim.startParams[key], anim.targetParams[key], ease);
            }
        });

        // --- SPECIAL CASE LOGIC FOR COMPLEX PRESETS ---
        // This is where we handle presets that do more than just lerp values.
        if(CM.particleVelocityVar) {
            const pUniformsV = CM.particleVelocityVar.material.uniforms;
            
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
                // ** THE FIX IS HERE: Add the new logic for the gravity well **
                case 'gravity_well': {
                    S.particle_flowStrength = 0.2; // Keep a little turbulence for a cosmic feel
                    
                    // The center of the gravity well is the model's home position
                    pUniformsV.u_gravityWellPosition.value.copy(this.app.ModelManager.state.homePosition);

                    // Stage 1: Push particles out a bit (first 10% of animation)
                    const pushProgress = Math.min(1.0, progress / 0.1);
                    const pushCurve = Math.sin(pushProgress * Math.PI); // A single curve up and down
                    pUniformsV.u_gravityWellStrength.value = -0.5 * pushCurve; // Negative strength = push
                    pUniformsV.u_orbitalStrength.value = 0.0;
                    S.particle_attractionStrength = 0.0;

                    // Stage 2: Pull into orbit (from 10% to 70%)
                    const orbitDelay = 0.1;
                    if (progress > orbitDelay) {
                        const orbitProgress = Math.min(1.0, (progress - orbitDelay) / 0.6);
                        const orbitCurve = Math.sin(orbitProgress * Math.PI);
                        pUniformsV.u_gravityWellStrength.value = 0.4 * orbitCurve; // Positive strength = pull
                        pUniformsV.u_orbitalStrength.value = 1.0 * orbitCurve;
                    }

                    // Stage 3: Decay orbit and attract to final positions (last 30%)
                    const settleDelay = 0.7;
                    if (progress > settleDelay) {
                        const settleProgress = (progress - settleDelay) / (1.0 - settleDelay);
                        pUniformsV.u_gravityWellStrength.value = this.app.THREE.MathUtils.lerp(pUniformsV.u_gravityWellStrength.value, 0.0, settleProgress);
                        pUniformsV.u_orbitalStrength.value = this.app.THREE.MathUtils.lerp(pUniformsV.u_orbitalStrength.value, 0.0, settleProgress);
                        S.particle_attractionStrength = this.app.THREE.MathUtils.lerp(0.0, anim.targetParams.particle_attractionStrength, settleProgress);
                    }
                    break;
                }
            }
        }


        // Update the UI to reflect the new values
        if (this.app.UIManager) this.app.UIManager.syncSlidersToSettings();

        // --- CLEANUP ---
        if (progress >= 1) {
            // Ensure final state is set perfectly
            Object.keys(anim.targetParams).forEach(key => {
                S[key] = anim.targetParams[key];
            });
            S.particle_morphProgress = anim.endValue;
            
            // Reset any temporary shader uniforms
            if(CM.particleVelocityVar) {
                const pUniformsV = CM.particleVelocityVar.material.uniforms;
                pUniformsV.u_gravity.value.y = 0.0;
                pUniformsV.u_vortexStrength.value = 0.0;
                pUniformsV.u_meltProgress.value = 0.0;
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