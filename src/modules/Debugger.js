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
        if (!this.enabled || !this.panelElement || !this.app.worldPivot) return;

        const S = this.app.vizSettings;
        const landscape = this.app.ImagePlaneManager.landscape;
        const model = this.app.ModelManager.gltfModel;
        const pivot = this.app.worldPivot;
        const interaction = this.app.interactionState;

        const formatV3 = (v) => v ? `${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)}` : 'null';
        const formatE = (e) => e ? `${(e.x * 180/Math.PI).toFixed(1)}°, ${(e.y * 180/Math.PI).toFixed(1)}°, ${(e.z * 180/Math.PI).toFixed(1)}°` : 'null';

        let pivotOutput = `
--- WORLD PIVOT ---
Position:   [${formatV3(pivot.position)}]
Target Pos: [${formatV3(interaction.targetPosition)}]
Rotation:   [${formatE(pivot.rotation)}]
Target Rot: [${formatE(interaction.targetRotation)}]
        `.trim();

        let landscapeOutput = "\n\n--- LANDSCAPE NOT LOADED ---";
        if (landscape) {
            const worldPos = new this.app.THREE.Vector3();
            landscape.getWorldPosition(worldPos);
            landscapeOutput = `
--- LANDSCAPE ---
Parent:      ${landscape.parent === pivot ? 'worldPivot' : 'scene'}
Autopilot:   ${S.landscapeAutopilotOn}
World Pos:   [${formatV3(worldPos)}]
Local Pos:   [${formatV3(landscape.position)}]
            `.trim();
        }

        let modelOutput = "\n\n--- 3D MODEL NOT LOADED ---";
        if (model) {
            const worldPos = new this.app.THREE.Vector3();
            model.getWorldPosition(worldPos);
            modelOutput = `
--- 3D MODEL ---
Parent:      ${model.parent === pivot ? 'worldPivot' : 'scene'}
Autopilot:   ${S.modelAutopilotOn}
World Pos:   [${formatV3(worldPos)}]
Local Pos:   [${formatV3(model.position)}]
            `.trim();
        }


        this.panelElement.textContent = pivotOutput + "\n" + landscapeOutput + "\n" + modelOutput;
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