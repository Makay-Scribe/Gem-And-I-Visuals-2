export const DirectorManager = {
    app: null,
    isActive: false,

    // --- State Machine ---
    phase: 'IDLE', // IDLE, PHASE_MODEL_12, PHASE_MODEL_5, TRANSITION_OUT, TRANSITION_SWAP, TRANSITION_IN
    phaseTimer: 0,
    autopilotCycleTimer: 0,
    
    // --- Transition State ---
    transitionProgress: 0,
    transitionDuration: 10.0, // 10 seconds to move off/on screen
    transitionStartPos: null,
    transitionEndPos: null,
    offScreenPos: null,

    // --- Show Script ---
    currentModelId: null,
    nextModelId: null,
    autopilotPresets: ['autopilotPreset1', 'autopilotPreset2', 'autopilotPreset3', 'autopilotPreset4', 'autopilotPreset5'],

    init(appInstance) {
        this.app = appInstance;
        this.transitionStartPos = new this.app.THREE.Vector3();
        this.transitionEndPos = new this.app.THREE.Vector3();
        this.offScreenPos = new this.app.THREE.Vector3(-80, 0, 10); // A designated "backstage" position
        console.log("DirectorManager initialized.");
    },

    start() {
        if (this.isActive) return;
        console.log("DIRECTOR: Starting show sequence.");
        this.isActive = true;

        // Reset and start sequence
        this.currentModelId = 'modelPreset12';
        this.phase = 'PHASE_MODEL_12';
        this.phaseTimer = 8 * 60; // 8 minutes
        this.autopilotCycleTimer = 0; // Trigger cycle immediately

        this.app.ModelManager.loadGLTFModel(this.app.modelPresets[this.currentModelId]);
        
        // TODO: Disable UI controls in UIManager
    },

    stop() {
        if (!this.isActive) return;
        console.log("DIRECTOR: Stopping show sequence.");
        this.isActive = false;
        this.phase = 'IDLE';

        this.app.ModelManager.stopAutopilot();
        // TODO: Re-enable UI controls in UIManager
    },

    _cycleAutopilot() {
        const randomIndex = Math.floor(Math.random() * this.autopilotPresets.length);
        const randomPresetId = this.autopilotPresets[randomIndex];
        console.log(`DIRECTOR: Cycling to autopilot preset: ${randomPresetId}`);
        this.app.ModelManager.startAutopilot(randomPresetId);
        this.autopilotCycleTimer = 60; // Reset for 1 minute
    },

    // ** THE FIX IS HERE: The main update function is now async **
    async update(delta) {
        if (!this.isActive) return;

        const modelState = this.app.ModelManager.state;
        const modelAutopilot = this.app.ModelManager.autopilot;

        // --- Autopilot Cycling Logic ---
        // Only cycle if we are in a main phase (not transitioning)
        if (this.phase === 'PHASE_MODEL_12' || this.phase === 'PHASE_MODEL_5') {
            this.autopilotCycleTimer -= delta;
            if (this.autopilotCycleTimer <= 0) {
                this._cycleAutopilot();
            }
        }

        // --- Main Phase State Machine ---
        switch (this.phase) {
            case 'PHASE_MODEL_12':
                this.phaseTimer -= delta;
                if (this.phaseTimer <= 0) {
                    this.phase = 'TRANSITION_OUT';
                    this.nextModelId = 'modelPreset5';
                    this.transitionProgress = 0;
                    this.transitionStartPos.copy(modelState.targetPosition);
                    modelAutopilot.active = false; // Stop autopilot for transition
                }
                break;

            case 'PHASE_MODEL_5':
                this.phaseTimer -= delta;
                if (this.phaseTimer <= 0) {
                    this.phase = 'TRANSITION_OUT';
                    this.nextModelId = 'modelPreset12';
                    this.transitionProgress = 0;
                    this.transitionStartPos.copy(modelState.targetPosition);
                    modelAutopilot.active = false; // Stop autopilot for transition
                }
                break;

            case 'TRANSITION_OUT':
                this.transitionProgress += delta / this.transitionDuration;
                modelState.targetPosition.lerpVectors(this.transitionStartPos, this.offScreenPos, this.transitionProgress);
                
                if (this.transitionProgress >= 1) {
                    modelState.targetPosition.copy(this.offScreenPos);
                    this.phase = 'TRANSITION_SWAP';
                }
                break;

            case 'TRANSITION_SWAP':
                // This state now handles the asynchronous loading
                console.log(`DIRECTOR: Swapping to model ${this.nextModelId}`);
                try {
                    // ** THE FIX IS HERE: We now 'await' the model load **
                    await this.app.ModelManager.loadGLTFModel(this.app.modelPresets[this.nextModelId]);
                    
                    // Only proceed to the next state after the load is successful
                    this.currentModelId = this.nextModelId;
                    this.phase = 'TRANSITION_IN';
                    this.transitionProgress = 0;
                    console.log("DIRECTOR: Model swap successful. Beginning transition in.");
                } catch (error) {
                    // If the model fails to load, we stop the director to prevent errors.
                    console.error("DIRECTOR: Halting sequence due to model load failure.", error);
                    this.stop();
                }
                break;

            case 'TRANSITION_IN':
                this.transitionProgress += delta / this.transitionDuration;
                // Calculate the true home position for the new model
                const homePos = new this.app.THREE.Vector3().copy(this.app.defaultVisualizerSettings.homePositionModel);
                const preset = this.app.modelPresets[this.currentModelId];
                if (preset && preset.homeOffset) {
                    homePos.add(preset.homeOffset);
                }

                modelState.targetPosition.lerpVectors(this.offScreenPos, homePos, this.transitionProgress);

                if (this.transitionProgress >= 1) {
                    modelState.targetPosition.copy(homePos);
                    // End of transition, start the next phase
                    if (this.currentModelId === 'modelPreset12') {
                        this.phase = 'PHASE_MODEL_12';
                        this.phaseTimer = 8 * 60; // 8 minutes
                    } else {
                        this.phase = 'PHASE_MODEL_5';
                        this.phaseTimer = 4 * 60; // 4 minutes
                    }
                    this.autopilotCycleTimer = 0; // Start new autopilot cycle immediately
                }
                break;
        }
    }
};