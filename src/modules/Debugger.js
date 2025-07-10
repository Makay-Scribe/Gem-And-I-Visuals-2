export const Debugger = {
    app: null,
    panelElement: null,
    enabled: true,

    init(appInstance) {
        this.app = appInstance;
        this.panelElement = document.getElementById('onScreenDebugPanel');
        const checkbox = document.getElementById('enableOnScreenDebugger');

        if (!this.panelElement || !checkbox) {
            console.error("On-screen debugger elements not found!");
            return;
        }

        this.enabled = checkbox.checked;
        this.panelElement.style.display = this.enabled ? 'block' : 'none';

        checkbox.addEventListener('change', (e) => {
            this.enabled = e.target.checked;
            this.panelElement.style.display = this.enabled ? 'block' : 'none';
        });
    },

    update() {
        // Guard clauses to prevent errors before everything is initialized
        if (!this.enabled || !this.panelElement) return;

        const landscapeManager = this.app.ImagePlaneManager;
        const modelManager = this.app.ModelManager;

        // Helper function for formatting vectors
        const formatV3 = (v) => v ? `${v.x.toFixed(1)}, ${v.y.toFixed(1)}, ${v.z.toFixed(1)}` : 'null';

        // --- LANDSCAPE DEBUG INFO ---
        let landscapeOutput = "--- LANDSCAPE NOT LOADED ---";
        if (landscapeManager && landscapeManager.state && landscapeManager.landscape) {
            const worldPos = new this.app.THREE.Vector3();
            landscapeManager.landscape.getWorldPosition(worldPos);

            landscapeOutput = `
--- LANDSCAPE ---
Manual Ctrl: ${landscapeManager.state.isUnderManualControl}
Autopilot:   ${landscapeManager.autopilot.active} (${landscapeManager.autopilot.preset || 'N/A'})
Target Pos:  [${formatV3(landscapeManager.state.targetPosition)}]
Actual Pos:  [${formatV3(worldPos)}]
            `.trim();
        }

        // --- MODEL DEBUG INFO ---
        let modelOutput = "\n--- 3D MODEL NOT LOADED ---";
        if (modelManager && modelManager.state && modelManager.gltfModel) {
            const worldPos = new this.app.THREE.Vector3();
            modelManager.gltfModel.getWorldPosition(worldPos);
            
            modelOutput = `
--- 3D MODEL ---
Manual Ctrl: ${modelManager.state.isUnderManualControl}
Autopilot:   ${modelManager.autopilot.active} (${modelManager.autopilot.preset || 'N/A'})
Target Pos:  [${formatV3(modelManager.state.targetPosition)}]
Actual Pos:  [${formatV3(worldPos)}]
            `.trim();
        }

        this.panelElement.textContent = landscapeOutput + "\n" + modelOutput;
    },

    /**
     * Original console log function remains for other uses.
     * @param {string} category - The category of the log.
     * @param {...any} args - The message(s) to log.
     */
    log(category, ...args) {
        // This part of the debugger is not currently used but is kept for future utility.
        const config = { audio: false, jolt: false, peel: false, warp: false, camera: false };
        if (config[category]) {
            console.log(`[DEBUG - ${category.toUpperCase()}]`, ...args);
        }
    }
};