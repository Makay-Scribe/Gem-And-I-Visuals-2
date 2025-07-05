import { Debugger } from './Debugger.js';

export const UIManager = {
    app: null,
    _debugTimeout: null, 
    eqCanvas: null, 
    eqCtx: null, 
    eqGradient: null, 
    audioStatusP: null, 
    debugDisplay: null,
    controlDOMElements: {},
    glowTargets: {},
    currentGlowTarget: null,

    init(appInstance) {
        this.app = appInstance;

        this.audioStatusP = document.getElementById('audioStatusP'); 
        this.debugDisplay = document.getElementById('debugDisplay');
        
        Object.keys(this.app.defaultVisualizerSettings).forEach(key => {
            const el = document.getElementById(key);
            if (el && !el.closest('#cameraOptions')) { 
                if (el.type === 'checkbox') el.checked = this.app.vizSettings[key];
                else el.value = this.app.vizSettings[key];
            }
        });

        this.setupMasterControls();
        this.setupEQCanvas(); 
        this.setupEventListeners();
        this.setupFollowerGlow();
        this.updateBackgroundControlsVisibility(true);
        
        this.updateMasterControls();
        this.openDebugAccordions(); 
        
        setTimeout(() => this.filterButterchurnPresets(), 100);
    },
    
    openDebugAccordions() {
        document.querySelectorAll('.accordion-header.debug-header').forEach(header => {
            const content = header.nextElementSibling;
            if (content && content.classList.contains('accordion-content')) {
                content.classList.add('open');
                content.style.maxHeight = content.scrollHeight + 'px';
            }
        });
    },

    setupMasterControls() {
        const UIElements = {
            actorToggleContainer: document.getElementById('actorControlToggle'),
            manualAutoToggle: document.getElementById('manualAutoToggle'),
            autopilotContainer: document.getElementById('autopilotControlsContainer'),
            manualContainer: document.getElementById('manualPositionControls'),
            masterControlContainer: document.getElementById('masterActorControls'),
            masterScaleSlider: document.getElementById('masterScale'),
            masterSpeedContainer: document.getElementById('masterSpeedContainer'),
            masterSpeedSlider: document.getElementById('masterSpeed'),
            sliderX: document.getElementById('actorX'),
            sliderY: document.getElementById('actorY'),
            sliderZ: document.getElementById('actorDepth'),
        };
        this.controlDOMElements = UIElements;

        UIElements.actorToggleContainer.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', (e) => this.app.switchActiveControl(e.target.dataset.actor));
        });

        UIElements.manualAutoToggle.addEventListener('change', (e) => {
            const isAuto = e.target.checked;
            const activeControl = this.app.vizSettings.activeControl;
            
            if (activeControl === 'landscape') {
                this.app.vizSettings.landscapeAutopilotOn = isAuto;
                if (!isAuto) {
                    this.app.vizSettings.activeLandscapePreset = null;
                    if(this.app.ImagePlaneManager) this.app.ImagePlaneManager.returnToHome();
                }
            } else if (activeControl === 'model') {
                this.app.vizSettings.modelAutopilotOn = isAuto;
                if (!isAuto) {
                    this.app.vizSettings.activeModelPreset = null;
                    if(this.app.ModelManager) this.app.ModelManager.returnToHome();
                }
            }
            this.updateMasterControls();
        });

        for (let i = 1; i <= 4; i++) {
            const buttonId = `autopilotPreset${i}`;
            const button = document.getElementById(buttonId);
            if(button) {
                button.addEventListener('click', () => {
                    const activeControl = this.app.vizSettings.activeControl;
                    const toggle = UIElements.manualAutoToggle;
                    if (!toggle.checked) {
                        toggle.checked = true;
                        toggle.dispatchEvent(new Event('change'));
                    }
                    if (activeControl === 'landscape') {
                        this.app.vizSettings.landscapeAutopilotOn = true;
                        this.app.vizSettings.activeLandscapePreset = buttonId;
                        this.app.ImagePlaneManager.startAutopilot(buttonId); // HOOKED UP
                    } else {
                        this.app.vizSettings.modelAutopilotOn = true;
                        this.app.vizSettings.activeModelPreset = buttonId;
                        this.app.ModelManager.startAutopilot(buttonId); // HOOKED UP
                    }
                    this.updateMasterControls();
                });
            }
        }
        
        [UIElements.sliderX, UIElements.sliderY, UIElements.sliderZ].forEach(slider => {
            slider.addEventListener('input', (e) => this.handleActorSliderInput(e.target));
        });

        UIElements.masterScaleSlider.addEventListener('input', (e) => this.handleMasterControlInput(e.target));
        UIElements.masterSpeedSlider.addEventListener('input', (e) => this.handleMasterControlInput(e.target));
    },

    handleMasterControlInput(slider) {
        const S = this.app.vizSettings;
        const activeControl = S.activeControl;
        const value = parseFloat(slider.value);
        let targetProp;
        if (slider.id === 'masterScale') {
            targetProp = (activeControl === 'landscape') ? 'landscapeScale' : 'modelScale';
        } else {
            targetProp = (activeControl === 'landscape') ? 'landscapeAutopilotSpeed' : 'modelAutopilotSpeed';
        }
        S[targetProp] = value;
        this.updateRangeDisplay(slider.id, value);
    },

    handleActorSliderInput(slider) {
        const S = this.app.vizSettings;
        const activeControl = S.activeControl;
        const value = parseFloat(slider.value);
        let targetPosition;
        if (activeControl === 'landscape') {
            targetPosition = S.manualLandscapePosition;
        } else if (activeControl === 'model') {
            targetPosition = S.manualModelPosition;
        }
        if (!targetPosition) return;
        switch (slider.id) {
            case 'actorX': targetPosition.x = value; break;
            case 'actorY': targetPosition.y = value; break;
            case 'actorDepth': targetPosition.z = value; break;
        }
        this.updateRangeDisplay(slider.id, value);
    },

    updateMasterControls() {
        const S = this.app.vizSettings;
        const activeControl = S.activeControl;
        const UIElements = this.controlDOMElements;
        let targetPosition, isAutopilotOn, scaleProp, speedProp;
        
        UIElements.actorToggleContainer.querySelectorAll('button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.actor === activeControl);
        });

        if (activeControl === 'landscape') {
            targetPosition = S.manualLandscapePosition;
            isAutopilotOn = S.landscapeAutopilotOn;
            scaleProp = 'landscapeScale';
            speedProp = 'landscapeAutopilotSpeed';
        } else {
            targetPosition = S.manualModelPosition;
            isAutopilotOn = S.modelAutopilotOn;
            scaleProp = 'modelScale';
            speedProp = 'modelAutopilotSpeed';
        }
        
        UIElements.manualAutoToggle.checked = isAutopilotOn;
        UIElements.manualContainer.style.display = isAutopilotOn ? 'none' : 'block';
        UIElements.autopilotContainer.style.display = isAutopilotOn ? 'block' : 'none';
        UIElements.masterSpeedContainer.style.display = isAutopilotOn ? 'block' : 'none';

        if(UIElements.masterScaleSlider) {
            UIElements.masterScaleSlider.value = S[scaleProp];
            this.updateRangeDisplay('masterScale', S[scaleProp]);
        }
        if(UIElements.masterSpeedSlider) {
            UIElements.masterSpeedSlider.value = S[speedProp];
            this.updateRangeDisplay('masterSpeed', S[speedProp]);
        }
        
        if (targetPosition) {
            UIElements.sliderX.value = targetPosition.x;
            UIElements.sliderY.value = targetPosition.y;
            UIElements.sliderZ.value = targetPosition.z;
            this.updateRangeDisplay('actorX', targetPosition.x);
            this.updateRangeDisplay('actorY', targetPosition.y);
            this.updateRangeDisplay('actorDepth', targetPosition.z);
        }

        this.updatePresetGlow();
        this.refreshAccordion(UIElements.masterControlContainer);
    },
    
    updatePresetGlow() {
        const S = this.app.vizSettings;
        let activePreset;
        if (S.activeControl === 'landscape') { activePreset = S.activeLandscapePreset; } 
        else { activePreset = S.activeModelPreset; }
        for (let i = 1; i <= 4; i++) {
            const button = document.getElementById(`autopilotPreset${i}`);
            if(button) button.classList.remove('button-glow-effect');
        }
        if (activePreset) {
            const button = document.getElementById(activePreset);
            if (button) button.classList.add('button-glow-effect');
        }
    },

    setupFollowerGlow() {
        this.glowTargets = {
            image: document.querySelector('.browse-btn[data-target="mainTextureInput"]'),
            audio: document.querySelector('.browse-btn[data-target="audioFileInput"]'),
            play: document.getElementById('playPauseAudioButton')
        };
        this.setGlowTarget('image');
    },

    setGlowTarget(targetKey) {
        if (this.currentGlowTarget && this.currentGlowTarget.classList) {
            this.currentGlowTarget.classList.remove('button-glow-effect');
        }
        if (targetKey && this.glowTargets[targetKey]) {
            this.currentGlowTarget = this.glowTargets[targetKey];
            this.currentGlowTarget.classList.add('button-glow-effect');
        } else {
            this.currentGlowTarget = null;
        }
    },

    logError(message) { 
        if (!this.debugDisplay) return; 
        this.debugDisplay.textContent = message; 
        this.debugDisplay.className = 'debugDisplay error'; 
        if (this._debugTimeout) clearTimeout(this._debugTimeout); 
        this._debugTimeout = setTimeout(() => { this.debugDisplay.textContent = ''; this.debugDisplay.className = 'debugDisplay'; }, 8000); 
    },

    logSuccess(message) { 
        if (!this.debugDisplay) return; 
        this.debugDisplay.textContent = message; 
        this.debugDisplay.className = 'debugDisplay success'; 
        if (this._debugTimeout) clearTimeout(this._debugTimeout); 
        this._debugTimeout = setTimeout(() => { this.debugDisplay.textContent = ''; this.debugDisplay.className = 'debugDisplay'; }, 5000); 
    },

    updateRangeDisplay(id, value) {
        const display = document.getElementById(id + 'Value');
        if (display) {
            let precision = 1;
             if (['masterScale', 'modelSpinSpeed', 'landscapeSpinSpeed', 'butterchurnAudioInfluence'].includes(id)) {
                precision = 2;
            } else if (['deformationStrength', 'audioSmoothing', 'metalness', 'roughness', 'reflectionStrength', 'toneMappingExposure'].includes(id)) {
                precision = 2;
            } else if (id === 'butterchurnBlendTime' || id === 'butterchurnCycleTime') {
                precision = 1;
            }
            display.textContent = parseFloat(value).toFixed(precision);
        }
    },

    updateBackgroundControlsVisibility(isInitial = false) {
        const mode = this.app.vizSettings.backgroundMode;
        const shaderControls = document.getElementById('shaderToyControls');
        const butterchurnControls = document.getElementById('butterchurnControls');
        if (shaderControls) shaderControls.style.display = (mode === 'shader') ? 'block' : 'none';
        if (butterchurnControls) butterchurnControls.style.display = (mode === 'butterchurn') ? 'block' : 'none';
        if (mode === 'butterchurn' && !this.app.ButterchurnManager.visualizer) {
            this.app.AudioProcessor.connectButterchurn();
        }
        if (!isInitial) this.refreshAccordion(document.getElementById('backgroundMode'));
    },

    toggleLightSliders() { 
        const disabled = this.app.vizSettings.enableLightOrbit; 
        document.getElementById('lightDirectionX').disabled = disabled;
        document.getElementById('lightDirectionZ').disabled = disabled;
    },

    refreshAccordion(elementInside) {
        if (!elementInside) return;
        let parent = elementInside.closest('.accordion-content.open');
        while (parent) {
            parent.style.maxHeight = 'none';
            parent.style.maxHeight = parent.scrollHeight + 'px';
            parent = parent.parentElement.closest('.accordion-content.open');
        }
    },
    
    setupEventListeners() {
        document.getElementById('toggleMicInput').addEventListener('click', () => this.app.AudioProcessor.startMic());
        document.getElementById('playPauseAudioButton').addEventListener('click', () => {
            this.app.AudioProcessor.toggleFilePlayback();
            this.setGlowTarget(null); 
        });
        document.getElementById('playTestToneButton').addEventListener('click', () => this.app.AudioProcessor.toggleTestTone());
        document.querySelectorAll('.browse-btn').forEach(btn => btn.addEventListener('click', () => document.getElementById(btn.dataset.target).click()));
        document.getElementById('loadShaderCode').addEventListener('click', () => this.app.ShaderManager.loadUserShader());
        document.getElementById('clearShaderCode').addEventListener('click', () => { document.getElementById('shaderToyGLSL').value = ''; this.app.vizSettings.shaderToyGLSL = ''; this.logSuccess('Shader cleared.'); });
        document.getElementById('pasteShaderCode').addEventListener('click', async () => { try { const text = await navigator.clipboard.readText(); document.getElementById('shaderToyGLSL').value = text; this.app.vizSettings.shaderToyGLSL = text; this.logSuccess('Pasted from clipboard.'); } catch (err) { this.logError('Failed to read from clipboard.'); } });
        document.getElementById('landscapeResetButton').addEventListener('click', () => this.resetLandscapeSettings());
        
        const fileInputIds = ['mainTextureInput', 'videoTextureInput', 'audioFileInput', 'gltfModelInput', 'hdriInput', 'iChannel0Input', 'iChannel1Input', 'iChannel2Input', 'iChannel3Input'];
        fileInputIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', (e) => this.handleFileSelect(e, id));
        });

        document.querySelectorAll('input:not([type="file"]), select').forEach(control => {
            if (control.closest('#cameraOptions')) return;
            
            control.addEventListener('input', (e) => {
                const id = e.target.id;
                if (!id) return;
                const S = this.app.vizSettings;
                let value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;

                if (e.target.type === 'checkbox') S[id] = value;
                else if (e.target.type === 'range' || e.target.type === 'number') S[id] = parseFloat(value);
                else S[id] = value;
                
                if (e.target.type !== 'checkbox' || id === 'butterchurnEnableCycle') this.updateRangeDisplay(id, value);
                
                if (id === 'backgroundMode') this.updateBackgroundControlsVisibility();
                if (id === 'enableLightOrbit') this.toggleLightSliders();
                if (id === 'planeAspectRatio') this.app.ImagePlaneManager.createDefaultLandscape();
            });
        });

        this.setupButterchurnEventListeners();

        document.getElementById('controlsToggleButton').addEventListener('click', (e) => { 
            const panel = document.getElementById('controlsPanel'); 
            panel.classList.toggle('visible'); 
            e.target.textContent = panel.classList.contains('visible') ? "Hide" : "Show"; 
        });

        document.querySelectorAll('.accordion-header').forEach(header => {
            header.addEventListener('click', () => {
                const content = header.nextElementSibling;
                if (!content || !content.classList.contains('accordion-content')) return;
                content.classList.toggle('open');
                if (content.classList.contains('open')) {
                    content.style.maxHeight = content.scrollHeight + 'px';
                } else {
                    content.style.maxHeight = '0px';
                }
                this.refreshAccordion(content);
            });
        });
        
        for (let i = 1; i <= 3; i++) {
            const btn = document.getElementById(`presetBg${i}`);
            if (btn) btn.addEventListener('click', () => { 
                const shaderCode = this.app.shaderPresets[`presetBg${i}`]; 
                if (shaderCode) { 
                    document.getElementById('shaderToyGLSL').value = shaderCode; 
                    this.app.vizSettings.shaderToyGLSL = shaderCode; 
                    this.logSuccess(`Preset 'presetBg${i}' loaded.`); 
                    document.getElementById('loadShaderCode').click(); 
                }
            });
        }
        
        Object.keys(this.app.modelPresets).forEach(presetId => {
            const btn = document.getElementById(presetId);
            if(btn) {
                btn.addEventListener('click', () => {
                    const preset = this.app.modelPresets[presetId];
                    if (preset) this.app.ModelManager.loadGLTFModel(preset.path);
                });
            }
        });

        const canvas = document.getElementById('glCanvas');
        canvas.addEventListener('mousedown', e => {
            this.app.mouseState.z = e.offsetX; this.app.mouseState.w = canvas.clientHeight - e.offsetY; this.app.mouseState.x = e.offsetX; this.app.mouseState.y = canvas.clientHeight - e.offsetY;
        });
        canvas.addEventListener('mouseup', () => {
            if (this.app.mouseState.z > 0) {
                 this.app.mouseState.z = -Math.abs(this.app.mouseState.z); this.app.mouseState.w = -Math.abs(this.app.mouseState.w);
            }
        });
        canvas.addEventListener('mousemove', e => { if (this.app.mouseState.z > 0) { this.app.mouseState.x = e.offsetX; this.app.mouseState.y = canvas.clientHeight - e.offsetY; } });
    },

    setupButterchurnEventListeners() {
        // ... (code unchanged)
    },

    filterButterchurnPresets() {
        // ... (code unchanged)
    },

    updateButterchurnPresetDisplay(presetKey, index) {
        document.getElementById('butterchurnCurrentPresetName').textContent = presetKey.split(" - ").pop();
        const listElement = document.getElementById('butterchurnPresetList');
        if (listElement) listElement.value = index;
    },

    handleFileSelect(event, id) {
        // ... (code unchanged)
    },
    updateFileNameDisplay(type, name) {
       // ... (code unchanged)
    },
    updateAudioStatus(sourceType, statusText = '') {
        // ... (code unchanged)
    },
    setupEQCanvas() {
        // ... (code unchanged)
    },
    updateEQ(data) {
        // ... (code unchanged)
    },
};