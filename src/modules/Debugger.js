import THREE from '../three-singleton.js';

export const Debugger = {
    app: null,
    panelElement: null,

    init(appInstance) {
        this.app = appInstance;
        this.panelElement = document.getElementById('onScreenDebugPanel');
        const checkbox = document.getElementById('enableOnScreenDebugger');

        if (!this.panelElement || !checkbox) {
            console.error("On-screen debugger elements not found!");
            return;
        }

        // Set initial checkbox state from vizSettings. The update loop will handle visibility.
        checkbox.checked = this.app.vizSettings.enableOnScreenDebugger;
        this.panelElement.style.display = this.app.vizSettings.enableOnScreenDebugger ? 'block' : 'none';

        checkbox.addEventListener('change', (e) => {
            // The checkbox *only* updates the central setting.
            this.app.vizSettings.enableOnScreenDebugger = e.target.checked;
        });
    },

    update() {
        if (!this.panelElement) return;

        // ** THE FIX IS HERE: The module is now stateless. It reads the global setting every frame. **
        const shouldBeVisible = this.app.vizSettings.enableOnScreenDebugger;
        
        // Efficiently update the DOM only when the visibility state changes.
        const isCurrentlyVisible = this.panelElement.style.display !== 'none';
        if (isCurrentlyVisible !== shouldBeVisible) {
            this.panelElement.style.display = shouldBeVisible ? 'block' : 'none';
        }
        
        // If it's not supposed to be visible, exit early to save processing.
        if (!shouldBeVisible) return;


        const landscapeManager = this.app.ImagePlaneManager;
        const modelManager = this.app.ModelManager;

        // Helper for formatting vectors
        const formatV3 = (v) => v ? `${v.x.toFixed(1)}, ${v.y.toFixed(1)}, ${v.z.toFixed(1)}` : 'N/A';
        
        // Helper for formatting rotations from quaternions into degrees
        const formatQuat = (q) => {
            if (!q) return 'N/A';
            // Use THREE.Euler and THREE.MathUtils
            const euler = new THREE.Euler().setFromQuaternion(q, 'YXZ');
            const x = THREE.MathUtils.radToDeg(euler.x).toFixed(1);
            const y = THREE.MathUtils.radToDeg(euler.y).toFixed(1);
            const z = THREE.MathUtils.radToDeg(euler.z).toFixed(1);
            return `${x}, ${y}, ${z}`;
        };

        // --- LANDSCAPE DEBUG INFO ---
        let landscapeOutput = "--- LANDSCAPE NOT LOADED ---";
        if (landscapeManager && landscapeManager.state && landscapeManager.landscapeContainer) {
            // Use THREE.Vector3 and THREE.Quaternion
            const actualPos = new THREE.Vector3();
            landscapeManager.landscapeContainer.getWorldPosition(actualPos);
            const actualQuat = new THREE.Quaternion();
            landscapeManager.landscapeContainer.getWorldQuaternion(actualQuat);

            landscapeOutput = `
--- LANDSCAPE ---
Manual Ctrl: ${landscapeManager.state.isUnderManualControl}
Autopilot:   ${landscapeManager.autopilot.active} (${landscapeManager.autopilot.preset || 'N/A'})
Target Pos:  [${formatV3(landscapeManager.state.targetPosition)}]
Target Rot:  [${formatQuat(landscapeManager.state.targetQuaternion)}] (x,y,z deg)
Actual Pos:  [${formatV3(actualPos)}]
Actual Rot:  [${formatQuat(actualQuat)}] (x,y,z deg)
            `.trim();
        }

        // --- MODEL DEBUG INFO ---
        let modelOutput = "\n--- 3D MODEL NOT LOADED ---";
        if (modelManager && modelManager.state && modelManager.gltfModel) {
            // Use THREE.Vector3 and THREE.Quaternion
            const actualPos = new THREE.Vector3();
            modelManager.gltfModel.getWorldPosition(actualPos);
            const actualQuat = new THREE.Quaternion();
            modelManager.gltfModel.getWorldQuaternion(actualQuat);
            
            modelOutput = `
--- 3D MODEL ---
Manual Ctrl: ${modelManager.state.isUnderManualControl}
Autopilot:   ${modelManager.autopilot.active} (${modelManager.autopilot.preset || 'N/A'})
Target Pos:  [${formatV3(modelManager.state.targetPosition)}]
Target Rot:  [${formatQuat(modelManager.state.targetQuaternion)}] (x,y,z deg)
Actual Pos:  [${formatV3(actualPos)}]
Actual Rot:  [${formatQuat(actualQuat)}] (x,y,z deg)
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