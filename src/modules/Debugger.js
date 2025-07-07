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
        if (!this.enabled || !this.panelElement) return;

        const S = this.app.vizSettings;
        const ipm = this.app.ImagePlaneManager;
        const landscape = ipm.landscape;
        const mm = this.app.ModelManager;
        const model = mm.gltfModel;

        const formatV3 = (v) => v ? `${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)}` : 'null';
        const formatQ = (q) => q ? `${q._x.toFixed(2)}, ${q._y.toFixed(2)}, ${q._z.toFixed(2)}, ${q._w.toFixed(2)}` : 'null';

        let landscapeOutput = "--- LANDSCAPE NOT LOADED ---";
        if (landscape) {
            landscapeOutput = `
--- LANDSCAPE STATE ---
Visible:         ${landscape.visible}
State Mode:      ${ipm.state.mode}
Rot Anim Active: ${ipm.rotationTransition.active}

--- Live Object3D Data ---
Position:    [${formatV3(landscape.position)}]
Quaternion:  [${formatQ(landscape.quaternion)}]
Scale:       [${formatV3(landscape.scale)}]

--- Manager Internal Data ---
Manual Euler: [${formatV3(ipm.rotation)}]
Home Quat:    [${formatQ(ipm.homeQuaternion)}]
Home Manual:  [${formatV3(S.manualLandscapePosition)}]
            `.trim();
        }

        let modelOutput = "\n\n--- 3D MODEL NOT LOADED ---";
        if (model) {
            modelOutput = `
            
--- 3D MODEL STATE ---
Visible:         ${model.visible}
Autopilot:       ${S.modelAutopilotOn ? (mm.autopilot.mode || 'active') : 'off'}

--- Live Object3D Data ---
Position:    [${formatV3(model.position)}]
Quaternion:  [${formatQ(model.quaternion)}]
Final Scale: [${formatV3(model.scale)}]

--- Manager Internal Data ---
Home Manual:  [${formatV3(S.manualModelPosition)}]
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