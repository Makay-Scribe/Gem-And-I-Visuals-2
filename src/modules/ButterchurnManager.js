export const ButterchurnManager = {
    app: null, // This will be set to the main App instance on init
    visualizer: null, 
    visualizerCanvas: null, 
    presetKeys: [], 
    presetCycleInterval: null, 
    currentPresetIndex: 0,
    
    init(appInstance) {
        this.app = appInstance;
        // The UIManager is now responsible for populating its own list.
        // This manager just needs to provide the preset list when asked.
        this._waitForLibraries();
    },

    _waitForLibraries() {
        const checkInterval = setInterval(() => {
            if (window.butterchurn && window.butterchurn.default && window.butterchurnPresets) {
                clearInterval(checkInterval);
                console.log("Butterchurn libraries and default export loaded.");
                this.loadPresetListOnly();
            }
        }, 100);
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
        
        // The error occurred here. We remove the call to the non-existent UIManager function.
        // The UIManager will now pull this data when it needs it.
        // this.app.UIManager.filterButterchurnPresets(); 
    },

    connectAudio(audioContext, audioSourceNode) {
        if (this.visualizer) { 
            this.visualizer.connectAudio(audioSourceNode); 
            return; 
        }

        const bc = window.butterchurn?.default;

        if (typeof bc?.createVisualizer !== 'function') {
            if (this.app.UIManager) this.app.UIManager.logError("Butterchurn is not ready. Try again in a moment.");
            console.error("Attempted to init Butterchurn, but `createVisualizer` is not a function.");
            return;
        }

        console.log("Creating new Butterchurn visualizer instance.");
        this.visualizerCanvas = document.createElement('canvas'); 
        this.visualizerCanvas.width = 512; 
        this.visualizerCanvas.height = 512;
        
        if (this.app.butterchurnMaterial) {
            this.app.butterchurnTexture = new this.app.THREE.CanvasTexture(this.visualizerCanvas);
            this.app.butterchurnTexture.minFilter = this.app.THREE.LinearFilter; 
            this.app.butterchurnTexture.magFilter = this.app.THREE.LinearFilter;
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
            if (this.app.UIManager) this.app.UIManager.logError("No Butterchurn presets found."); 
        }
        
        this.updateCycleInterval();
    },

    loadPresetByIndex(index) {
        if (!this.presetKeys || this.presetKeys.length === 0 || index < 0 || index >= this.presetKeys.length) return;
        
        this.currentPresetIndex = index;
        const presetKey = this.presetKeys[index];
        
        // This manager should not directly touch the DOM. We'll let UIManager handle this.
        // document.getElementById('butterchurnCurrentPresetName').textContent = presetKey.split(" - ").pop();
        
        if (this.app.UIManager) {
            this.app.UIManager.updateButterchurnPresetDisplay(presetKey, index);
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
        let newIndex = (this.currentPresetIndex + 1) % this.presetKeys.length;
        this.loadPresetByIndex(newIndex);
    },

    prevPreset() {
        if (this.presetKeys.length === 0) return;
        let newIndex = (this.currentPresetIndex - 1 + this.presetKeys.length) % this.presetKeys.length;
        this.loadPresetByIndex(newIndex);
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