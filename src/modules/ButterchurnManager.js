import butterchurn from 'butterchurn';

const b2PresetImporters = import.meta.glob(
  '../../node_modules/butterchurn-presets/presets/converted/**/*.json'
);

export const ButterchurnManager = {
    app: null,
    
    activeEngine: null,
    visualizer: null,
    visualizerCanvas: null,
    
    b1_presetKeys: [],
    b1_presets: {},
    b1_loadedScripts: [],
    
    b2_presetPaths: [],
    b2_presetsCache: {},
    
    currentPresetIndex: 0,
    presetCycleInterval: null,
    isSwitching: false,

    _loadScript(src) {
        return new Promise((resolve, reject) => {
            const cacheBustedSrc = `${src}?v=${Date.now()}`;
            const script = document.createElement('script');
            script.src = cacheBustedSrc;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Script load error for ${src}`));
            document.head.appendChild(script);
            this.b1_loadedScripts.push(script);
        });
    },
    
    init(appInstance) {
        this.app = appInstance;
        console.log("ButterchurnManager initialized. Waiting for engine selection.");
    },

    async switchEngine(engine) {
        if (this.activeEngine === engine || this.isSwitching) return;
        
        this.isSwitching = true;
        if (this.app.UIManager) this.app.UIManager.logSuccess(`Switching to Butterchurn ${engine}...`);

        await this.destroyVisualizer();
        this.activeEngine = engine;

        if (engine === '1') {
            await this.loadB1Engine();
        } else if (engine === '2') {
            await this.loadB2Engine();
        }

        if (this.app.AudioProcessor.audioContext) {
            this.connectAudio(this.app.AudioProcessor.audioContext, this.app.AudioProcessor.butterchurnGainNode);
        }
        
        this.isSwitching = false;
    },

    async destroyVisualizer() {
        if (this.app.butterchurnTexture) {
            if (this.app.butterchurnMaterial) {
                this.app.butterchurnMaterial.map = null;
                this.app.butterchurnMaterial.needsUpdate = true;
            }
            this.app.butterchurnTexture.dispose();
            this.app.butterchurnTexture = null;
        }
        if (this.visualizer) { this.visualizer = null; }
        if (this.presetCycleInterval) { clearInterval(this.presetCycleInterval); }
        this.currentPresetIndex = 0;
        
        this.b1_loadedScripts.forEach(script => script.remove());
        this.b1_loadedScripts = [];

        if (window.butterchurn) delete window.butterchurn;
        if (window.butterchurnPresets) delete window.butterchurnPresets;
        if (window.butterchurnPresetsMinimal) delete window.butterchurnPresetsMinimal;
        if (window.butterchurnPresetsNonMinimal) delete window.butterchurnPresetsNonMinimal;
        if (window.butterchurnPresetsExtra) delete window.butterchurnPresetsExtra;
        if (window.butterchurnPresetsExtra2) delete window.butterchurnPresetsExtra2;
        if (window.butterchurnPresetsMD1) delete window.butterchurnPresetsMD1;
    },

    async loadB1Engine() {
        try {
            const scriptPaths = [
                '/butterchurn.min.js',
                '/butterchurnPresets.min.js',
                '/butterchurnPresetsMinimal.min.js',
                '/butterchurnPresetsNonMinimal.min.js',
                '/butterchurnPresetsExtra.min.js',
                '/butterchurnPresetsExtra2.min.js',
                '/butterchurnPresetsMD1.min.js'
            ];
            
            for (const path of scriptPaths) {
                await this._loadScript(path);
            }

            const base = window.butterchurnPresets?.getPresets() || {};
            const minimal = window.butterchurnPresetsMinimal?.getPresets() || {};
            const nonMinimal = window.butterchurnPresetsNonMinimal?.getPresets() || {};
            const extra1 = window.butterchurnPresetsExtra?.getPresets() || {};
            const extra2 = window.butterchurnPresetsExtra2?.getPresets() || {};
            const md1 = window.butterchurnPresetsMD1?.getPresets() || {};
            
            this.b1_presets = { ...base, ...minimal, ...nonMinimal, ...extra1, ...extra2, ...md1 };
            this.b1_presetKeys = Object.keys(this.b1_presets).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
            
            if (this.app.UIManager) {
                this.app.UIManager.populateButterchurnPresetList(this.b1_presetKeys);
            }
        } catch (error) {
            console.error("Failed to load Butterchurn 1 libraries:", error);
            if (this.app.UIManager) this.app.UIManager.logError("Failed to load B1 libraries.");
        }
    },

    async loadB2Engine() {
        if (this.b2_presetPaths.length === 0) {
            this.b2_presetPaths = Object.keys(b2PresetImporters).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
        }
        const presetNames = this.b2_presetPaths.map(path => path.substring(path.lastIndexOf('/') + 1).replace('.json', ''));
        if (this.app.UIManager) {
            this.app.UIManager.populateButterchurnPresetList(presetNames);
        }
    },

    connectAudio(audioContext, audioSourceNode) {
        if (this.visualizer) { this.visualizer.connectAudio(audioSourceNode); return; }
        if (!this.activeEngine) return;

        this.visualizerCanvas = document.createElement('canvas'); 
        this.visualizerCanvas.width = 512; 
        this.visualizerCanvas.height = 512;

        let visualizerFactory;
        if (this.activeEngine === '1') {
            const b1_engine = window.butterchurn?.default || window.butterchurn;

            if (typeof b1_engine?.createVisualizer !== 'function') {
                this.app.UIManager.logError('B1 Engine failed to initialize `window.butterchurn`.');
                console.error("Final check for B1 engine failed. `window.butterchurn` content:", window.butterchurn);
                return;
            }
            visualizerFactory = b1_engine.createVisualizer;
        } else { // Engine 2
            visualizerFactory = butterchurn.createVisualizer;
        }

        this.visualizer = visualizerFactory(audioContext, this.visualizerCanvas, { width: 512, height: 512, pixelRatio: 1 });
        this.visualizer.connectAudio(audioSourceNode);
        this.activate();
        this.loadInitialPreset();
        this.updateCycleInterval();
    },

    loadInitialPreset() {
        const totalPresets = (this.activeEngine === '1') ? this.b1_presetKeys.length : this.b2_presetPaths.length;
        if (totalPresets > 0) {
            this.loadPresetByIndex(Math.floor(Math.random() * totalPresets));
        }
    },

    async loadPresetByIndex(index) {
        if (!this.visualizer) return;
        this.currentPresetIndex = index;
        
        let preset;
        let presetKey;

        if (this.activeEngine === '1') {
            presetKey = this.b1_presetKeys[index];
            preset = this.b1_presets[presetKey];
        } else { // Engine 2
            const path = this.b2_presetPaths[index];
            presetKey = path.substring(path.lastIndexOf('/') + 1).replace('.json', '');
            if (this.b2_presetsCache[path]) {
                preset = this.b2_presetsCache[path];
            } else {
                try {
                    const importer = b2PresetImporters[path];
                    const presetModule = await importer();
                    preset = presetModule.default;
                    this.b2_presetsCache[path] = preset;
                } catch (e) {
                    console.error(`Failed to load preset: ${path}`, e);
                    if (this.app.UIManager) this.app.UIManager.logError(`Failed to load preset: ${presetKey}`);
                    return;
                }
            }
        }

        if (preset) {
            // THE FIX IS HERE: Suppress console warnings from buggy presets during loading.
            const originalConsoleError = console.error;
            const originalConsoleWarn = console.warn;
            console.error = () => {};
            console.warn = () => {};

            try {
                this.visualizer.loadPreset(preset, this.app.vizSettings.butterchurnBlendTime);
            } finally {
                // Always restore the original console functions, even if loadPreset fails.
                console.error = originalConsoleError;
                console.warn = originalConsoleWarn;
            }

            if (this.app.UIManager) {
                this.app.UIManager.updateButterchurnPresetDisplay(presetKey, index);
            }
        }
    },

    nextPreset() {
        const totalPresets = (this.activeEngine === '1') ? this.b1_presetKeys.length : this.b2_presetPaths.length;
        if (totalPresets === 0) return;
        this.loadPresetByIndex((this.currentPresetIndex + 1) % totalPresets);
    },

    prevPreset() {
        const totalPresets = (this.activeEngine === '1') ? this.b1_presetKeys.length : this.b2_presetPaths.length;
        if (totalPresets === 0) return;
        this.loadPresetByIndex((this.currentPresetIndex - 1 + totalPresets) % totalPresets);
    },

    randomPreset() {
        const totalPresets = (this.activeEngine === '1') ? this.b1_presetKeys.length : this.b2_presetPaths.length;
        if (totalPresets < 2) return;
        let newIndex = this.currentPresetIndex;
        while (newIndex === this.currentPresetIndex) { 
            newIndex = Math.floor(Math.random() * totalPresets); 
        }
        this.loadPresetByIndex(newIndex);
    },

    updateCycleInterval() {
        if (this.presetCycleInterval) clearInterval(this.presetCycleInterval);
        const totalPresets = (this.activeEngine === '1') ? this.b1_presetKeys.length : this.b2_presetPaths.length;
        if (this.app.vizSettings.butterchurnEnableCycle && totalPresets > 0) {
            this.presetCycleInterval = setInterval(() => this.randomPreset(), this.app.vizSettings.butterchurnCycleTime * 1000);
        }
    },

    activate() {
        if (this.visualizerCanvas && this.app.butterchurnMaterial && !this.app.butterchurnTexture) {
            this.app.butterchurnTexture = new this.app.THREE.CanvasTexture(this.visualizerCanvas);
            this.app.butterchurnTexture.minFilter = this.app.THREE.LinearFilter; 
            this.app.butterchurnTexture.magFilter = this.app.THREE.LinearFilter;
        }
        if (this.app.butterchurnMaterial && this.app.butterchurnTexture) {
            this.app.butterchurnMaterial.map = this.app.butterchurnTexture;
            this.app.butterchurnMaterial.color.set(this.app.vizSettings.butterchurnTintColor);
            this.app.butterchurnMaterial.opacity = this.app.vizSettings.butterchurnOpacity;
            this.app.butterchurnMaterial.needsUpdate = true;
        }
    },

    deactivate() {
        this.destroyVisualizer();
        this.activeEngine = null;
    },

    render() { 
        if (this.visualizer) { 
            this.visualizer.render(); 
        } 
    }
};