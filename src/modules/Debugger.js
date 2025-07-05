const Debugger = {
    // --- CONFIGURATION ---
    // Set a category to 'true' to enable its logs in the console.
    config: {
        audio: true, // Let's see the audio values
        jolt: true,  // Let's see the jolt calculations
        
        // --- Placeholders for future debugging ---
        peel: false,
        warp: false,
        camera: false,
    },

    /**
     * Logs messages to the console if the category is enabled in the config.
     * @param {string} category - The category of the log (e.g., 'audio', 'jolt').
     * @param {...any} args - The message(s) or object(s) to log.
     */
    log(category, ...args) {
        if (this.config[category]) {
            console.log(`[DEBUG - ${category.toUpperCase()}]`, ...args);
        }
    }
};

export { Debugger };