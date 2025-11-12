import { Debugger } from './Debugger.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const UIManager = {
    app: null,
    _debugTimeout: null, 
    eqCanvas: null, 
    eqCtx: null, 
    eqGradient: null, 
    audioStatusP: null, 
    debugDisplay: null,
    controlDOMElements: {},
    particleModelMesh: null, 
    particleModelTexture: null,
    gltfLoader: new GLTFLoader(),
    
    _isProgrammaticUpdate: false, 
    
    isFluidManualActive: false,
    
    gpgpuExclusiveGroups: [
        ['gpgpu_enableFold', 'gpgpu_enableCylinder'],
        ['gpgpu_enableCloth']
    ],

    demoShaderInterval: null,
    demoShaderOrder: ['presetBg6', 'presetBg7', 'presetBg8', 'presetBg1', 'presetBg2', 'presetBg3', 'presetBg4', 'presetBg5'],
    demoShaderIndex: 0,

    gpgpuPixelValueDisplay: null,
    isDisplayingPixelValue: false,

    init(appInstance) {
        this.app = appInstance;

        this.audioStatusP = document.getElementById('audioStatusP'); 
        this.debugDisplay = document.getElementById('debugDisplay');
        this.gpgpuPixelValueDisplay = document.getElementById('gpgpuDebugPixelValue');
        
        const toggleButton = document.getElementById('controlsToggleButton');
        if (toggleButton) {
            toggleButton.classList.add('button-glow-effect');
        }

        this.syncAllControlsToSettings(); 

        this.initImageEffectsControls();
        this.setupMasterControls();
        this.setupEQCanvas(); 
        this.setupEventListeners();

        this._updateGpgpuModeVisibility();
        this._updateDeformationPanelStates(); 
        
        this.updateBackgroundControlsVisibility(true);
        this.updateImageEffectsVisibility(true);

        this.updateMasterControls();
        
        this.app.ParticleTransitions.setActivePreset('default');
    },
    
    syncSlidersFromState() {
        if (!this.app) return;
        this._isProgrammaticUpdate = true;
        const S = this.app.vizSettings;
        
        const fluidAttractionSlider = document.getElementById('fluidAttraction');
        if (fluidAttractionSlider && this.app.ComputeManager?.velocityVariable) {
             const strengthValue = this.app.ComputeManager.velocityVariable.material.uniforms.fluid_attractionStrength.value;
             fluidAttractionSlider.value = strengthValue;
             this.updateRangeDisplay('fluidAttraction', strengthValue);
        }

        const particleMorphSlider = document.getElementById('particle_morphProgress');
        if (particleMorphSlider) {
            particleMorphSlider.value = S.particle_morphProgress;
            this.updateRangeDisplay('particle_morphProgress', S.particle_morphProgress);
        }

        this._isProgrammaticUpdate = false;
    },

    syncAllControlsToSettings() {
        this._isProgrammaticUpdate = true;
        
        Object.keys(this.app.defaultVisualizerSettings).forEach(key => {
            const el = document.getElementById(key);
            if (el) { 
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

        document.querySelectorAll('.header-toggle-checkbox').forEach(checkbox => {
            if (this.app.vizSettings[checkbox.id] !== undefined) {
                checkbox.checked = this.app.vizSettings[checkbox.id];
            }
        });
        
        this._isProgrammaticUpdate = false;
    },
    
    initImageEffectsControls() {
        const S = this.app.vizSettings;
        const controls = [
            'imageEffectType', 'imageEffect_targetColor', 'imageEffect_colorTolerance',
            'imageEffect_edgeSoftness', 'imageEffect_tintColor', 'imageEffect_pointX',
            'imageEffect_pointY', 'imageEffect_strength', 'imageEffect_radius',
            'imageEffect_audioInfluence'
        ];

        controls.forEach(key => {
            const el = document.getElementById(key);
            if (el) {
                if (el.type === 'range') {
                    el.value = S[key];
                    this.updateRangeDisplay(key, el.value);
                } else {
                    el.value = S[key];
                }
            }
        });
    },

    syncManualSlidersFromState() {
        this._isProgrammaticUpdate = true;

        const S = this.app.vizSettings;
        const UIElements = this.controlDOMElements;
        
        const activeManager = (S.activeControl === 'landscape') ? this.app.ImagePlaneManager : this.app.ModelManager;
        
        if (!activeManager || !activeManager.state) {
            this._isProgrammaticUpdate = false;
            return;
        }
        
        const targetPosition = activeManager.state.targetPosition;

        if (targetPosition && UIElements.sliderX) {
            UIElements.sliderX.value = targetPosition.x;
            UIElements.sliderY.value = targetPosition.y;
            UIElements.sliderZ.value = targetPosition.z;
            this.updateRangeDisplay('actorX', targetPosition.x);
            this.updateRangeDisplay('actorY', targetPosition.y);
            this.updateRangeDisplay('actorDepth', targetPosition.z);
        }
        
        this._isProgrammaticUpdate = false;
    },

    setupMasterControls() {
        const UIElements = {
            actorToggleContainer: document.getElementById('actorControlToggle'),
            autopilotHeader: document.getElementById('autopilotHeader'),
            autopilotPresetContainer: document.getElementById('autopilotPresetContainer'),
            autopilotOffButton: document.getElementById('autopilotOffButton'),
            manualContainer: document.getElementById('manualPositionControls'),
            masterControlContainer: document.getElementById('masterActorControls'),
            masterScaleSlider: document.getElementById('masterScale'),
            masterSpeedContainer: document.getElementById('masterSpeedContainer'),
            masterSpeedSlider: document.getElementById('masterSpeed'),
            sliderX: document.getElementById('actorX'),
            sliderY: document.getElementById('actorY'),
            sliderZ: document.getElementById('actorDepth'),
            masterSpinCheckbox: document.getElementById('masterEnableSpin'),
            masterSpinSpeedInput: document.getElementById('masterSpinSpeed'),
            masterSpinControl: document.getElementById('masterSpinControl'),
        };
        this.controlDOMElements = UIElements;

        UIElements.actorToggleContainer.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', (e) => {
                this.app.vizSettings.activeControl = e.target.dataset.actor;
                this.updateMasterControls();
            });
        });

        for (let i = 1; i <= 5; i++) {
            const buttonId = `autopilotPreset${i}`;
            const button = document.getElementById(buttonId);
            if(button) {
                button.addEventListener('click', () => {
                    const activeControl = this.app.vizSettings.activeControl;
                    const S = this.app.vizSettings;
                    const activeManager = (activeControl === 'landscape') ? this.app.ImagePlaneManager : this.app.ModelManager;
                    
                    if (activeControl === 'landscape') {
                        S.landscapeAutopilotOn = true;
                        S.activeLandscapePreset = buttonId;
                    } else {
                        S.modelAutopilotOn = true;
                        S.activeModelPreset = buttonId;
                    }
                    activeManager.startAutopilot(buttonId);
                    this.updateMasterControls();
                });
            }
        }

        UIElements.autopilotOffButton.addEventListener('click', () => {
            const activeControl = this.app.vizSettings.activeControl;
            const S = this.app.vizSettings;
            const activeManager = (activeControl === 'landscape') ? this.app.ImagePlaneManager : this.app.ModelManager;

            if (activeControl === 'landscape') S.landscapeAutopilotOn = false;
            else S.modelAutopilotOn = false;

            activeManager.stopAutopilot();
            this.updateMasterControls();
        });
        
        [UIElements.sliderX, UIElements.sliderY, UIElements.sliderZ].forEach(slider => {
            slider.addEventListener('input', (e) => this.handleActorSliderInput(e.target));
        });

        UIElements.masterScaleSlider.addEventListener('input', (e) => this.handleMasterControlInput(e.target));
        UIElements.masterSpeedSlider.addEventListener('input', (e) => this.handleMasterControlInput(e.target));
        
        UIElements.masterSpinCheckbox.addEventListener('input', (e) => this.handleMasterControlInput(e.target));
        UIElements.masterSpinSpeedInput.addEventListener('input', (e) => this.handleMasterControlInput(e.target));
    },

    handleMasterControlInput(control) {
        if (this._isProgrammaticUpdate) return;
        const S = this.app.vizSettings;
        const activeControl = S.activeControl;
        const value = (control.type === 'checkbox') ? control.checked : parseFloat(control.value);
    
        if (control.id === 'masterEnableSpin') {
            if (activeControl === 'landscape') {
                S.enableLandscapeSpin = value;
            } else {
                S.enableModelSpin = value; 
            }
        } else if (control.id === 'masterSpinSpeed') {
            if (activeControl === 'landscape') {
                S.landscapeSpinSpeed = value;
            } else {
                S.modelSpinSpeed = value;
            }
        } else if (control.id === 'masterScale') {
            if (activeControl === 'landscape') S.landscapeScale = value;
            else S.modelScale = value;
        } else if (control.id === 'masterSpeed') {
            if (activeControl === 'landscape') S.landscapeAutopilotSpeed = value;
            else S.modelAutopilotSpeed = value;
        }
    
        if (control.type === 'range' || control.type === 'number') {
            this.updateRangeDisplay(control.id, value);
        }
    },

    handleActorSliderInput(slider) {
        if (this._isProgrammaticUpdate) return;
        const S = this.app.vizSettings;
        const activeManager = (S.activeControl === 'landscape') ? this.app.ImagePlaneManager : this.app.ModelManager;
        if (!activeManager || !activeManager.state) return;
        
        activeManager.state.isUnderManualControl = true;
        
        const targetPosition = activeManager.state.targetPosition;
        const value = parseFloat(slider.value);
        
        switch (slider.id) {
            case 'actorX': targetPosition.x = value; break;
            case 'actorY': targetPosition.y = value; break;
            case 'actorDepth': targetPosition.z = value; break;
        }
        this.updateRangeDisplay(slider.id, value);
    },

    updateMasterControls() {
        this._isProgrammaticUpdate = true;

        const S = this.app.vizSettings;
        const activeControl = S.activeControl;
        const UIElements = this.controlDOMElements;
        
        let isAutopilotOn, scaleProp, speedProp, spinEnableProp, spinSpeedProp;
        
        if (activeControl === 'landscape') {
            isAutopilotOn = S.landscapeAutopilotOn;
            scaleProp = 'landscapeScale';
            speedProp = 'landscapeAutopilotSpeed';
            spinEnableProp = 'enableLandscapeSpin';
            spinSpeedProp = 'landscapeSpinSpeed';
            UIElements.autopilotHeader.textContent = "LANDSCAPE AUTOPILOT";
            UIElements.masterSpinControl.style.opacity = '1';
            UIElements.masterSpinCheckbox.disabled = false;
            UIElements.masterSpinSpeedInput.disabled = false;

        } else { // 3D Model
            isAutopilotOn = S.modelAutopilotOn;
            scaleProp = 'modelScale';
            speedProp = 'modelAutopilotSpeed';
            spinEnableProp = 'enableModelSpin';
            spinSpeedProp = 'modelSpinSpeed';
            UIElements.autopilotHeader.textContent = "3D MODEL AUTOPILOT";
            UIElements.masterSpinControl.style.opacity = '0.4';
            UIElements.masterSpinCheckbox.disabled = true;
            UIElements.masterSpinSpeedInput.disabled = true;
        }

        UIElements.actorToggleContainer.querySelectorAll('button').forEach(btn => {
            const isActive = btn.dataset.actor === activeControl;
            btn.classList.toggle('active', isActive);
            btn.classList.toggle('button-glow-effect', isActive);
        });
        
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

        if(UIElements.masterSpinCheckbox) {
            UIElements.masterSpinCheckbox.checked = S[spinEnableProp];
        }
        if(UIElements.masterSpinSpeedInput) {
            UIElements.masterSpinSpeedInput.value = S[spinSpeedProp];
        }
        
        this.syncManualSlidersFromState();
        this.updatePresetGlow();
        this.refreshAccordion(UIElements.masterControlContainer);
        
        this._isProgrammaticUpdate = false;
    },
    
    updatePresetGlow() {
        const S = this.app.vizSettings;
        const activeControl = S.activeControl;
        
        let isAutopilotOn, activePreset;
        
        if (activeControl === 'landscape') {
            isAutopilotOn = S.landscapeAutopilotOn;
            activePreset = this.app.ImagePlaneManager.autopilot.preset;
        } else {
            isAutopilotOn = S.modelAutopilotOn;
            activePreset = this.app.ModelManager.autopilot.preset;
        }

        for (let i = 1; i <= 5; i++) {
            const button = document.getElementById(`autopilotPreset${i}`);
            if(button) button.classList.remove('button-glow-effect');
        }
        document.getElementById('autopilotOffButton').classList.remove('button-glow-effect');

        if (isAutopilotOn && activePreset) {
            const button = document.getElementById(activePreset);
            if (button) button.classList.add('button-glow-effect');
        } else {
            document.getElementById('autopilotOffButton').classList.add('button-glow-effect');
        }
    },

    updateModelPresetGlow() {
        const activePresetId = this.app.ModelManager.activePresetId;
        for (let i = 1; i <= 12; i++) {
            const button = document.getElementById(`modelPreset${i}`);
            if (button) {
                button.classList.toggle('button-glow-effect', button.id === activePresetId);
            }
        }
    },

    updateBackgroundPresetGlow() {
        const activePresetId = this.app.BackgroundManager.activePresetId;
        for (let i = 1; i <= 8; i++) {
            const button = document.getElementById(`presetBg${i}`);
            if (button) {
                button.classList.toggle('button-glow-effect', button.id === activePresetId);
            }
        }
    },

    updateGPGPUPixelValue(buffer) {
        if (!this.gpgpuPixelValueDisplay) return;
        const r = buffer[0].toFixed(3);
        const g = buffer[1].toFixed(3);
        const b = buffer[2].toFixed(3);
        const a = buffer[3].toFixed(3);
        this.gpgpuPixelValueDisplay.textContent = `R:${r} G:${g} B:${b} A:${a}`;
        this.isDisplayingPixelValue = true;
    },

    resetGPGPUPixelValue() {
        if (!this.gpgpuPixelValueDisplay) return;
        this.gpgpuPixelValueDisplay.textContent = 'Hover over debug plane...';
        this.isDisplayingPixelValue = false;
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
             if (['masterScale', 'masterSpeed', 'butterchurnAudioInfluence', 'peelAmount', 'peelCurl', 'sagAudioMod', 'droopAudioMod', 'droopSupportedWidthFactor', 'droopSupportedDepthFactor', 'cylinderRadius', 'cylinderHeightScale', 'bendAudioMod', 'foldDepth', 'foldRoundness', 'foldNudge', 'foldCreaseDepth', 'foldCreaseSharpness', 'foldTuckAmount', 'foldTuckReach', 'gpgpu_eqRippleBarWidth', 'gpgpu_eqRippleSmoothing', 'gpgpu_eqRippleRangeStart', 'gpgpu_eqRippleRangeEnd', 'imageEffect_colorTolerance', 'imageEffect_edgeSoftness', 'imageEffect_pointX', 'imageEffect_pointY', 'imageEffect_strength', 'imageEffect_radius', 'imageEffect_audioInfluence', 'gpgpu_foldDepth', 'gpgpu_foldRoundness', 'gpgpu_foldNudge', 'gpgpu_foldCreaseDepth', 'gpgpu_foldCreaseSharpness', 'gpgpu_foldTuckAmount', 'gpgpu_foldTuckReach', 'gpgpu_cylinderRadius', 'gpgpu_cylinderHeightScale', 'gpgpu_sagAmount', 'gpgpu_sagFalloffSharpness', 'gpgpu_sagAudioMod', 'gpgpu_droopAmount', 'gpgpu_droopAudioMod', 'gpgpu_droopFalloffSharpness', 'gpgpu_droopSupportedWidthFactor', 'gpgpu_droopSupportedDepthFactor', 'gpgpu_peelAmount', 'gpgpu_peelCurl', 'gpgpu_peelDrift', 'gpgpu_peelTextureAmount', 'particle_flowScale', 'particle_flowSpeed', 'particle_flowScale', 'particle_attractionStrength', 'particle_morphProgress', 'particle_size_mix', 'particle_twinkleIntensity', 'fluidAttraction', 'fluid_curlStrength', 'fluid_curlScale', 'fluid_curlSpeed'].includes(id)) {
                precision = 2;
            } else if (['deformationStrength', 'audioSmoothing', 'metalness', 'roughness', 'reflectionStrength', 'toneMappingExposure', 'peelDrift', 'peelTextureAmount', 'bendFalloffSharpness', 'gpgpu_tendrilSway', 'gpgpu_tendrilGlowFalloff', 'gpgpu_triWaveFrequency', 'gpgpu_triWaveSpeed', 'particle_base_size', 'particle_min_size', 'gpgpu_cubeWallBevelWidth', 'gpgpu_cubeWallBevelIntensity', 'fluid_gravity'].includes(id)) {
                precision = 2;
            } else if (id === 'butterchurnBlendTime' || id === 'butterchurnCycleTime' || ['actorX', 'actorY', 'actorDepth', 'cylinderArcAngle', 'cylinderArcOffset', 'bendAngle', 'foldAngle', 'foldAudioMod', 'gpgpu_eqRippleBarCount', 'gpgpu_foldAngle', 'gpgpu_foldAudioMod', 'gpgpu_cylinderArcAngle', 'gpgpu_cylinderArcOffset'].includes(id)) {
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
    
        if (mode === 'butterchurn') {
            const engineSelect = document.getElementById('butterchurnEngineSelect');
            if (this.app.ButterchurnManager.activeEngine === null) {
                const defaultEngine = '1';
                if (engineSelect) {
                    engineSelect.value = defaultEngine;
                }
                this.app.ButterchurnManager.switchEngine(defaultEngine);
            }
        } else {
            this.app.ButterchurnManager.deactivate();
        }
    
        if (!isInitial) this.refreshAccordion(document.getElementById('backgroundMode').closest('.accordion-item'));
    },

    updateImageEffectsVisibility(isInitial = false) {
        if (!isInitial) {
            this.refreshAccordion(document.getElementById('imageEffectsAccordion'));
        }
    },

    toggleLightSliders() { 
        const disabled = this.app.vizSettings.enableLightOrbit; 
        document.getElementById('lightDirectionX').disabled = disabled;
        document.getElementById('lightDirectionY').disabled = disabled;
        document.getElementById('lightDirectionZ').disabled = disabled;
    },

    refreshAccordion(element) {
        if (!element) return;
        setTimeout(() => {
            let parentContent = element.closest('.accordion-content.open');
            while (parentContent) {
                parentContent.style.maxHeight = 'none';
                parentContent.style.maxHeight = parentContent.scrollHeight + 'px';
                parentContent = parentContent.parentElement.closest('.accordion-content.open');
            }
        }, 50); 
    },

    loadUserShader(presetId) {
        const userFragmentShader = this.app.vizSettings.shaderToyGLSL;
        if (!userFragmentShader) {
            console.warn("No ShaderToy GLSL provided.");
            return;
        }
        
        if (this.app.BackgroundManager) {
            this.app.BackgroundManager.updateShader(userFragmentShader);
            this.app.BackgroundManager.activePresetId = presetId;
            this.updateBackgroundPresetGlow();
            this.logSuccess("Shader loaded successfully.");
        } else {
            this.logError("BackgroundManager not found to update shader.");
        }
    },
    
    loadChannelTexture(channelIndex, file) {
        if (!this.app.BackgroundManager) {
            this.logError("BackgroundManager not found for texture loading.");
            return;
        }
        
        const objectURL = URL.createObjectURL(file);
        new this.app.THREE.TextureLoader().load(objectURL, (texture) => {
            const uniformName = `iChannel${channelIndex}`;
            
            if (this.app.shaderMaterial.uniforms[uniformName]) {
                const oldTexture = this.app.shaderMaterial.uniforms[uniformName].value;
                if(oldTexture && typeof oldTexture.dispose === 'function') {
                    oldTexture.dispose();
                }

                this.app.shaderMaterial.uniforms[uniformName].value = texture;
                
                const resUniformName = `iChannelResolution`;
                if(this.app.shaderMaterial.uniforms[resUniformName]) {
                    this.app.shaderMaterial.uniforms[resUniformName].value[channelIndex].set(texture.image.width, texture.image.height, 1);
                }

                this.logSuccess(`Texture loaded into ${uniformName}.`);
            } else {
                this.logError(`Uniform ${uniformName} not found in shader material.`);
            }
            URL.revokeObjectURL(objectURL);
        }, undefined, (error) => {
                this.logError(`Error loading texture for ${uniformName}: ${error}`);
                URL.revokeObjectURL(objectURL);
        });
    },

    _updateGpgpuModeVisibility() {
        const S = this.app.vizSettings;
        const mode = S.gpgpuGeometryMode;

        const containers = {
            deformation: document.getElementById('deformationControlsContainer'),
            geocube: document.getElementById('geocubeControlsContainer'),
            particles: document.getElementById('particleControlsContainer'),
            fluidsim: document.getElementById('fluidSimControlsContainer'),
        };

        let activeContainerKey = mode;
        if (mode === 'faceted') {
            activeContainerKey = 'deformation';
        }
        
        for (const [key, container] of Object.entries(containers)) {
            if (container) {
                container.style.display = (key === activeContainerKey) ? 'block' : 'none';
            }
        }

        document.querySelectorAll('#gpgpuModeSelector .segmented-control-button').forEach(btn => {
            const btnMode = btn.dataset.mode;
            let isActive = false;
            if (mode === 'faceted' && btnMode === 'deformation') {
                isActive = true;
            } else if (mode === btnMode) {
                isActive = true;
            }
            btn.classList.toggle('active', isActive);
            btn.classList.toggle('button-glow-effect', isActive);
        });
        
        this._updateDeformationPanelStates();
        this.refreshAccordion(document.getElementById('gpgpuEffectsAccordion'));
    },

    _updateDeformationPanelStates() {
        const S = this.app.vizSettings;
        const container = document.getElementById('deformationControlsContainer');
        if (!container) return;
        
        container.querySelectorAll('.accordion-item').forEach(panel => {
            panel.classList.remove('container-disabled');
        });

        if (S.gpgpu_enableCloth) {
            container.querySelectorAll('.accordion-item').forEach(panel => {
                const checkbox = panel.querySelector('.header-toggle-checkbox');
                if (checkbox && checkbox.id !== 'gpgpu_enableCloth') {
                    panel.classList.add('container-disabled');
                }
            });
        } else {
            this.gpgpuExclusiveGroups.forEach(group => {
                let activeEffectInGroup = null;
                for (const effectId of group) {
                    if (S[effectId]) {
                        activeEffectInGroup = effectId;
                        break;
                    }
                }
                
                if (activeEffectInGroup) {
                    group.forEach(effectId => {
                        if (effectId !== activeEffectInGroup) {
                            const checkbox = document.getElementById(effectId);
                            if (checkbox) {
                                checkbox.closest('.accordion-item')?.classList.add('container-disabled');
                            }
                        }
                    });
                }
            });
        }
        
        this.refreshAccordion(container);
    },

    resetGpgpuSettings() {
        this._isProgrammaticUpdate = true;

        const S = this.app.vizSettings;
        const D = this.app.defaultVisualizerSettings;

        S.gpgpuGeometryMode = D.gpgpuGeometryMode;

        const gpgpuKeys = [
            'gpgpu_enableWaterRipple', 'gpgpu_rippleSpeed', 'gpgpu_rippleStrength', 'gpgpu_rippleFrequency',
            'gpgpu_enableEqRipple', 'gpgpu_eqRippleStrength', 'gpgpu_eqRippleSmoothing', 'gpgpu_eqRippleBarCount', 'gpgpu_eqRippleBarWidth', 'gpgpu_eqRippleRangeStart', 'gpgpu_eqRippleRangeEnd', 'gpgpu_eqRippleStyle',
            'gpgpu_enableCloth', 'gpgpu_clothDamping', 'gpgpu_clothStiffness', 'gpgpu_clothAudioForce', 'gpgpu_clothForceRadius', 'gpgpu_clothIterations', 'gpgpu_clothPinMode', 'gpgpu_tetherStrength', 'gpgpu_ambientWindStrength', 'gpgpu_ambientWindSpeed', 'gpgpu_ambientWindScale', 'gpgpu_directionalWindX', 'gpgpu_directionalWindY', 'gpgpu_directionalWindZ', 'gpgpu_clothBlendTime',
            'gpgpu_enableFold', 'gpgpu_foldAngle', 'gpgpu_foldDepth', 'gpgpu_foldRoundness', 'gpgpu_foldAudioMod', 'gpgpu_foldNudge', 'gpgpu_enableFoldCrease', 'gpgpu_foldCreaseDepth', 'gpgpu_foldCreaseSharpness', 'gpgpu_enableFoldTuck', 'gpgpu_foldTuckAmount', 'gpgpu_foldTuckReach',
            'gpgpu_enableCylinder', 'gpgpu_cylinderRadius', 'gpgpu_cylinderHeightScale', 'gpgpu_cylinderAxisAlignment', 'gpgpu_cylinderArcAngle', 'gpgpu_cylinderArcOffset',
            'gpgpu_enableSag', 'gpgpu_sagAmount', 'gpgpu_sagFalloffSharpness', 'gpgpu_sagAudioMod',
            'gpgpu_enableDroop', 'gpgpu_droopAmount', 'gpgpu_droopAudioMod', 'gpgpu_droopFalloffSharpness', 'gpgpu_droopSupportedWidthFactor', 'gpgpu_droopSupportedDepthFactor',
            'gpgpu_enablePeel', 'gpgpu_peelAmount', 'gpgpu_peelCurl', 'gpgpu_peelEnableAudio', 'gpgpu_peelTextureAmount', 'gpgpu_peelDrift',
            'particle_base_size', 'particle_min_size', 'particle_size_mix', 'particle_twinkleIntensity', 'particle_flowScale', 'particle_flowSpeed', 'particle_flowStrength', 'particle_attractionStrength', 'particle_morphProgress',
            'playerCube_enabled', 'gpgpu_cubeWallMorph', 'gpgpu_cubeWallUseImageTexture', 'gpgpu_cubeWallSideColor', 'gpgpu_cubeWallBevelWidth', 'gpgpu_cubeWallBevelIntensity',
            'fluid_curlStrength', 'fluid_curlScale', 'fluid_curlSpeed'
        ];

        gpgpuKeys.forEach(key => {
            if (D[key] !== undefined) {
                S[key] = D[key];
                const el = document.getElementById(key);
                if (el) {
                    if (el.type === 'checkbox') el.checked = D[key];
                    else el.value = D[key];
                    if (el.type === 'range') this.updateRangeDisplay(key, D[key]);
                }
            }
        });
        
        this.app.ImagePlaneManager.createDefaultLandscape();
        this._updateGpgpuModeVisibility();
        this._updateDeformationPanelStates();

        this.logSuccess("All GPGPU settings have been reset to default.");
        
        this._isProgrammaticUpdate = false;
    },
    
    _switchGpgpuMode(newUiMode) {
        const S = this.app.vizSettings;
        const oldSystemMode = S.gpgpuGeometryMode;
        const newSystemMode = (newUiMode === 'deformation') ? 'faceted' : newUiMode;

        if (oldSystemMode === newSystemMode) return;
        
        if (oldSystemMode === 'geocube') {
            this.app.CubeWallManager.setActive(false);
        }
        if (newSystemMode === 'geocube') {
            this.app.CubeWallManager.setActive(true);
        }

        S.gpgpuGeometryMode = newSystemMode;
        this.app.ComputeManager.switchMode(newSystemMode);
        
        this._updateGpgpuModeVisibility();
    },

    setFluidControlsDisabled(isDisabled) {
        const container = document.getElementById('fluidSimControlsContainer');
        if (!container) return;
        
        // This is now the ONLY logic. It disables everything when a script is running.
        container.querySelectorAll('button, input').forEach(el => {
            el.disabled = isDisabled;
        });

        const buttonRow1 = document.getElementById('fluid-preset-buttons-row1');
        const buttonRow2 = document.getElementById('fluid-preset-buttons-row2');
        
        if (buttonRow1 && buttonRow2) {
            buttonRow1.style.opacity = isDisabled ? 0.5 : 1.0;
            buttonRow2.style.opacity = isDisabled ? 0.5 : 1.0;
            buttonRow1.style.pointerEvents = isDisabled ? 'none' : 'auto';
            buttonRow2.style.pointerEvents = isDisabled ? 'none' : 'auto';
        }
    },

    setupEventListeners() {
        document.getElementById('toggleMicInput').addEventListener('click', () => this.app.AudioProcessor.startMic());
        document.getElementById('playPauseAudioButton').addEventListener('click', () => this.app.AudioProcessor.toggleFilePlayback());
        document.getElementById('playTestToneButton').addEventListener('click', () => this.app.AudioProcessor.toggleTestTone());
        document.querySelectorAll('.browse-btn').forEach(btn => btn.addEventListener('click', () => document.getElementById(btn.dataset.target).click()));
        
        document.getElementById('loadShaderCode').addEventListener('click', () => this.loadUserShader());

        document.getElementById('clearShaderCode').addEventListener('click', () => { 
            document.getElementById('shaderToyGLSL').value = ''; 
            this.app.vizSettings.shaderToyGLSL = ''; 
            this.app.BackgroundManager.activePresetId = null;
            this.updateBackgroundPresetGlow();
            this.logSuccess('Shader cleared.'); 
        });
        document.getElementById('pasteShaderCode').addEventListener('click', async () => { 
            try { 
                const text = await navigator.clipboard.readText(); 
                document.getElementById('shaderToyGLSL').value = text; 
                this.app.vizSettings.shaderToyGLSL = text; 
                this.app.BackgroundManager.activePresetId = null;
                this.updateBackgroundPresetGlow();
                this.logSuccess('Pasted from clipboard.'); 
            } catch (err) { 
                this.logError('Failed to read from clipboard.'); 
            } 
        });
        document.getElementById('landscapeResetButton').addEventListener('click', () => this.resetLandscapeSettings());
        document.getElementById('gpgpuResetButton').addEventListener('click', () => this.resetGpgpuSettings());
        
        const fileInputIds = ['mainTextureInput', 'videoTextureInput', 'audioFileInput', 'gltfModelInput', 'hdriInput', 'iChannel0Input', 'iChannel1Input', 'iChannel2Input', 'iChannel3Input', 'particleModelInput'];
        fileInputIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', (e) => this.handleFileSelect(e, id));
        });
        
        const gpgpuDebugCheckbox = document.getElementById('enableGPGPUDebugger');
        if (gpgpuDebugCheckbox) {
            gpgpuDebugCheckbox.addEventListener('change', (e) => {
                if (this._isProgrammaticUpdate) return;
                this.app.vizSettings.enableGPGPUDebugger = e.target.checked;
            });
        }
        
        const isolateButton = document.getElementById('isolateFluidSimButton');
        if (isolateButton) {
            isolateButton.addEventListener('click', () => {
                const S = this.app.vizSettings;
                S.enableModel = false;
                S.backgroundMode = 'black';
                this._switchGpgpuMode('fluidsim');
                this.syncAllControlsToSettings();
                this.updateBackgroundControlsVisibility();
                this.logSuccess("Scene isolated for Fluid Sim debug.");
            });
        }
        
        document.querySelectorAll('#gpgpuModeSelector button').forEach(button => {
            button.addEventListener('click', () => {
                const mode = button.dataset.mode;
                if (mode) {
                    this._switchGpgpuMode(mode);
                }
            });
        });
        
        document.getElementById('fluidMeltAndReform').addEventListener('click', () => this.app.FluidDirector.run('meltAndReform'));
        document.getElementById('fluidExplosion').addEventListener('click', () => this.app.FluidDirector.run('explosion'));
        document.getElementById('fluidVortex').addEventListener('click', () => this.app.FluidDirector.run('vortex'));
        document.getElementById('fluidSwirlReform').addEventListener('click', () => this.app.FluidDirector.run('swirl_reform'));
        document.getElementById('fluidStopAndReset').addEventListener('click', () => this.app.FluidDirector.run('reset'));
        
        document.querySelectorAll('#particleControlsContainer input[type="range"]').forEach(slider => {
            slider.addEventListener('input', (e) => {
                if (this._isProgrammaticUpdate) return;
                const S = this.app.vizSettings;
                const id = e.target.id;
                S[id] = parseFloat(e.target.value);
                this.updateRangeDisplay(id, S[id]);
            });
        });
        
        const fluidSliders = ['fluidAttraction', 'fluid_gravity', 'fluid_curlStrength', 'fluid_curlScale', 'fluid_curlSpeed'];
        fluidSliders.forEach(id => {
            const slider = document.getElementById(id);
            if (slider) {
                slider.addEventListener('input', (e) => {
                    if (this._isProgrammaticUpdate) return;
                    const CM = this.app.ComputeManager;
                    if (!CM.gpuCompute) return;
                    this.app.FluidDirector.interruptAndStop();
                    
                    const value = parseFloat(e.target.value);
                    const uniformsV = CM.velocityVariable.material.uniforms;

                    if (id === 'fluidAttraction') {
                        uniformsV.fluid_attractionStrength.value = value; 
                    } else if (id === 'fluid_gravity') {
                        uniformsV.u_gravity.value.y = value;
                    } else if (id === 'fluid_curlStrength') {
                        uniformsV.fluid_curlStrength.value = value;
                    } else if (id === 'fluid_curlScale') {
                        uniformsV.fluid_curlScale.value = value;
                    } else if (id === 'fluid_curlSpeed') {
                        uniformsV.fluid_curlSpeed.value = value;
                    }
                    this.updateRangeDisplay(id, value);
                });
            }
        });

        // *** THE FIX IS HERE ***
        const fluidTargetToggle = document.getElementById('fluidTargetToggle');
        if (fluidTargetToggle) {
            fluidTargetToggle.querySelectorAll('button').forEach(button => {
                button.addEventListener('click', (e) => {
                    if (this._isProgrammaticUpdate) return;
                    this.app.FluidDirector.interruptAndStop();
                    
                    fluidTargetToggle.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
                    e.target.classList.add('active');
                    
                    const target = parseInt(e.target.dataset.target);
                    const HOLDING_STRENGTH = 1.5;
                    
                    const CM = this.app.ComputeManager;
                    if (!CM.gpuCompute) return;
                    
                    const uniformsV = CM.velocityVariable.material.uniforms;
                    
                    uniformsV.u_targetState.value = target;
                    uniformsV.fluid_attractionStrength.value = HOLDING_STRENGTH;
                    
                    this.setSliderValue('fluidAttraction', HOLDING_STRENGTH);
                });
            });
        }
        // *** END FIX ***
        
        document.querySelectorAll('input[type="range"], select').forEach(control => {
            if (control.closest('#cameraOptions') || control.closest('#masterSpinControl') || control.closest('.accordion-header-with-toggle') || control.closest('#imageEffectsAccordion') || control.closest('#butterchurnControls') || control.closest('.accordion-content .file-input-row') || control.closest('.model-preset-list') || control.closest('#particleControlsContainer') || control.closest('#geocubeControlsContainer') || control.closest('#fluidSimControlsContainer')) return;
            control.addEventListener('input', (e) => {
                if (this._isProgrammaticUpdate) return;
                const id = e.target.id;
                if (!id || this.app.vizSettings[id] === undefined) return;
                
                const S = this.app.vizSettings;
                let value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
                S[id] = (e.target.type === 'range' || e.target.type === 'number') ? parseFloat(value) : value;
                
                if (e.target.type === 'range' || e.target.type === 'number') this.updateRangeDisplay(id, value);

                if (id === 'toneMappingMode') {
                    const toneMappingOptions = { 'ACESFilmic': this.app.THREE.ACESFilmicToneMapping, 'Reinhard': this.app.THREE.ReinhardToneMapping, 'Linear': this.app.THREE.LinearToneMapping };
                    if (this.app.renderer) this.app.renderer.toneMapping = toneMappingOptions[value];
                } else if (id === 'toneMappingExposure') {
                    if (this.app.renderer) this.app.renderer.toneMappingExposure = parseFloat(value);
                } else if (id === 'backgroundMode') {
                    this.updateBackgroundControlsVisibility();
                } else if (id === 'enableLightOrbit') {
                    this.toggleLightSliders();
                } else if (id === 'lightColor') {
                    if (this.app.directionalLight) this.app.directionalLight.color.set(value);
                } else if (id === 'ambientLightColor') {
                    if (this.app.ambientLight) this.app.ambientLight.color.set(value);
                } else if (id === 'lightDirectionX' || id === 'lightDirectionY' || id === 'lightDirectionZ') {
                    if (this.app.directionalLight) {
                        this.app.directionalLight.position.set(S.lightDirectionX, S.lightDirectionY, S.lightDirectionZ).normalize();
                    }
                } else if ((id === 'planeAspectRatio' || id === 'planeOrientation')) {
                    this.app.ImagePlaneManager.createDefaultLandscape();
                }
            });
        });
        
        document.getElementById('goToCanvasButton').addEventListener('click', () => this.setMorphState(0.0));
        document.getElementById('goTo3DModelButton').addEventListener('click', () => this.setMorphState(0.95));
        
        document.getElementById('runTransitionButton').addEventListener('click', () => this.app.ParticleTransitions.run());
        
        const morphSlider = document.getElementById('particle_morphProgress');
        if (morphSlider) {
            morphSlider.addEventListener('input', (e) => {
                if (this._isProgrammaticUpdate) return;
                const S = this.app.vizSettings;
                const value = parseFloat(e.target.value);
                S.particle_morphProgress = value;
                this.updateRangeDisplay('particle_morphProgress', value);
                this.handleMorphSlider(value); 
            });
        }
        
        const presetContainers = ['#particleTransitionPresetContainer', '#particleArtisticPresetContainer'];
        presetContainers.forEach(selector => {
            const container = document.querySelector(selector);
            if(container) {
                container.querySelectorAll('button').forEach(button => {
                    button.addEventListener('click', () => {
                        const presetMap = { 
                            'transitionPreset1': 'default', 'transitionPreset2': 'pour', 'transitionPreset3': 'liquid',
                            'transitionPreset4': 'explode', 'transitionPreset5': 'nebula', 'transitionPreset6': 'melt',
                            'artisticPreset1': 'supernova', 'artisticPreset2': 'gravity_well', 'artisticPreset3': 'cosmic_dust',
                            'artisticPreset4': 'dissolve', 'artisticPreset5': 'swarm', 'artisticPreset6': 'flow'
                        };
                        const presetId = presetMap[button.id];
                        
                        if (presetId && this.app.ParticleTransitions.transitionPresets[presetId]) {
                            this.app.ParticleTransitions.setActivePreset(presetId);
                            document.querySelectorAll('#particleTransitionPresetContainer button, #particleArtisticPresetContainer button').forEach(btn => btn.classList.remove('button-glow-effect'));
                            button.classList.add('button-glow-effect');
                            this.logSuccess(`Transition style set to: ${presetId}`);
                        } else {
                            this.logError(`Preset for ${button.id} not yet implemented.`);
                        }
                    });
                });
            }
        });
        
        document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
             if (checkbox.id === 'enableGPGPUDebugger' || checkbox.closest('#gpgpuEffectsAccordion') || checkbox.closest('#butterchurnControls')) return;
             checkbox.addEventListener('input', (e) => {
                 if (this._isProgrammaticUpdate) return;
                 if (this.app.vizSettings[e.target.id] !== undefined) {
                     this.app.vizSettings[e.target.id] = e.target.checked;
                 }

                if (e.target.id === 'enablePBRColor') {
                    const ipm = this.app.ImagePlaneManager;
                    if (ipm && ipm.currentTexture) {
                        const isChecked = e.target.checked;
                        ipm.currentTexture.colorSpace = isChecked ? this.app.THREE.SRGBColorSpace : this.app.THREE.NoColorSpace;
                        ipm.currentTexture.needsUpdate = true;
                    }
                }
             });
        });
        
        document.querySelectorAll('#deformationControlsContainer .header-toggle-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                if (this._isProgrammaticUpdate) return;
                if (this.app.vizSettings[e.target.id] !== undefined) {
                    this.app.vizSettings[e.target.id] = e.target.checked;
                }
                this._updateDeformationPanelStates();
            });
        });

        this.setupButterchurnEventListeners();

        document.getElementById('controlsToggleButton').addEventListener('click', (e) => { 
            const panel = document.getElementById('controlsPanel'); 
            panel.classList.toggle('visible'); 
            e.target.textContent = panel.classList.contains('visible') ? "Hide" : "Show"; 
            
            const headersToGlow = document.querySelectorAll('[data-header-id]');
            if (panel.classList.contains('visible')) {
                headersToGlow.forEach(header => {
                    if (!header.nextElementSibling.classList.contains('open')) {
                        header.classList.add('button-glow-effect');
                    }
                });
            } else {
                headersToGlow.forEach(header => {
                    header.classList.remove('button-glow-effect');
                });
            }
        });

        document.querySelectorAll('.accordion-header, .accordion-header-with-toggle').forEach(headerContainer => {
            let button = headerContainer.matches('.accordion-header') ? headerContainer : headerContainer.querySelector('.accordion-header');
            
            button.addEventListener('click', () => {
                const content = headerContainer.parentElement.querySelector('.accordion-content');
                if (!content) return;

                const parentAccordion = headerContainer.closest('.accordion-item');
                if (parentAccordion.classList.contains('container-disabled')) return;
                
                if (headerContainer.dataset.headerId) {
                    headerContainer.classList.toggle('button-glow-effect');
                }
                
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
                const presetId = `presetBg${i}`;
                const shaderCode = this.app.shaderPresets[presetId]; 
                if (shaderCode) { 
                    document.getElementById('shaderToyGLSL').value = shaderCode; 
                    this.app.vizSettings.shaderToyGLSL = shaderCode; 
                    this.logSuccess(`Preset '${presetId}' loaded.`); 
                    this.loadUserShader(presetId); 
                }
            });
        }
        
        Object.keys(this.app.modelPresets).forEach(presetId => {
            const loadBtn = document.getElementById(presetId);
            if(loadBtn) {
                loadBtn.addEventListener('click', () => {
                    const preset = this.app.modelPresets[presetId];
                    if (preset.homeOffset && !(preset.homeOffset instanceof this.app.THREE.Vector3)) {
                        preset.homeOffset = new this.app.THREE.Vector3(preset.homeOffset.x, preset.homeOffset.y, preset.homeOffset.z);
                    }
                    if (preset) this.app.ModelManager.loadGLTFModel(preset);
                });
            }
        });

        document.querySelectorAll('.bake-preset-btn').forEach(bakeBtn => {
            bakeBtn.addEventListener('click', () => {
                const presetId = bakeBtn.dataset.presetId;
                const preset = this.app.modelPresets[presetId];
                if (!preset) {
                    this.logError(`Preset ${presetId} not found.`);
                    return;
                }
                
                this.logSuccess(`Baking ${preset.name}...`);
                this.gltfLoader.load(preset.path, (gltf) => {
                    let bestMesh = null;
                    gltf.scene.traverse(child => { if (child.isMesh) { bestMesh = child; } });
                    
                    if (bestMesh) {
                        this.particleModelMesh = bestMesh;

                        if (bestMesh.material && bestMesh.material.map) {
                            this.particleModelTexture = bestMesh.material.map;
                            if (this.app.ImagePlaneManager.particlePBRMaterial) {
                                this.app.ImagePlaneManager.particlePBRMaterial.uniforms.u_particleModelTexture.value = this.particleModelTexture;
                            }
                        } else {
                            this.logError(`Model "${file.name}" has no texture map.`);
                            this.particleModelTexture = null; 
                        }

                        const CM = this.app.ComputeManager;
                        if (CM && CM.particleModelPositionTexture) {
                            CM.bakeToTexture(this.particleModelMesh, CM.particleModelPositionTexture);
                            this.logSuccess(`Baked ${preset.name}. Ready to transition.`);
                        }
                    } else {
                        this.logError('No mesh found in the loaded model.');
                    }
                });
            });
        });


        const demoButton = document.getElementById('demoModeButton');
        if (demoButton) {
            demoButton.addEventListener('click', () => this.toggleDemoMode());
        }
    },
    
    handleMorphSlider(progress) {
        const S = this.app.vizSettings;
        const CM = this.app.ComputeManager;
        if (!CM || !CM.gpuCompute) return;
        
        const targetState = (progress > 0.5) ? 'model' : 'flat';
        
        if (S.particle_target !== targetState) {
            S.particle_target = targetState;
            
            if (targetState === 'model') {
                if (!this.particleModelMesh) {
                    this.logError("No model baked. Cannot morph to 3D Model.");
                    S.particle_morphProgress = 0.0;
                    const slider = document.getElementById('particle_morphProgress');
                    if(slider) slider.value = 0.0;
                    this.updateRangeDisplay('particle_morphProgress', 0.0);
                    return;
                }
                CM.velocityVariable.material.uniforms.u_targetPositionMap.value = CM.particleModelPositionTexture;
            } else {
                CM.velocityVariable.material.uniforms.u_targetPositionMap.value = CM.particleFlatPositionTexture;
            }
        }
    },
    
    setMorphState(targetProgress) {
        const slider = document.getElementById('particle_morphProgress');
        if (slider) {
            this._isProgrammaticUpdate = true;
            slider.value = targetProgress;
            this.app.vizSettings.particle_morphProgress = targetProgress;
            this.updateRangeDisplay('particle_morphProgress', targetProgress);
            this._isProgrammaticUpdate = false;
        }
        this.handleMorphSlider(targetProgress);
    },

    disableParticleSliders() {
        const editor = document.getElementById('particleTransitionEditor');
        if (editor) {
            editor.classList.add('container-disabled');
        }
    },

    enableParticleSliders() {
        const editor = document.getElementById('particleTransitionEditor');
        if (editor) {
            editor.classList.remove('container-disabled');
        }
    },
    
    updateTransitionAnimation() {},
    
    loadPresetValues(presetId) {},

    syncSlidersToSettings() {
        this._isProgrammaticUpdate = true;

        const S = this.app.vizSettings;
        const editorSliderIds = [
            'particle_flowStrength', 'particle_flowSpeed', 'particle_flowScale', 
            'particle_attractionStrength', 'particle_base_size', 'particle_min_size', 
            'particle_size_mix', 'particle_twinkleIntensity'
        ];
        
        editorSliderIds.forEach(key => {
            const slider = document.getElementById(key);
            if (slider && S[key] !== undefined) {
                slider.value = S[key];
                this.updateRangeDisplay(key, S[key]);
            }
        });
        
        this._isProgrammaticUpdate = false;
    },
    
    setSliderValue(id, value) {
        const slider = document.getElementById(id);
        if (slider) {
            this._isProgrammaticUpdate = true;
            slider.value = value;
            this.updateRangeDisplay(id, value);
            this._isProgrammaticUpdate = false;
        }
    },

    toggleDemoMode() {
        if (this.app.isDemoModeActive) {
            this.stopDemoMode();
        } else {
            this.startDemoMode();
        }
    },

    startDemoMode() {
        console.log("Starting Demo Mode...");
        this.app.isDemoModeActive = true;
        document.getElementById('demoModeButton').textContent = 'STOP DEMO';
        
        this._switchGpgpuMode('deformation');

        this.app.ImagePlaneManager.startAutopilot('autopilotPreset3');
        this.app.ModelManager.startAutopilot('autopilotPreset2');
        
        const audioEl = this.app.AudioProcessor.audioElement;
        if (audioEl && audioEl.src && audioEl.paused) {
            this.app.AudioProcessor.toggleFilePlayback();
        }

        this.app.vizSettings.gpgpu_enableCloth = true;
        this.app.vizSettings.enableShaderMouse = true;

        this.demoShaderIndex = 0;
        this.cycleDemoShader(); 
        if(this.demoShaderInterval) clearInterval(this.demoShaderInterval);
        this.demoShaderInterval = setInterval(() => this.cycleDemoShader(), 60 * 1000); 

        this.app.vizSettings.enableGPGPUDebugger = false;
        this.app.vizSettings.enableOnScreenDebugger = false;

        this.syncAllControlsToSettings();
        this.updateMasterControls();
        this._updateDeformationPanelStates();
    },

    stopDemoMode() {
        console.log("Stopping Demo Mode...");
        this.app.isDemoModeActive = false;
        document.getElementById('demoModeButton').textContent = 'START DEMO';

        this.app.ImagePlaneManager.stopAutopilot();
        this.app.ModelManager.stopAutopilot();
        
        const audioEl = this.app.AudioProcessor.audioElement;
        if (audioEl && !audioEl.paused) {
            this.app.AudioProcessor.toggleFilePlayback();
        }

        if (this.demoShaderInterval) {
            clearInterval(this.demoShaderInterval);
            this.demoShaderInterval = null;
        }

        const defaultMode = this.app.defaultVisualizerSettings.gpgpuGeometryMode;
        
        this._switchGpgpuMode(defaultMode);

        this.app.vizSettings = JSON.parse(JSON.stringify(this.app.defaultVisualizerSettings));
        
        const defaultShaderId = 'presetBg6';
        this.app.vizSettings.shaderToyGLSL = this.app.shaderPresets[defaultShaderId];
        this.loadUserShader(defaultShaderId);
        
        this.syncAllControlsToSettings();
        this.updateMasterControls();
        this.updateBackgroundControlsVisibility();
        this._updateDeformationPanelStates();
    },
    
    cycleDemoShader() {
        if (!this.app.isDemoModeActive) return;

        const presetId = this.demoShaderOrder[this.demoShaderIndex];
        const shaderCode = this.app.shaderPresets[presetId];
        
        if (shaderCode) {
            document.getElementById('shaderToyGLSL').value = shaderCode;
            this.app.vizSettings.shaderToyGLSL = shaderCode;
            this.loadUserShader(presetId);
            console.log(`Demo Mode: Cycled to shader ${presetId}`);
        }

        this.demoShaderIndex = (this.demoShaderIndex + 1) % this.demoShaderOrder.length;
    },

    setupButterchurnEventListeners() {
        const engineSelect = document.getElementById('butterchurnEngineSelect');
        if (engineSelect) {
            engineSelect.addEventListener('change', (e) => {
                if (this._isProgrammaticUpdate) return;
                this.app.ButterchurnManager.switchEngine(e.target.value);
            });
        }

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
        if (enableCycle) enableCycle.addEventListener('change', (e) => { if (this._isProgrammaticUpdate) return; this.app.vizSettings.butterchurnEnableCycle = e.target.checked; this.app.ButterchurnManager.updateCycleInterval(); });
        
        document.getElementById('butterchurnPrevPreset').addEventListener('click', () => this.app.ButterchurnManager.prevPreset());
        document.getElementById('butterchurnRandomPreset').addEventListener('click', () => this.app.ButterchurnManager.randomPreset());
        document.getElementById('butterchurnNextPreset').addEventListener('click', () => this.app.ButterchurnManager.nextPreset());
        
        document.getElementById('butterchurnSearchButton').addEventListener('click', () => this.filterButterchurnPresets());
        document.getElementById('butterchurnPresetSearch').addEventListener('keyup', (e) => { if (e.key === 'Enter') this.filterButterchurnPresets(); });
        document.getElementById('butterchurnPresetList').addEventListener('change', (e) => { const selectedIndex = parseInt(e.target.value); if (!isNaN(selectedIndex)) this.app.ButterchurnManager.loadPresetByIndex(selectedIndex); });
    },

    populateButterchurnPresetList(presetKeys) {
        const listElement = document.getElementById('butterchurnPresetList');
        const searchBox = document.getElementById('butterchurnPresetSearch');
        if (!listElement || !searchBox) return;

        listElement.dataset.originalKeys = JSON.stringify(presetKeys);
        searchBox.value = '';
        
        this.filterButterchurnPresets();
    },

    filterButterchurnPresets() {
        const listElement = document.getElementById('butterchurnPresetList');
        const searchBox = document.getElementById('butterchurnPresetSearch');
        if (!listElement || !searchBox || !listElement.dataset.originalKeys) return;

        const searchTerm = searchBox.value.toLowerCase();
        const allKeys = JSON.parse(listElement.dataset.originalKeys);
        
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
            this.loadChannelTexture(channelIndex, file);
            return;
        }

        switch (id) {
            case 'mainTextureInput': 
            case 'videoTextureInput':
                this.updateFileNameDisplay(id === 'videoTextureInput' ? 'video' : 'image', file.name);
                this.app.ImagePlaneManager.loadTexture(file);
                break;
            case 'audioFileInput': 
                this.updateFileNameDisplay('audio', file.name); 
                if (this.app.AudioProcessor) this.app.AudioProcessor.loadAudioFile(file);
                break;
            case 'hdriInput': 
                this.updateFileNameDisplay('hdri', file.name);
                console.warn("Custom HDRI loading for main scene environment is currently handled by BackgroundManager based on BG FX mode. Direct HDRI input is not fully implemented in this version.");
                break;
            case 'gltfModelInput':
                this.updateFileNameDisplay('gltf', file.name);
                const preset = { path: URL.createObjectURL(file), name: file.name, id: null, homeOffset: new this.app.THREE.Vector3() };
                this.app.ModelManager.loadGLTFModel(preset); 
                break;
            case 'particleModelInput':
                this.updateFileNameDisplay('particleModel', file.name);
                const objectURL = URL.createObjectURL(file);
                this.gltfLoader.load(objectURL, (gltf) => {
                    let bestMesh = null;
                    gltf.scene.traverse(child => { if (child.isMesh) { bestMesh = child; } });
                    
                    if (bestMesh) {
                        this.particleModelMesh = bestMesh;

                        if (bestMesh.material && bestMesh.material.map) {
                            this.particleModelTexture = bestMesh.material.map;
                            if (this.app.ImagePlaneManager.particlePBRMaterial) {
                                this.app.ImagePlaneManager.particlePBRMaterial.uniforms.u_particleModelTexture.value = this.particleModelTexture;
                            }
                        } else {
                            this.logError(`Model "${file.name}" has no texture map.`);
                            this.particleModelTexture = null; 
                        }

                        const CM = this.app.ComputeManager;
                        if (CM && CM.particleModelPositionTexture) {
                            CM.bakeToTexture(this.particleModelMesh, CM.particleModelPositionTexture);
                            this.logSuccess(`Baked ${file.name}. Ready to transition.`);
                        }
                    } else {
                        this.logError('No mesh found in the loaded model.');
                    }
                    URL.revokeObjectURL(objectURL);
                }, undefined, (error) => {
                    this.logError(`Failed to load particle target: ${error}`);
                    URL.revokeObjectURL(objectURL);
                });
                break;
        }
    },
    updateFileNameDisplay(type, name) {
       const idMap = {
            'image': 'imageFileName', 'video': 'videoFileName',
            'audio': 'audioFileName', 'hdri': 'hdriFileName', 'gltf': 'gltfFileName',
            'particleModel': 'particleModelName'
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
        if (!playButton) return;

        playButton.classList.remove('button-glow-effect', 'button-solid-glow');
        
        let message = '';
        switch (sourceType) {
            case 'none': message = "AUDIO: IDLE"; break; 
            case 'mic': message = "AUDIO: Mic/System"; break; 
            case 'file_ready': 
                message = "AUDIO: File Ready"; 
                playButton.textContent = "Play File"; 
                playButton.classList.add('button-glow-effect');
                break; 
            case 'file_playing': 
                message = "AUDIO: Playing"; 
                playButton.textContent = "Pause File"; 
                playButton.classList.add('button-solid-glow');
                break; 
            case 'file_paused': 
                message = "AUDIO: Paused"; 
                playButton.textContent = "Play File"; 
                playButton.classList.add('button-glow-effect');
                break; 
            case 'testTone': message = "AUDIO: Test Tone"; break;
            case 'error': message = `ERROR: ${statusText}`; break;
        }
        this.audioStatusP.textContent = message;
    },
    setupEQCanvas() {
        this.eqCanvas = document.getElementById('eqVisualizerCanvas'); 
        if (!this.eqCanvas) { console.warn("UIManager.setupEQCanvas: #eqVisualizerCanvas not found."); return; } 
        this.eqCtx = this.eqCanvas.getContext('2d'); 

        const dpr = window.devicePixelRatio || 1;
        const rect = this.eqCanvas.getBoundingClientRect();

        this.eqCanvas.width = rect.width * dpr;
        this.eqCanvas.height = rect.height * dpr;
        
        this.eqCtx.scale(dpr, dpr);

        this.eqCanvas.style.width = `${rect.width}px`;
        this.eqCanvas.style.height = `${rect.height}px`;

        this.eqGradient = this.eqCtx.createLinearGradient(0, 0, rect.width, 0); 
        this.eqGradient.addColorStop(0, '#007AFF'); 
        this.eqGradient.addColorStop(0.5, '#5856D6'); 
        this.eqGradient.addColorStop(1, '#FF2D55');
    },
    updateEQ(data) {
        if (!this.eqCtx || !data) return; 
        const width = this.eqCanvas.clientWidth;
        const height = this.eqCanvas.clientHeight; 

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
        this._isProgrammaticUpdate = true;

        const S = this.app.vizSettings;
        const D = this.app.defaultVisualizerSettings;
    
        const landscapeKeys = [
            'enableLandscape', 'landscapeSpinSpeed', 'planeAspectRatio', 'planeOrientation'
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
    
        this.app.ImagePlaneManager.createDefaultLandscape();
        this._isProgrammaticUpdate = false;
        this.logSuccess("Landscape settings reset.");
    }
};