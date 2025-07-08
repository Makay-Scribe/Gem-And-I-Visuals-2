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
                if (el.type === 'checkbox') {
                    el.checked = this.app.vizSettings[key];
                } else if (el.type === 'range') {
                    el.value = this.app.vizSettings[key];
                    this.updateRangeDisplay(key, el.value);
                } else {
                    el.value = this.app.vizSettings[key];
                }
            }
        });

        this.setupMasterControls();
        this.setupEQCanvas(); 
        this.setupEventListeners();
        this.setupFollowerGlow();
        this.updateBackgroundControlsVisibility(true);
        this.updateWarpControlsVisibility(true);
        
        this.updateMasterControls();
        this.openDebugAccordions(); 
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

    // RENAMED & REFACTORED: This function now reads directly from the world pivot's
    // target position, making it the single source of truth for the UI.
    syncManualSlidersFromPivot() {
        const targetPosition = this.app.interactionState.targetPosition;
        const UIElements = this.controlDOMElements;

        if (targetPosition && UIElements.sliderX) {
            UIElements.sliderX.value = targetPosition.x;
            UIElements.sliderY.value = targetPosition.y;
            UIElements.sliderZ.value = targetPosition.z;
            this.updateRangeDisplay('actorX', targetPosition.x);
            this.updateRangeDisplay('actorY', targetPosition.y);
            this.updateRangeDisplay('actorDepth', targetPosition.z);
        }
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

        // Temporarily disable the autopilot toggle
        UIElements.manualAutoToggle.disabled = true;
        UIElements.manualAutoToggle.parentElement.style.opacity = '0.4';
        UIElements.manualAutoToggle.parentElement.title = 'Autopilot is temporarily disabled during rework.';

        for (let i = 1; i <= 4; i++) {
            const buttonId = `autopilotPreset${i}`;
            const button = document.getElementById(buttonId);
            if(button) {
                // Disable the autopilot preset buttons but leave them as placeholders
                button.disabled = true;
                button.style.opacity = '0.4';
                button.title = 'Autopilot is temporarily disabled during rework.';
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

    // REFACTORED: This function now directly controls the one-and-only world pivot target.
    handleActorSliderInput(slider) {
        const targetPosition = this.app.interactionState.targetPosition;
        const value = parseFloat(slider.value);
        
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
        let isAutopilotOn, scaleProp, speedProp;
        
        UIElements.actorToggleContainer.querySelectorAll('button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.actor === activeControl);
        });

        if (activeControl === 'landscape') {
            isAutopilotOn = S.landscapeAutopilotOn;
            scaleProp = 'landscapeScale';
            speedProp = 'landscapeAutopilotSpeed';
        } else {
            isAutopilotOn = S.modelAutopilotOn;
            scaleProp = 'modelScale';
            speedProp = 'modelAutopilotSpeed';
        }
        
        // This logic is kept for when we re-enable autopilot
        UIElements.manualAutoToggle.checked = isAutopilotOn;
        UIElements.manualContainer.style.display = isAutopilotOn ? 'none' : 'block';
        UIElements.masterSpeedContainer.style.display = isAutopilotOn ? 'block' : 'none';

        if(UIElements.masterScaleSlider) {
            UIElements.masterScaleSlider.value = S[scaleProp];
            this.updateRangeDisplay('masterScale', S[scaleProp]);
        }
        if(UIElements.masterSpeedSlider) {
            UIElements.masterSpeedSlider.value = S[speedProp];
            this.updateRangeDisplay('masterSpeed', S[speedProp]);
        }
        
        // Use the new sync function to ensure sliders reflect the pivot's state.
        this.syncManualSlidersFromPivot();

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
             if (['masterScale', 'modelSpinSpeed', 'landscapeSpinSpeed', 'butterchurnAudioInfluence', 'peelAmount', 'peelCurl', 'sagAudioMod', 'droopAudioMod', 'droopSupportedWidthFactor', 'droopSupportedDepthFactor', 'cylinderRadius', 'cylinderHeightScale', 'bendAudioMod', 'foldDepth', 'foldRoundness', 'foldNudge', 'foldCreaseDepth', 'foldCreaseSharpness', 'foldTuckAmount', 'foldTuckReach'].includes(id)) {
                precision = 2;
            } else if (['deformationStrength', 'audioSmoothing', 'metalness', 'roughness', 'reflectionStrength', 'toneMappingExposure', 'peelDrift', 'peelTextureAmount', 'sagAmount', 'sagFalloffSharpness', 'droopAmount', 'droopFalloffSharpness', 'bendFalloffSharpness'].includes(id)) {
                precision = 2;
            } else if (id === 'butterchurnBlendTime' || id === 'butterchurnCycleTime' || ['actorX', 'actorY', 'actorDepth', 'cylinderArcAngle', 'cylinderArcOffset', 'bendAngle', 'foldAngle', 'foldAudioMod'].includes(id)) {
                precision = 0;
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
        if (mode === 'butterchurn' && this.app.ButterchurnManager && !this.app.ButterchurnManager.visualizer) {
            this.app.AudioProcessor.connectButterchurn();
        }
        if (!isInitial) this.refreshAccordion(document.getElementById('backgroundMode'));
    },
    
    updateWarpControlsVisibility(isInitial = false) {
        const mode = this.app.vizSettings.warpMode;
        const sagControls = document.getElementById('warpSagControls');
        const droopControls = document.getElementById('warpDroopControls');
        const cylinderControls = document.getElementById('warpCylinderControls');
        const bendControls = document.getElementById('warpBendControls');
        const foldControls = document.getElementById('warpFoldControls');
        
        if (sagControls) sagControls.style.display = (mode === 'sag') ? 'block' : 'none';
        if (droopControls) droopControls.style.display = (mode === 'droop') ? 'block' : 'none';
        if (cylinderControls) cylinderControls.style.display = (mode === 'cylinder') ? 'block' : 'none';
        if (bendControls) bendControls.style.display = (mode === 'bend') ? 'block' : 'none';
        if (foldControls) foldControls.style.display = (mode === 'fold') ? 'block' : 'none';

        if (!isInitial) this.refreshAccordion(document.getElementById('warpMode'));
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

        const gpgpuDebugCheckbox = document.getElementById('enableGPGPUDebugger');
        if (gpgpuDebugCheckbox) {
            gpgpuDebugCheckbox.addEventListener('change', (e) => {
                this.app.vizSettings.enableGPGPUDebugger = e.target.checked;
            });
        }

        document.querySelectorAll('input:not([type="file"]):not(#enableGPGPUDebugger), select').forEach(control => {
            if (control.closest('#cameraOptions')) return;
            
            control.addEventListener('input', (e) => {
                const id = e.target.id;
                if (!id) return;
                const S = this.app.vizSettings;
                let value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;

                if (e.target.type === 'checkbox') {
                    S[id] = value;
                } else if (e.target.type === 'range' || e.target.type === 'number' || e.target.id === 'peelAnimationStyle') {
                    S[id] = parseFloat(value);
                } else {
                    S[id] = value;
                }
                
                if (e.target.type !== 'checkbox' || id === 'butterchurnEnableCycle') this.updateRangeDisplay(id, value);
                
                if (id === 'backgroundMode') this.updateBackgroundControlsVisibility();
                if (id === 'warpMode') this.updateWarpControlsVisibility();
                if (id === 'enableLightOrbit') this.toggleLightSliders();
                if (id === 'planeAspectRatio' || id === 'planeOrientation') {
                    this.app.ImagePlaneManager.createDefaultLandscape();
                    if (this.app.vizSettings.landscapeAutopilotOn && this.app.vizSettings.activeLandscapePreset) {
                        this.app.ImagePlaneManager.startAutopilot(this.app.vizSettings.activeLandscapePreset);
                    }
                }
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
        
        for (let i = 1; i <= 8; i++) {
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
    },

    setupButterchurnEventListeners() {
        const speedSlider = document.getElementById('butterchurnSpeed');
        if (speedSlider) speedSlider.addEventListener('input', (e) => { this.app.vizSettings.butterchurnSpeed = parseInt(e.target.value); this.updateRangeDisplay('butterchurnSpeed', e.target.value); });
        
        const audioInfluence = document.getElementById('butterchurnAudioInfluence');
        if (audioInfluence) audioInfluence.addEventListener('input', (e) => { this.app.vizSettings.butterchurnAudioInfluence = parseFloat(e.target.value); this.updateRangeDisplay('butterchurnAudioInfluence', e.target.value); if (this.app.AudioProcessor.butterchurnGainNode) this.app.AudioProcessor.butterchurnGainNode.gain.value = e.target.value; });
        
        const blendTime = document.getElementById('butterchurnBlendTime');
        if (blendTime) blendTime.addEventListener('input', (e) => { this.app.vizSettings.butterchurnBlendTime = parseFloat(e.target.value); this.updateRangeDisplay('butterchurnBlendTime', e.target.value); });
        
        const cycleTime = document.getElementById('butterchurnCycleTime');
        if (cycleTime) cycleTime.addEventListener('input', (e) => { this.app.vizSettings.butterchurnCycleTime = parseFloat(e.target.value); this.updateRangeDisplay('butterchurnCycleTime', e.target.value); this.app.ButterchurnManager.updateCycleInterval(); });
        
        const opacitySlider = document.getElementById('butterchurnOpacity');
        if (opacitySlider) opacitySlider.addEventListener('input', (e) => { this.app.vizSettings.butterchurnOpacity = parseFloat(e.target.value); this.updateRangeDisplay('butterchurnOpacity', e.target.value); if(this.app.butterchurnMaterial) this.app.butterchurnMaterial.opacity = e.target.value; });
        
        const tintColor = document.getElementById('butterchurnTintColor');
        if (tintColor) tintColor.addEventListener('input', (e) => { this.app.vizSettings.butterchurnTintColor = e.target.value; if(this.app.butterchurnMaterial) this.app.butterchurnMaterial.color.set(e.target.value); });
        
        const enableCycle = document.getElementById('butterchurnEnableCycle');
        if (enableCycle) enableCycle.addEventListener('change', (e) => { this.app.vizSettings.butterchurnEnableCycle = e.target.checked; this.app.ButterchurnManager.updateCycleInterval(); });
        
        document.getElementById('butterchurnPrevPreset').addEventListener('click', () => this.app.ButterchurnManager.prevPreset());
        document.getElementById('butterchurnRandomPreset').addEventListener('click', () => this.app.ButterchurnManager.randomPreset());
        document.getElementById('butterchurnNextPreset').addEventListener('click', () => this.app.ButterchurnManager.nextPreset());
        document.getElementById('butterchurnSearchButton').addEventListener('click', () => this.filterButterchurnPresets());
        document.getElementById('butterchurnPresetSearch').addEventListener('keyup', (e) => { if (e.key === 'Enter') this.filterButterchurnPresets(); });
        document.getElementById('butterchurnPresetList').addEventListener('change', (e) => { const selectedIndex = parseInt(e.target.value); if (!isNaN(selectedIndex)) this.app.ButterchurnManager.loadPresetByIndex(selectedIndex); });
    },

    filterButterchurnPresets() {
        const searchTerm = document.getElementById('butterchurnPresetSearch').value.toLowerCase();
        const listElement = document.getElementById('butterchurnPresetList');
        const allKeys = this.app.ButterchurnManager.presetKeys;

        if (!allKeys || allKeys.length === 0) {
            listElement.innerHTML = '<option disabled>No presets loaded.</option>';
            return;
        }

        listElement.innerHTML = '';
        const filteredKeys = searchTerm === '' ? allKeys : allKeys.filter(key => key.toLowerCase().includes(searchTerm));

        if (filteredKeys.length === 0) {
            listElement.innerHTML = '<option disabled>No matching presets found.</option>';
        } else {
            filteredKeys.forEach(key => {
                const originalIndex = allKeys.indexOf(key);
                const option = document.createElement('option');
                option.value = originalIndex;
                option.textContent = key.split(" - ").pop();
                listElement.appendChild(option);
            });
        }
        
        document.getElementById('butterchurnTotalPresets').textContent = filteredKeys.length;

        const currentPresetIsVisible = filteredKeys.some(key => allKeys.indexOf(key) === this.app.ButterchurnManager.currentPresetIndex);
        if (currentPresetIsVisible) {
            listElement.value = this.app.ButterchurnManager.currentPresetIndex;
        } else if (listElement.options.length > 0 && !listElement.options[0].disabled) {
            listElement.selectedIndex = 0;
        }
        this.refreshAccordion(listElement);
    },

    updateButterchurnPresetDisplay(presetKey, index) {
        document.getElementById('butterchurnCurrentPresetName').textContent = presetKey.split(" - ").pop();
        const listElement = document.getElementById('butterchurnPresetList');
        if (listElement) listElement.value = index;
    },

    handleFileSelect(event, id) {
        const file = event.target.files[0]; 
        if (!file) return; 

        if (id.startsWith('iChannel')) {
            const channelIndex = parseInt(id.charAt(id.length - 1));
            this.app.ShaderManager.loadChannelTexture(channelIndex, file);
            return;
        }

        switch (id) {
            case 'mainTextureInput': 
            case 'videoTextureInput':
                this.updateFileNameDisplay(id === 'videoTextureInput' ? 'video' : 'image', file.name);
                this.app.ImagePlaneManager.loadTexture(file);
                this.setGlowTarget('audio');
                break;
            case 'audioFileInput': 
                this.updateFileNameDisplay('audio', file.name); 
                if (this.app.AudioProcessor) this.app.AudioProcessor.loadAudioFile(file);
                this.setGlowTarget('play');
                break;
            case 'hdriInput': 
                this.updateFileNameDisplay('hdri', file.name);
                if(this.app.SceneManager) this.app.SceneManager.loadHDRI(file);
                break;
            case 'gltfModelInput':
                this.updateFileNameDisplay('gltf', file.name);
                this.app.ModelManager.loadGLTFModel(file.path); // Should be file, not file.path
                break;
        }
    },
    updateFileNameDisplay(type, name) {
       const idMap = {
            'image': 'imageFileName', 'video': 'videoFileName',
            'audio': 'audioFileName', 'hdri': 'hdriFileName', 'gltf': 'gltfFileName'
        };
        const elementId = idMap[type];
        if (elementId) {
            const el = document.getElementById(elementId);
            if (el) el.textContent = name;
        }
    },
    updateAudioStatus(sourceType, statusText = '') {
        if (!this.audioStatusP) { return; }
        const playButton = document.getElementById('playPauseAudioButton'); 
        let message = '';
        switch (sourceType) {
            case 'none': message = "AUDIO: IDLE"; break; 
            case 'mic': message = "AUDIO: Mic/System"; this.setGlowTarget(null); break; 
            case 'file_ready': message = "AUDIO: File Ready"; if (playButton) playButton.textContent = "Play File"; break; 
            case 'file_playing': message = "AUDIO: Playing"; if (playButton) playButton.textContent = "Pause File"; break; 
            case 'file_paused': message = "AUDIO: Paused"; if (playButton) playButton.textContent = "Play File"; break; 
            case 'testTone': message = "AUDIO: Test Tone"; this.setGlowTarget(null); break;
            case 'error': message = `ERROR: ${statusText}`; break;
        }
        this.audioStatusP.textContent = message;
    },
    setupEQCanvas() {
        this.eqCanvas = document.getElementById('eqVisualizerCanvas'); 
        if (!this.eqCanvas) { console.warn("UIManager.setupEQCanvas: #eqVisualizerCanvas not found."); return; } 
        this.eqCtx = this.eqCanvas.getContext('2d'); 
        this.eqCanvas.width = this.eqCanvas.clientWidth; 
        this.eqCanvas.height = this.eqCanvas.clientHeight; 
        this.eqGradient = this.eqCtx.createLinearGradient(0, 0, this.eqCanvas.width, 0); 
        this.eqGradient.addColorStop(0, '#007AFF'); 
        this.eqGradient.addColorStop(0.5, '#5856D6'); 
        this.eqGradient.addColorStop(1, '#FF2D55');
    },
    updateEQ(data) {
        if (!this.eqCtx || !data) return; 
        const { width, height } = this.eqCanvas; 
        this.eqCtx.clearRect(0, 0, width, height); 
        const numBars = 64; 
        const barWidth = width / numBars; 
        this.eqCtx.fillStyle = this.eqGradient;
        for (let i = 0; i < numBars; i++) { 
            const logIndex = Math.floor(Math.pow(i / numBars, 2) * (data.length * 0.8)); 
            const value = data[logIndex] / 255.0; 
            if (value > 0) this.eqCtx.fillRect(i * barWidth, height - (value * height), barWidth, value * height); 
        }
    },
    resetLandscapeSettings() {
        const S = this.app.vizSettings;
        const D = this.app.defaultVisualizerSettings;
    
        const landscapeKeys = [
            'enableLandscape', 'landscapeSpinSpeed', 'planeAspectRatio', 'planeOrientation', 
            'deformationStrength', 'enablePeel', 'peelAmount', 'peelCurl', 'peelAnimationStyle', 
            'peelDrift', 'peelTextureAmount', 'peelAudioSource', 'warpMode', 
            'sagAmount', 'sagFalloffSharpness', 'sagAudioMod', 
            'droopAmount', 'droopAudioMod', 'droopFalloffSharpness', 'droopSupportedWidthFactor', 'droopSupportedDepthFactor',
            'cylinderRadius', 'cylinderHeightScale', 'cylinderAxisAlignment', 'cylinderArcAngle', 'cylinderArcOffset',
            'bendAngle', 'bendAudioMod', 'bendFalloffSharpness', 'bendAxis',
            'foldAngle', 'foldDepth', 'foldRoundness', 'foldAudioMod', 'foldNudge',
            'enableFoldCrease', 'foldCreaseDepth', 'foldCreaseSharpness',
            'enableFoldTuck', 'foldTuckAmount', 'foldTuckReach'
        ];
    
        landscapeKeys.forEach(key => {
            if (D[key] !== undefined) {
                S[key] = D[key];
                const el = document.getElementById(key);
                if (el) {
                    if (el.type === 'checkbox') {
                        el.checked = D[key];
                    } else {
                        el.value = D[key];
                    }
                    if (el.type === 'range') {
                        this.updateRangeDisplay(key, D[key]);
                    }
                }
            }
        });
    
        this.updateWarpControlsVisibility();
        this.app.ImagePlaneManager.createDefaultLandscape();
    
        this.logSuccess("Landscape settings reset.");
    }
};