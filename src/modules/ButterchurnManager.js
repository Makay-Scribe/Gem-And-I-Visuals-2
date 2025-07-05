const ButterchurnManager = {
    app: null, // This will be set to the main App instance on init
    visualizer: null, 
    visualizerCanvas: null, 
    presetKeys: [], 
    presetCycleInterval: null, 
    currentPresetIndex: 0,
    
    init(appInstance) {
        this.app = appInstance;
        // Wait for the libraries to be ready before loading presets.
        this._waitForLibraries();
    },

    _waitForLibraries() {
        const checkInterval = setInterval(() => {
            // Updated check to look for the 'default' export which contains the library functions.
            if (window.butterchurn && window.butterchurn.default && window.butterchurnPresets) {
                clearInterval(checkInterval); // Stop checking
                console.log("Butterchurn libraries and default export loaded. Initializing presets.");
                this.loadPresetListOnly(); // Now it's safe to load the presets
            }
        }, 100); // Check every 100ms
    },

    _getPresetsFromSource(sourceName) {
        if (window[sourceName] && typeof window[sourceName].getPresets === 'function') {
            return window[sourceName].getPresets();
        }
        return {};
    },

    _getAllPresets() {
        const base = this._getPresetsFromSource('butterchurnPresets');
        const minimal = this._getPresetsFromSource('butterchurnPresetsMinimal');
        const nonMinimal = this._getPresetsFromSource('butterchurnPresetsNonMinimal');
        const extra1 = this._getPresetsFromSource('butterchurnPresetsExtra');
        const extra2 = this._getPresetsFromSource('butterchurnPresetsExtra2');
        const md1 = this._getPresetsFromSource('butterchurnPresetsMD1');
        return { ...base, ...minimal, ...nonMinimal, ...extra1, ...extra2, ...md1 };
    },

    loadPresetListOnly() {
        const allPresets = this._getAllPresets();
        this.presetKeys = Object.keys(allPresets);
        this.presetKeys.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
        this.app.UIManager.filterButterchurnPresets();
    },

    connectAudio(audioContext, audioSourceNode) {
        // If the visualizer already exists, just reconnect the audio.
        if (this.visualizer) { 
            this.visualizer.connectAudio(audioSourceNode); 
            return; 
        }

        // The library seems to be packaged as a module, so the actual library object
        // is in the `default` property of the global `window.butterchurn` object.
        const bc = window.butterchurn?.default;

        // Updated check to look for `createVisualizer` on the `default` export.
        if (typeof bc?.createVisualizer !== 'function') {
            this.app.UIManager.logError("Butterchurn is not ready. Try again in a moment.");
            console.error("Attempted to init Butterchurn, but `createVisualizer` is not a function. Current state of `window.butterchurn`:", window.butterchurn);
            return; // Stop execution to prevent a crash.
        }

        console.log("Creating new Butterchurn visualizer instance.");
        this.visualizerCanvas = document.createElement('canvas'); 
        this.visualizerCanvas.width = 512; 
        this.visualizerCanvas.height = 512;
        
        if (this.app.butterchurnMaterial) {
            // THREE needs to be imported here if used directly, or accessed via this.app.THREE
            const THREE = this.app.THREE; 
            this.app.butterchurnTexture = new THREE.CanvasTexture(this.visualizerCanvas);
            this.app.butterchurnTexture.minFilter = THREE.LinearFilter; 
            this.app.butterchurnTexture.magFilter = THREE.LinearFilter;
            this.app.butterchurnMaterial.map = this.app.butterchurnTexture;
            this.app.butterchurnMaterial.color.set(this.app.vizSettings.butterchurnTintColor);
            this.app.butterchurnMaterial.opacity = this.app.vizSettings.butterchurnOpacity;
            this.app.butterchurnMaterial.needsUpdate = true;
        }
        
        this.visualizer = bc.createVisualizer(audioContext, this.visualizerCanvas, { width: 512, height: 512, pixelRatio: 1 });
        this.visualizer.connectAudio(audioSourceNode);
        
        if (this.presetKeys.length > 0) {
            if (this.currentPresetIndex < 0 || this.currentPresetIndex >= this.presetKeys.length) { 
                this.currentPresetIndex = Math.floor(Math.random() * this.presetKeys.length); 
            }
            this.loadPresetByIndex(this.currentPresetIndex);
        } else { 
            this.app.UIManager.logError("No Butterchurn presets found."); 
            document.getElementById('butterchurnCurrentPresetName').textContent = "No Presets Loaded"; 
        }
        
        this.updateCycleInterval();
    },

    loadPresetByIndex(index) {
        if (!this.presetKeys || this.presetKeys.length === 0 || index < 0 || index >= this.presetKeys.length) return;
        
        this.currentPresetIndex = index;
        const presetKey = this.presetKeys[index];
        document.getElementById('butterchurnCurrentPresetName').textContent = presetKey.split(" - ").pop();
        
        const presetListElement = document.getElementById('butterchurnPresetList');
        if (presetListElement) { 
            presetListElement.value = index; 
        }
        
        if (this.visualizer) {
            const allPresets = this._getAllPresets();
            const preset = allPresets[presetKey];
            if (!preset) return;
            this.visualizer.loadPreset(preset, this.app.vizSettings.butterchurnBlendTime);
        }
    },

    nextPreset() {
        if (this.presetKeys.length === 0) return;
        const listElement = document.getElementById('butterchurnPresetList');
        const currentIndexInList = Array.from(listElement.options).findIndex(opt => parseInt(opt.value) === this.currentPresetIndex);
        const nextOption = listElement.options[currentIndexInList + 1];
        this.loadPresetByIndex(parseInt(nextOption ? nextOption.value : listElement.options[0].value));
    },

    prevPreset() {
        if (this.presetKeys.length === 0) return;
        const listElement = document.getElementById('butterchurnPresetList');
        const currentIndexInList = Array.from(listElement.options).findIndex(opt => parseInt(opt.value) === this.currentPresetIndex);
        const prevOption = listElement.options[currentIndexInList - 1];
        this.loadPresetByIndex(parseInt(prevOption ? prevOption.value : listElement.options[listElement.options.length - 1].value));
    },

    randomPreset() {
        if (this.presetKeys.length === 0) return;
        let newIndex = this.currentPresetIndex;
        if (this.presetKeys.length > 1) { 
            while (newIndex === this.currentPresetIndex) { 
                newIndex = Math.floor(Math.random() * this.presetKeys.length); 
            } 
        }
        this.loadPresetByIndex(newIndex);
    },

    updateCycleInterval() {
        if (this.presetCycleInterval) clearInterval(this.presetCycleInterval);
        if (this.app.vizSettings.butterchurnEnableCycle && this.presetKeys.length > 0) {
            this.presetCycleInterval = setInterval(() => this.randomPreset(), this.app.vizSettings.butterchurnCycleTime * 1000);
        }
    },

    render() { 
        if (this.visualizer) { 
            this.visualizer.render(); 
        } 
    }
};

export { ButterchurnManager };