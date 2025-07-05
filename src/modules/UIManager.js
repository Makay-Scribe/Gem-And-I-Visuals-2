import { Debugger } from './Debugger.js';

export const UIManager = {
    app: null, // This will be set to the main App instance on init
    _debugTimeout: null, 
    eqCanvas: null, 
    eqCtx: null, 
    eqGradient: null, 
    audioStatusP: null, 
    debugDisplay: null,
    
    // --- FOLLOWER GLOW STATE ---
    glowTargets: {},
    currentGlowTarget: null,

    init(appInstance) {
        this.app = appInstance; // Store a reference to the main App object

        // Defensive check for crucial elements
        this.audioStatusP = document.getElementById('audioStatusP'); 
        if (!this.audioStatusP) console.warn("UIManager: #audioStatusP not found in DOM.");

        this.debugDisplay = document.getElementById('debugDisplay');
        if (!this.debugDisplay) console.warn("UIManager: #debugDisplay not found in DOM. Error/Success logs may not appear.");
        
        Object.keys(this.app.defaultVisualizerSettings).forEach(key => {
            const el = document.getElementById(key);
            if (el) {
                if (el.type === 'checkbox') {
                    el.checked = this.app.vizSettings[key];
                } else {
                    el.value = this.app.vizSettings[key];
                }
                if(el.type === 'range' || el.type === 'number') {
                    this.updateRangeDisplay(key, this.app.vizSettings[key]);
                }
            } else {
                // Suppress warnings for settings that don't have a direct UI control
                if (!['autopilotSpeeds'].includes(key)) {
                    console.warn(`UIManager: Control element with ID '${key}' not found in DOM.`);
                }
            }
        });

        this.setupEQCanvas(); 
        this.setupEventListeners();
        this.setupFollowerGlow(); // Initialize the glow effect
        this.updateWarpControlsVisibility(true);
        this.updateBackgroundControlsVisibility(true);
        this.toggleLightSliders();
        this.updateCameraControlsVisibility(); 
        this.updateSliderStates(); // Set initial state of sliders
    },

    setTransitioning(isTransitioning) {
        // This function will disable controls that could interfere with the transition
        const controlsToDisable = [
            'cameraTarget', 'cameraControlMode', 'autopilotMode', 
            'modelAutopilotMode', 'enableModelAutopilot'
        ];

        controlsToDisable.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.disabled = isTransitioning;
            } else {
                 console.warn(`UIManager.setTransitioning: Control element with ID '${id}' not found.`);
            }
        });

        const panel = document.getElementById('controlsPanel');
        if (panel) {
            if (isTransitioning) {
                panel.style.opacity = '0.7';
                panel.style.pointerEvents = 'none';
            } else {
                panel.style.opacity = '1.0';
                panel.style.pointerEvents = 'auto';
            }
        } else {
             console.warn("UIManager.setTransitioning: #controlsPanel not found.");
        }
    },

    updateSliderStates() {
        const isModelTarget = this.app.vizSettings.cameraTarget === 'model';
        const lookAtYSlider = document.getElementById('cameraLookAtY');
        const lookAtYLabel = document.querySelector('label[for="cameraLookAtY"]');

        if (lookAtYSlider) {
            lookAtYSlider.disabled = isModelTarget;
            if (isModelTarget) {
                lookAtYSlider.title = "Disabled: Camera automatically looks at the model.";
                if (lookAtYLabel) lookAtYLabel.style.color = '#666'; // Grey out the label
            } else {
                lookAtYSlider.title = "";
                if (lookAtYLabel) lookAtYLabel.style.color = ''; // Restore default color
            }
        } else {
             console.warn("UIManager.updateSliderStates: #cameraLookAtY not found.");
        }
    },

    setupFollowerGlow() {
        // Define the buttons that can have the glow
        this.glowTargets = {
            image: document.querySelector('.browse-btn[data-target="mainTextureInput"]'),
            audio: document.querySelector('.browse-btn[data-target="audioFileInput"]'),
            play: document.getElementById('playPauseAudioButton')
        };
        
        // Start the sequence if targets are found
        if (this.glowTargets.image) {
             this.setGlowTarget('image');
        } else {
             console.warn("UIManager.setupFollowerGlow: Initial glow target 'image' not found.");
        }
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
        if (!this.debugDisplay) { console.error("UIManager.logError: Debug display element not found.", message); return; } // Fallback to console
        this.debugDisplay.textContent = message; 
        this.debugDisplay.className = 'debugDisplay error'; 
        if (this._debugTimeout) clearTimeout(this._debugTimeout); 
        this._debugTimeout = setTimeout(() => { this.debugDisplay.textContent = ''; this.debugDisplay.className = 'debugDisplay'; }, 8000); 
    },

    logSuccess(message) { 
        if (!this.debugDisplay) { console.log("UIManager.logSuccess: Debug display element not found.", message); return; } // Fallback to console
        this.debugDisplay.textContent = message; 
        this.debugDisplay.className = 'debugDisplay success'; 
        if (this._debugTimeout) clearTimeout(this._debugTimeout); 
        this._debugTimeout = setTimeout(() => { this.debugDisplay.textContent = ''; this.debugDisplay.className = 'debugDisplay'; }, 5000); 
    },

    updateRangeDisplay(id, value) {
        const display = document.getElementById(id + 'Value');
        if (display) {
            let precision;
            if (['foldRoundness', 'foldTuckReach', 'peelDrift', 'peelTextureAmount', 'modelSpinSpeed', 'landscapeSpinSpeed'].includes(id)) {
                precision = 3;
            } else if (['metalness', 'roughness', 'reflectionStrength', 'autopilotSpeed',
                'landscapeDroopAmount', 'landscapeDroopAudioStrength', 'landscapeDroopSupportedWidthFactor', 'landscapeDroopSupportedDepthFactor',
                'bendAudioInfluence', 'sagAudioInfluence', 'foldDepth', 'foldNudge', 'foldCreaseDepth', 'foldTuckAmount',
                'shaderAudioSmoothing',
                'toneMappingExposure',
                'peelAmount', 'peelCurl',
                'joltStrength', 'joltTargetX',
                'balloonStrength', 'balloonRadius', 'balloonAudioInfluence',
                'modelAutopilotSpeed'
            ].includes(id)) {
                precision = 2;
            } else if (['deformationStrength', 'landscapeDroopFalloffSharpness',
                'cylinderRadius', 'cylinderHeightScale', 'bendFalloffSharpness', 'sagAmount', 'sagFalloffSharpness', 'foldCreaseSharpness',
                'cameraDistance', 'cameraHeight', 'cameraLookAtY', 'freeLookDistance',
                'autopilotDistance', 'autopilotHeight', 'autopilotLookAtY',
                'cameraPulseStrength', 'shaderAudioStrength', 'joltReturnSpeed',
                'modelLiveDistance', 'modelLiveHeight'
            ].includes(id)) {
                precision = 1;
            } else {
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
        else console.warn("UIManager: #shaderToyControls not found.");

        if (butterchurnControls) butterchurnControls.style.display = (mode === 'butterchurn') ? 'block' : 'none';
        else console.warn("UIManager: #butterchurnControls not found.");
        
        if (mode === 'butterchurn' && !this.app.ButterchurnManager.visualizer) {
            this.app.AudioProcessor.connectButterchurn();
        }

        if (!isInitial) {
            const backgroundModeSelect = document.getElementById('backgroundMode');
            if (backgroundModeSelect) this.refreshAccordion(backgroundModeSelect);
        }
    },

    updateWarpControlsVisibility(isInitial = false) {
        const mode = this.app.vizSettings.warpMode;
        const allWarpControls = {
            'droop': document.getElementById('warpDroopControls'), 'cylinder': document.getElementById('warpCylinderControls'),
            'bend': document.getElementById('warpBendControls'), 'sag': document.getElementById('warpSagControls'),
            'fold': document.getElementById('warpFoldControls')
        };
        for (const key in allWarpControls) {
            if (allWarpControls[key]) {
                allWarpControls[key].style.display = 'none';
            } else {
                console.warn(`UIManager: Warp control element with ID 'warp${key.charAt(0).toUpperCase() + key.slice(1)}Controls' not found.`);
            }
        }
        if (mode !== 'none' && allWarpControls[mode]) { allWarpControls[mode].style.display = 'block'; }
        if (!isInitial) {
            const warpModeSelect = document.getElementById('warpMode');
            if (warpModeSelect) this.refreshAccordion(warpModeSelect);
        }
    },

    toggleLightSliders() { 
        const disabled = this.app.vizSettings.enableLightOrbit; 
        const lightDirectionX = document.getElementById('lightDirectionX');
        const lightDirectionZ = document.getElementById('lightDirectionZ');
        if (lightDirectionX) lightDirectionX.disabled = disabled;
        else console.warn("UIManager: #lightDirectionX not found.");
        if (lightDirectionZ) lightDirectionZ.disabled = disabled;
        else console.warn("UIManager: #lightDirectionZ not found.");
    },

    refreshAccordion(elementInside) {
        let parent = elementInside.closest('.accordion-content.open');
        while (parent) {
            parent.style.maxHeight = 'none';
            const scrollHeight = parent.scrollHeight;
            parent.style.maxHeight = scrollHeight + 'px';
            parent = parent.parentElement.closest('.accordion-content.open');
        }
    },

    updateCameraControlsVisibility() {
        const mode = this.app.vizSettings.cameraControlMode;
        
        const manualControlsContainer = document.getElementById('manualControlsContainer');
        const freeLookControlsContainer = document.getElementById('freeLookControlsContainer');
        const autopilotControlsContainer = document.getElementById('autopilotControlsContainer');

        if (manualControlsContainer) manualControlsContainer.style.display = (mode === 'manual') ? 'block' : 'none';
        else console.warn("UIManager: #manualControlsContainer not found.");
        if (freeLookControlsContainer) freeLookControlsContainer.style.display = (mode === 'freelook') ? 'block' : 'none';
        else console.warn("UIManager: #freeLookControlsContainer not found.");
        if (autopilotControlsContainer) autopilotControlsContainer.style.display = (mode === 'autopilot') ? 'block' : 'none';
        else console.warn("UIManager: #autopilotControlsContainer not found.");
        
        if (mode === 'autopilot') {
            const autopilotSpeed = this.app.vizSettings.autopilotSpeeds[this.app.vizSettings.autopilotMode] || 0.2;
            const autopilotSpeedEl = document.getElementById('autopilotSpeed');
            if (autopilotSpeedEl) {
                autopilotSpeedEl.value = autopilotSpeed;
                this.updateRangeDisplay('autopilotSpeed', autopilotSpeed);
            } else {
                 console.warn("UIManager: #autopilotSpeed not found.");
            }
        }

        this.app.CameraManager.setMode(mode);
        const cameraControlModeSelect = document.getElementById('cameraControlMode');
        if (cameraControlModeSelect) this.refreshAccordion(cameraControlModeSelect);
    },

    updateFreeLookSlidersFromCamera() {
        if (!this.app.CameraManager || !this.app.CameraManager._controls) { 
            console.warn("UIManager: CameraManager or OrbitControls not initialized for free look sliders."); 
            return; 
        }
        const controls = this.app.CameraManager._controls;

        const spherical = new this.app.THREE.Spherical().setFromVector3(
            this.app.camera.position.clone().sub(controls.target)
        );
        
        const distance = spherical.radius;
        const polarDeg = this.app.THREE.MathUtils.radToDeg(spherical.phi);
        const azimuthDeg = this.app.THREE.MathUtils.radToDeg(spherical.theta);

        const freeLookPolar = document.getElementById('freeLookPolar');
        const freeLookAzimuth = document.getElementById('freeLookAzimuth');
        const freeLookDistance = document.getElementById('freeLookDistance');

        if (freeLookPolar) freeLookPolar.value = polarDeg; else console.warn("UIManager: #freeLookPolar not found.");
        if (freeLookAzimuth) freeLookAzimuth.value = azimuthDeg; else console.warn("UIManager: #freeLookAzimuth not found.");
        if (freeLookDistance) freeLookDistance.value = distance; else console.warn("UIManager: #freeLookDistance not found.");

        this.updateRangeDisplay('freeLookPolar', polarDeg);
        this.updateRangeDisplay('freeLookAzimuth', azimuthDeg);
        this.updateRangeDisplay('freeLookDistance', distance);
    },

    applyFreeLookSliders() {
        if (!this.app.CameraManager || !this.app.CameraManager._controls) { 
            console.warn("UIManager: CameraManager or OrbitControls not initialized for applying free look sliders."); 
            return; 
        }
        const controls = this.app.CameraManager._controls;
        
        const polarDegEl = document.getElementById('freeLookPolar');
        const azimuthDegEl = document.getElementById('freeLookAzimuth');
        const distanceEl = document.getElementById('freeLookDistance');

        const polarDeg = polarDegEl ? parseFloat(polarDegEl.value) : 0;
        const azimuthDeg = azimuthDegEl ? parseFloat(azimuthDegEl.value) : 0;
        const distance = distanceEl ? parseFloat(distanceEl.value) : 30;

        if (!polarDegEl || !azimuthDegEl || !distanceEl) {
            console.warn("UIManager: One or more free look slider elements not found.");
            return;
        }
        
        const phi = this.app.THREE.MathUtils.degToRad(polarDeg);
        const theta = this.app.THREE.MathUtils.degToRad(azimuthDeg);

        const newPos = new this.app.THREE.Vector3();
        newPos.setFromSphericalCoords(distance, phi, theta);

        newPos.add(controls.target);

        this.app.camera.position.copy(newPos);
        this.app.camera.lookAt(controls.target);

        controls.update();
    },

    updateAutopilotSliders() {
        if (!this.app.CameraManager || !this.app.CameraManager._controls) return;
        
        const camPos = this.app.camera.position;
        const lookAt = this.app.CameraManager._controls.target;

        const distance = camPos.length();
        const height = camPos.y;
        const lookAtY = lookAt.y;
        
        const autopilotDistance = document.getElementById('autopilotDistance');
        const autopilotHeight = document.getElementById('autopilotHeight');
        const autopilotLookAtY = document.getElementById('autopilotLookAtY');

        if (autopilotDistance) autopilotDistance.value = distance; else console.warn("UIManager: #autopilotDistance not found.");
        if (autopilotHeight) autopilotHeight.value = height; else console.warn("UIManager: #autopilotHeight not found.");
        if (autopilotLookAtY) autopilotLookAtY.value = lookAtY; else console.warn("UIManager: #autopilotLookAtY not found.");

        this.updateRangeDisplay('autopilotDistance', distance);
        this.updateRangeDisplay('autopilotHeight', height);
        this.updateRangeDisplay('autopilotLookAtY', lookAtY);
    },

    handleManualSliderInput(id, value) {
        const S = this.app.vizSettings;
        S[id] = parseFloat(value);
        this.updateRangeDisplay(id, value);

        if (S.cameraTarget === 'model') {
            if (this.app.ModelManager) {
                this.app.ModelManager.setPositionFromSliders(
                    S.cameraDistance, 
                    S.cameraHeight
                );
            } else {
                console.warn("UIManager.handleManualSliderInput: ModelManager not available to set model position.");
            }
        }
    },

    setupEventListeners() {
        const toggleMicInput = document.getElementById('toggleMicInput');
        if (toggleMicInput) toggleMicInput.addEventListener('click', () => this.app.AudioProcessor.startMic());
        else console.warn("UIManager.setupEventListeners: #toggleMicInput not found.");

        const playPauseAudioButton = document.getElementById('playPauseAudioButton');
        if (playPauseAudioButton) {
            playPauseAudioButton.addEventListener('click', () => {
                this.app.AudioProcessor.toggleFilePlayback();
                this.setGlowTarget(null); 
            });
        } else {
            console.warn("UIManager.setupEventListeners: #playPauseAudioButton not found.");
        }

        const playTestToneButton = document.getElementById('playTestToneButton');
        if (playTestToneButton) playTestToneButton.addEventListener('click', () => this.app.AudioProcessor.toggleTestTone());
        else console.warn("UIManager.setupEventListeners: #playTestToneButton not found.");

        document.querySelectorAll('.browse-btn').forEach(btn => {
            const targetEl = document.getElementById(btn.dataset.target);
            if (targetEl) {
                btn.addEventListener('click', () => targetEl.click());
            } else {
                console.warn(`UIManager.setupEventListeners: Browse button target element with ID '${btn.dataset.target}' not found.`);
            }
        });

        ['mainTextureInput', 'videoTextureInput', 'audioFileInput', 'gltfModelInput', 'hdriInput'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', (e) => this.handleFileSelect(e, id));
            else console.warn(`UIManager.setupEventListeners: File input element with ID '${id}' not found.`);
        });

        ['cameraDistance', 'cameraHeight'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', (e) => {
                this.handleManualSliderInput(e.target.id, e.target.value);
            });
            else console.warn(`UIManager.setupEventListeners: Camera control element with ID '${id}' not found.`);
        });

        document.querySelectorAll('input[type="range"], input[type="number"], input[type="color"], input[type="checkbox"], select').forEach(control => {
            if (['cameraDistance', 'cameraHeight'].includes(control.id) || control.id.startsWith('butterchurn') || control.id.startsWith('autopilotDistance') || control.id.startsWith('autopilotHeight') || control.id.startsWith('autopilotLookAtY') || control.id.startsWith('modelLive')) return;
            
            if (control) {
                control.addEventListener('input', (e) => {
                    const id = e.target.id;
                    const S = this.app.vizSettings;
                    let value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;

                    if (id === 'cameraTarget') {
                        this.app.startTransitionTo(value);
                        return; 
                    }

                    if (e.target.type === 'checkbox') {
                        S[id] = value;
                    } else if (e.target.type === 'range' || e.target.type === 'number') {
                        S[id] = parseFloat(value);
                        this.updateRangeDisplay(id, value);
                    } else {
                        S[id] = value;
                    }
                    
                    if (id === 'warpMode') this.updateWarpControlsVisibility();
                    if (id === 'planeOrientation' && this.app.ImagePlaneManager) this.app.ImagePlaneManager.applyOrientation();
                    if (id === 'backgroundMode') this.updateBackgroundControlsVisibility();
                    if (id === 'cameraControlMode') this.updateCameraControlsVisibility();
                    if (id === 'autopilotMode' && this.app.CameraManager) {
                        this.app.CameraManager.setAutopilotMode(value);
                        const newSpeed = S.autopilotSpeeds[value] || 0.2;
                        const autopilotSpeedEl = document.getElementById('autopilotSpeed');
                        if (autopilotSpeedEl) {
                            autopilotSpeedEl.value = newSpeed;
                            this.updateRangeDisplay('autopilotSpeed', newSpeed);
                        }
                    }
                    if (id === 'enableLightOrbit') this.toggleLightSliders();

                    if (id === 'enablePBRColor' && this.app.ImagePlaneManager?.landscapeMaterial?.uniforms?.u_map?.value) {
                        this.app.ImagePlaneManager.landscapeMaterial.uniforms.u_map.value.colorSpace = e.target.checked ? this.app.THREE.SRGBColorSpace : this.app.THREE.NoColorSpace;
                        this.app.ImagePlaneManager.landscapeMaterial.uniforms.u_map.value.needsUpdate = true;
                    }
                });
            }
        });

        ['freeLookAzimuth', 'freeLookPolar', 'freeLookDistance'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', (e) => {
                    this.updateRangeDisplay(e.target.id, e.target.value);
                    this.applyFreeLookSliders();
                });
            }
        });
        
        const enableModelDistancePlus = document.getElementById('enableModelDistancePlus');
        const enableModelDistanceMinus = document.getElementById('enableModelDistanceMinus');
        if (enableModelDistancePlus && enableModelDistanceMinus) {
            enableModelDistancePlus.addEventListener('change', (e) => { if (e.target.checked) { enableModelDistanceMinus.checked = false; this.app.vizSettings.enableModelDistanceMinus = false; }});
            enableModelDistanceMinus.addEventListener('change', (e) => { if (e.target.checked) { enableModelDistancePlus.checked = false; this.app.vizSettings.enableModelDistancePlus = false; }});
        }

        this.setupButterchurnEventListeners();
        const controlsToggleButton = document.getElementById('controlsToggleButton');
        if (controlsToggleButton) {
            controlsToggleButton.addEventListener('click', (e) => { 
                const panel = document.getElementById('controlsPanel'); 
                if (panel) {
                    panel.classList.toggle('visible'); 
                    e.target.textContent = panel.classList.contains('visible') ? "Hide" : "Show"; 
                }
            });
        }

        document.querySelectorAll('.accordion-header').forEach(header => {
            if (header) {
                header.addEventListener('click', (e) => {
                    if (e.target.type === 'checkbox' || e.target.closest('input') || e.target.closest('select')) return;
                    const content = header.nextElementSibling;
                    if (!content || !content.classList.contains('accordion-content')) return;
                    
                    content.classList.toggle('open');
                    if (content.classList.contains('open')) {
                        content.style.maxHeight = content.scrollHeight + 'px';
                    } else {
                        content.style.maxHeight = '0px';
                    }
                });
            }
        });

        const loadShaderCode = document.getElementById('loadShaderCode');
        if (loadShaderCode) loadShaderCode.addEventListener('click', () => this.app.ShaderManager.loadUserShader());

        const clearShaderCode = document.getElementById('clearShaderCode');
        const shaderToyGLSL = document.getElementById('shaderToyGLSL');
        if (clearShaderCode && shaderToyGLSL) clearShaderCode.addEventListener('click', () => { shaderToyGLSL.value = ''; this.app.vizSettings.shaderToyGLSL = ''; this.logSuccess('Shader cleared.'); });

        const pasteShaderCode = document.getElementById('pasteShaderCode');
        if (pasteShaderCode && shaderToyGLSL) pasteShaderCode.addEventListener('click', async () => { try { const text = await navigator.clipboard.readText(); shaderToyGLSL.value = text; this.app.vizSettings.shaderToyGLSL = text; this.logSuccess('Pasted from clipboard.'); } catch (err) { this.logError('Failed to read from clipboard.'); } });

        ['presetBg1', 'presetBg2', 'presetBg3'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('click', () => {
                    const shaderToyGLSLEl = document.getElementById('shaderToyGLSL');
                    if (shaderToyGLSLEl && this.app.shaderPresets && this.app.shaderPresets[id]) {
                        shaderToyGLSLEl.value = this.app.shaderPresets[id];
                        this.app.vizSettings.shaderToyGLSL = this.app.shaderPresets[id];
                        this.logSuccess(`Preset '${id}' loaded.`);
                        this.app.ShaderManager.loadUserShader();
                    }
                });
            }
        });

        for (let i = 0; i < 4; i++) {
            const channelInput = document.getElementById(`iChannel${i}Input`);
            if (channelInput) channelInput.addEventListener('change', (e) => this.app.ShaderManager.loadChannelTexture(i, e.target.files[0]));
        }
        
        const enableFovPlus = document.getElementById('enableFovPlus');
        const enableFovMinus = document.getElementById('enableFovMinus');
        if (enableFovPlus && enableFovMinus) {
            enableFovPlus.addEventListener('change', (e) => { if (e.target.checked) enableFovMinus.checked = false; this.app.vizSettings.enableFovMinus = false; });
            enableFovMinus.addEventListener('change', (e) => { if (e.target.checked) enableFovPlus.checked = false; this.app.vizSettings.enableFovPlus = false; });
        }
        
        const landscapeResetButton = document.getElementById('landscapeResetButton');
        if (landscapeResetButton) landscapeResetButton.addEventListener('click', () => this.resetLandscapeSettings());

        const clearBalloonPointsButton = document.getElementById('clearBalloonPointsButton');
        if (clearBalloonPointsButton) clearBalloonPointsButton.addEventListener('click', () => this.app.ImagePlaneManager.clearPoints());

        for (let i = 1; i <= 6; i++) {
            const modelPresetButton = document.getElementById(`modelPreset${i}`);
            if (modelPresetButton) {
                modelPresetButton.addEventListener('click', () => {
                    const preset = this.app.modelPresets[`modelPreset${i}`];
                    if (preset) {
                        this.app.ModelManager.loadGLTFModel(preset.path);
                        this.logSuccess(`Loading preset: ${preset.name}`);
                    }
                });
            }
        }

        const canvas = document.getElementById('glCanvas');
        if (canvas) {
            let mouseDownPos = { x: -1, y: -1 };
            canvas.addEventListener('mousedown', e => {
                mouseDownPos.x = e.clientX;
                mouseDownPos.y = e.clientY;
                this.app.mouseState.z = e.offsetX; this.app.mouseState.w = canvas.clientHeight - e.offsetY; this.app.mouseState.x = e.offsetX; this.app.mouseState.y = canvas.clientHeight - e.offsetY;
            });

            canvas.addEventListener('mouseup', (event) => {
                if (this.app.mouseState.z > 0) {
                    this.app.mouseState.z = -Math.abs(this.app.mouseState.z); this.app.mouseState.w = -Math.abs(this.app.mouseState.w);
                }
                if (this.app.isTransitioning) return;
                const dist = Math.sqrt(Math.pow(event.clientX - mouseDownPos.x, 2) + Math.pow(event.clientY - mouseDownPos.y, 2));
                if (dist > 5) return; 

                if (this.app.vizSettings.enableBalloon && this.app.ImagePlaneManager) {
                    this.app.ImagePlaneManager.addPointFromScreen(event.clientX, event.clientY);
                }
            });

            canvas.addEventListener('mousemove', e => { if (this.app.mouseState.z > 0) { this.app.mouseState.x = e.offsetX; this.app.mouseState.y = canvas.clientHeight - e.offsetY; } });
        }
    },

    resetLandscapeSettings() {
        const landscapeKeys = [
            'enableLandscape', 'enableLandscapeSpin', 'landscapeSpinSpeed', 'peelAmount', 'peelCurl', 'peelAnimationStyle', 'peelDrift', 'peelTextureAmount', 'peelAudioSource',
            'warpMode', 'foldAngle', 'foldDepth', 'foldRoundness', 'foldAudioInfluence', 'foldNudge', 'enableFoldCrease',
            'foldCreaseDepth', 'foldCreaseSharpness', 'enableFoldTuck', 'foldTuckAmount', 'foldTuckReach', 'sagAmount',
            'sagFalloffSharpness', 'sagAudioInfluence', 'bendAngle', 'bendAudioInfluence', 'bendFalloffSharpness', 'bendAxis',
            'cylinderRadius', 'cylinderHeightScale', 'cylinderAxisAlignment', 'cylinderArcAngle', 'cylinderArcOffset',
            'landscapeDroopAmount', 'landscapeDroopAudioStrength', 'landscapeDroopFalloffSharpness',
            'landscapeDroopSupportedWidthFactor', 'landscapeDroopSupportedDepthFactor', 'deformationStrength',
            'enableBalloon', 'balloonStrength', 'balloonRadius', 'balloonAudioInfluence',
            'enableJolt', 'joltBeatDivision', 'joltTargetX', 'joltStrength', 'joltReturnSpeed'
        ];

        landscapeKeys.forEach(key => {
            const defaultValue = this.app.defaultVisualizerSettings[key];
            if (defaultValue !== undefined) {
                this.app.vizSettings[key] = defaultValue;
                const el = document.getElementById(key);
                if (el) {
                    if (el.type === 'checkbox') {
                        el.checked = defaultValue;
                    } else {
                        el.value = defaultValue;
                    }
                    if(el.type === 'range' || el.type === 'number') {
                        this.updateRangeDisplay(key, defaultValue);
                    }
                }
            }
        });
        
        this.updateWarpControlsVisibility();

        if (this.app.gltfModel) this.app.gltfModel.visible = false;
        
        if (this.app.ImagePlaneManager && this.app.ImagePlaneManager.landscape) {
            this.app.ImagePlaneManager.landscape.visible = true;
            const enableLandscapeCheckbox = document.getElementById('enableLandscape');
            if (enableLandscapeCheckbox) enableLandscapeCheckbox.checked = true;
            this.app.vizSettings.enableLandscape = true;
        }
        
        this.app.jolt_currentOffset = 0.0;
        if (this.app.ImagePlaneManager) this.app.ImagePlaneManager.clearPoints();

        this.logSuccess('Landscape settings reset. Switched to plane.');
    },

    setupButterchurnEventListeners() {
        const speedSlider = document.getElementById('butterchurnSpeed');
        if (speedSlider) {
            const updateSpeedDisplay = (sliderValue) => { this.updateRangeDisplay('butterchurnSpeed', sliderValue); };
            speedSlider.addEventListener('input', (e) => { const val = parseInt(e.target.value); this.app.vizSettings.butterchurnSpeed = val; updateSpeedDisplay(val); });
            updateSpeedDisplay(speedSlider.value);
        }

        const butterchurnAudioInfluence = document.getElementById('butterchurnAudioInfluence');
        if (butterchurnAudioInfluence && this.app.AudioProcessor) {
            butterchurnAudioInfluence.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                this.app.vizSettings.butterchurnAudioInfluence = val;
                this.updateRangeDisplay('butterchurnAudioInfluence', val);
                if (this.app.AudioProcessor.butterchurnGainNode && this.app.AudioProcessor.audioContext) {
                    this.app.AudioProcessor.butterchurnGainNode.gain.setValueAtTime(val, this.app.AudioProcessor.audioContext.currentTime);
                }
            });
        }

        const butterchurnBlendTime = document.getElementById('butterchurnBlendTime');
        if (butterchurnBlendTime) butterchurnBlendTime.addEventListener('input', (e) => { const val = parseFloat(e.target.value); this.app.vizSettings.butterchurnBlendTime = val; this.updateRangeDisplay('butterchurnBlendTime', val); });

        const butterchurnCycleTime = document.getElementById('butterchurnCycleTime');
        if (butterchurnCycleTime && this.app.ButterchurnManager) butterchurnCycleTime.addEventListener('input', (e) => { const val = parseFloat(e.target.value); this.app.vizSettings.butterchurnCycleTime = val; this.updateRangeDisplay('butterchurnCycleTime', val); this.app.ButterchurnManager.updateCycleInterval(); });

        const butterchurnOpacity = document.getElementById('butterchurnOpacity');
        if (butterchurnOpacity) butterchurnOpacity.addEventListener('input', (e) => { const val = parseFloat(e.target.value); this.app.vizSettings.butterchurnOpacity = val; this.updateRangeDisplay('butterchurnOpacity', val); if (this.app.butterchurnMaterial) this.app.butterchurnMaterial.opacity = val; });

        const butterchurnTintColor = document.getElementById('butterchurnTintColor');
        if (butterchurnTintColor) butterchurnTintColor.addEventListener('input', (e) => { this.app.vizSettings.butterchurnTintColor = e.target.value; if (this.app.butterchurnMaterial) this.app.butterchurnMaterial.color.set(e.target.value); });

        const butterchurnEnableCycle = document.getElementById('butterchurnEnableCycle');
        if (butterchurnEnableCycle && this.app.ButterchurnManager) butterchurnEnableCycle.addEventListener('change', (e) => { this.app.vizSettings.butterchurnEnableCycle = e.target.checked; this.app.ButterchurnManager.updateCycleInterval(); });

        const butterchurnPrevPreset = document.getElementById('butterchurnPrevPreset');
        if (butterchurnPrevPreset && this.app.ButterchurnManager) butterchurnPrevPreset.addEventListener('click', () => this.app.ButterchurnManager.prevPreset());

        const butterchurnRandomPreset = document.getElementById('butterchurnRandomPreset');
        if (butterchurnRandomPreset && this.app.ButterchurnManager) butterchurnRandomPreset.addEventListener('click', () => this.app.ButterchurnManager.randomPreset());

        const butterchurnNextPreset = document.getElementById('butterchurnNextPreset');
        if (butterchurnNextPreset && this.app.ButterchurnManager) butterchurnNextPreset.addEventListener('click', () => this.app.ButterchurnManager.nextPreset());

        const butterchurnSearchButton = document.getElementById('butterchurnSearchButton');
        if (butterchurnSearchButton) butterchurnSearchButton.addEventListener('click', () => this.filterButterchurnPresets());

        const butterchurnPresetSearch = document.getElementById('butterchurnPresetSearch');
        if (butterchurnPresetSearch) butterchurnPresetSearch.addEventListener('keyup', (e) => { if (e.key === 'Enter') this.filterButterchurnPresets(); });

        const butterchurnPresetList = document.getElementById('butterchurnPresetList');
        if (butterchurnPresetList && this.app.ButterchurnManager) butterchurnPresetList.addEventListener('change', (e) => { const selectedIndex = parseInt(e.target.value); if (!isNaN(selectedIndex)) this.app.ButterchurnManager.loadPresetByIndex(selectedIndex); });
    },

    filterButterchurnPresets() {
        const searchTermEl = document.getElementById('butterchurnPresetSearch');
        const listElement = document.getElementById('butterchurnPresetList');
        const totalPresetsSpan = document.getElementById('butterchurnTotalPresets');

        if (!searchTermEl || !listElement || !totalPresetsSpan || !this.app.ButterchurnManager) {
            console.warn("UIManager.filterButterchurnPresets: One or more Butterchurn UI elements not found.");
            return;
        }

        const searchTerm = searchTermEl.value.toLowerCase();
        const allKeys = this.app.ButterchurnManager.presetKeys;

        if (!allKeys || allKeys.length === 0) {
            totalPresetsSpan.textContent = "0";
            listElement.innerHTML = '';
            const option = document.createElement('option');
            option.textContent = 'No presets loaded.';
            option.disabled = true;
            listElement.appendChild(option);
            this.refreshAccordion(listElement);
            return;
        }

        listElement.innerHTML = '';

        const filteredKeys = searchTerm === '' ? allKeys : allKeys.filter(key => key.toLowerCase().includes(searchTerm));

        if (filteredKeys.length === 0) {
            const option = document.createElement('option');
            option.textContent = 'No matching presets found.';
            option.disabled = true;
            listElement.appendChild(option);
        } else {
            filteredKeys.forEach(key => {
                const originalIndex = allKeys.indexOf(key);
                const option = document.createElement('option');
                option.value = originalIndex;
                option.textContent = key.split(" - ").pop();
                listElement.appendChild(option);
            });
        }
        
        totalPresetsSpan.textContent = filteredKeys.length;

        const currentPresetIsVisible = filteredKeys.some(key => allKeys.indexOf(key) === this.app.ButterchurnManager.currentPresetIndex);
        if (currentPresetIsVisible) {
            listElement.value = this.app.ButterchurnManager.currentPresetIndex;
        } else if (listElement.options.length > 0 && !listElement.options[0].disabled) {
            listElement.selectedIndex = 0;
        }

        this.refreshAccordion(listElement);
    },

    handleFileSelect(event, id) {
        const file = event.target.files[0]; 
        if (!file) return; 

        switch (id) {
            case 'mainTextureInput': 
            case 'videoTextureInput':
                this.updateFileNameDisplay('image', file.name);
                if (this.app.ImagePlaneManager) this.app.ImagePlaneManager.loadTexture(file);
                this.setGlowTarget('audio');
                break;
            case 'audioFileInput': 
                this.updateFileNameDisplay('audio', file.name);
                if (this.app.AudioProcessor) this.app.AudioProcessor.loadAudioFile(file);
                this.setGlowTarget('play');
                break;
            case 'hdriInput': 
                this.updateFileNameDisplay('hdri', file.name);
                if (this.app.SceneManager) this.app.SceneManager.loadHDRI(file);
                break;
            case 'gltfModelInput':
                this.updateFileNameDisplay('gltf', file.name);
                if (this.app.ModelManager) this.app.ModelManager.loadGLTFModel(file);
                break;
        }
    },

    updateFileNameDisplay(type, name) {
        const idMap = {
            'image': 'imageFileName',
            'video': 'videoFileName',
            'audio': 'audioFileName',
            'hdri': 'hdriFileName',
            'gltf': 'gltfFileName'
        };
        const elementId = idMap[type];
        if (elementId) {
            const el = document.getElementById(elementId);
            if (el) {
                el.textContent = name;
            } else {
                 console.warn(`UIManager.updateFileNameDisplay: File name display element with ID '${elementId}' not found.`);
            }
        }
    },

    updateAudioStatus(sourceType, statusText = '') {
        if (!this.audioStatusP) { console.warn("UIManager.updateAudioStatus: #audioStatusP not found."); return; }
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
};