import { Debugger } from './Debugger.js';
import THREE from '../three-singleton.js';

export const AudioProcessor = {
    app: null, // Will be set on init

    // --- State ---
    audioContext: null,
    analyser: null,
    sourceNode: null,
    audioElement: null,
    fileSourceNode: null,
    testToneOscillator: null,
    testToneGain: null,
    testToneInterval: null,
    butterchurnGainNode: null,
    activeAudioSource: 'none',

    // --- Data Outputs ---
    frequencyData: null, 
    smoothedFrequencyData: null,
    textureDataUint8: null,
    audioTexture: null, 
    energy: {
        low: 0.0,
        mid: 0.0,
        high: 0.0,
        overall: 0.0,
    },
    triggers: {
        beat: false,
        beat2: false,
        beat4: false,
    },

    // --- Adaptive Beat Detection Internals ---
    _beatCount: 0,
    _beatTime: 0,
    _onsetTimeout: 0.15,
    _energyHistory: [],
    _HISTORY_LENGTH: 60,
    _MINIMUM_BEAT_ENERGY: 0.15,

    init(appInstance) {
        this.app = appInstance;
        for (let i = 0; i < this._HISTORY_LENGTH; i++) {
            this._energyHistory.push(0);
        }
    },

    _ensureAudioContext() {
        if (this.audioContext && this.audioContext.state === 'running') {
            return true;
        }
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
            return this.audioContext.state === 'running';
        }
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 512;
            this.analyser.smoothingTimeConstant = this.app.vizSettings.audioSmoothing;
            
            // THE FIX IS HERE: Simplified the Butterchurn audio path
            this.butterchurnGainNode = this.audioContext.createGain();
            // The butterchurnGainNode is now just for analysis and doesn't need to connect to the destination.
            // The main source will be connected to the destination directly for playback.

            const bufferLength = this.analyser.frequencyBinCount;
            this.frequencyData = new Uint8Array(bufferLength);
            this.smoothedFrequencyData = new Float32Array(bufferLength);
            this.textureDataUint8 = new Uint8Array(bufferLength);
            
            this.audioTexture = new THREE.DataTexture(
                this.textureDataUint8,
                bufferLength,
                1,
                THREE.RedFormat,
                THREE.UnsignedByteType
            );
            this.audioTexture.needsUpdate = true;

            return true;
        } catch (e) {
            console.error("Could not initialize AudioContext.", e);
            if(this.app.UIManager) this.app.UIManager.updateAudioStatus('error', "Audio failed.");
            return false;
        }
    },

    _connectSourceToNodes(source) {
        // Connect source to the two analysis nodes
        source.connect(this.analyser);
        source.connect(this.butterchurnGainNode);

        // THE FIX IS HERE: Consistently connect audible sources to the destination
        // This ensures sound plays regardless of microphone or file input.
        if (this.activeAudioSource !== 'mic') {
            source.connect(this.audioContext.destination);
        }
    },

    _disconnectActiveSource() {
        if (this.sourceNode) try { this.sourceNode.disconnect(); this.sourceNode.mediaStream.getTracks().forEach(t => t.stop()); } catch (e) {console.warn("Error disconnecting sourceNode:", e);}
        if (this.fileSourceNode) try { this.fileSourceNode.disconnect(); } catch (e) {console.warn("Error disconnecting fileSourceNode:", e);}
        if (this.testToneGain) try { this.testToneGain.disconnect(); } catch (e) {console.warn("Error disconnecting testToneGain:", e);}
        if (this.testToneOscillator) { this.testToneOscillator.stop(); }
        if (this.testToneInterval) { clearInterval(this.testToneInterval); }
        this.sourceNode = this.testToneOscillator = this.testToneGain = this.testToneInterval = null;
        this.activeAudioSource = 'none';
    },

    stopAudio() {
        this._disconnectActiveSource();
        if (this.audioElement && !this.audioElement.paused) this.audioElement.pause();
        this.app.UIManager.updateAudioStatus('none');
    },

    async startMic() {
        if (this.activeAudioSource === 'mic') { this.stopAudio(); return; }
        if (!this._ensureAudioContext()) return;
        this.stopAudio();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            this.sourceNode = this.audioContext.createMediaStreamSource(stream);
            this.activeAudioSource = 'mic';
            this._connectSourceToNodes(this.sourceNode);
            this.app.UIManager.updateAudioStatus('mic');
            this.connectButterchurn();
        } catch (err) { this.app.UIManager.updateAudioStatus('error', "Mic access denied."); }
    },

    loadAudioFile(file) {
        this.audioElement = this.audioElement || document.getElementById('audioSourceElement');
        if (!this.audioElement) {
            this.app.UIManager.logError("Audio source element (audioSourceElement) not found in DOM.");
            return;
        }
        this.audioElement.src = URL.createObjectURL(file);
        this.activeAudioSource = 'file';
        this.app.UIManager.updateAudioStatus('file_ready');
    },

    toggleFilePlayback() {
        if (!this.audioElement || !this.audioElement.src) {
            this.app.UIManager.logError("No audio file loaded or audio element missing.");
            return;
        }
        if (!this._ensureAudioContext()) return;
        if (this.activeAudioSource === 'file' && !this.fileSourceNode) {
            this.fileSourceNode = this.audioContext.createMediaElementSource(this.audioElement);
            this._connectSourceToNodes(this.fileSourceNode);
            this.audioElement.onplay = () => this.app.UIManager.updateAudioStatus('file_playing');
            this.audioElement.onpause = () => this.app.UIManager.updateAudioStatus('file_paused');
            this.connectButterchurn();
        }
        if (this.audioElement.paused) {
            this.audioElement.play().catch(e => {
                console.warn("Audio playback failed to start automatically. User may need to click again.", e.message);
            });
        } else {
            this.audioElement.pause();
        }
    },

    toggleTestTone() {
        if (this.activeAudioSource === 'testTone') { this.stopAudio(); return; }
        if (!this._ensureAudioContext()) return;
        this.stopAudio();
        this.activeAudioSource = 'testTone';
        this.testToneGain = this.audioContext.createGain();
        this._connectSourceToNodes(this.testToneGain);
        const mode = this.app.vizSettings.testToneMode || 'dynamicPulse';
        if (mode === 'dynamicPulse') {
            this.testToneInterval = setInterval(() => {
                if(!this.audioContext) return;
                const osc = this.audioContext.createOscillator(); const gain = this.audioContext.createGain();
                osc.type = 'sine'; osc.frequency.value = 60; osc.connect(gain).connect(this.testToneGain);
                const now = this.audioContext.currentTime;
                gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(0.5, now + 0.05); gain.gain.linearRampToValueAtTime(0, now + 0.1);
                osc.start(now); osc.stop(now + 0.15);
            }, 500);
        } else {
            this.testToneOscillator = this.audioContext.createOscillator(); this.testToneOscillator.connect(this.testToneGain); this.testToneGain.gain.value = 0.2;
            if (mode === 'warble') { 
                this.testToneOscillator.type = 'sawtooth'; this.testToneOscillator.frequency.value = 300; 
                const lfo = this.audioContext.createOscillator(); 
                const lfoGain = this.audioContext.createGain(); 
                lfoGain.gain.value = 100; lfo.connect(lfoGain).connect(this.testToneOscillator.frequency); 
                lfo.start(); 
            }
            else { this.testToneOscillator.type = 'sine'; this.testToneOscillator.frequency.value = 440; }
            this.testToneOscillator.start();
        }
        this.app.UIManager.updateAudioStatus('testTone');
        this.connectButterchurn();
    },

    connectButterchurn() {
        if (this.audioContext && this.app.vizSettings.backgroundMode === 'butterchurn') {
            if (this.app.ButterchurnManager && typeof this.app.ButterchurnManager.connectAudio === 'function') {
                this.app.ButterchurnManager.connectAudio(this.audioContext, this.butterchurnGainNode);
            } else {
                if(this.app.UIManager) this.app.UIManager.logError("ButterchurnManager not available to connect audio.");
            }
        }
    },

    updateAudioData() {
        this.triggers.beat = false;
        this.triggers.beat2 = false;
        this.triggers.beat4 = false;

        if (!this.analyser || !this.frequencyData || this.activeAudioSource === 'none') {
            if (this.frequencyData) this.frequencyData.fill(0);
            if (this.smoothedFrequencyData) this.smoothedFrequencyData.fill(0);
            if (this.textureDataUint8) this.textureDataUint8.fill(0);
            if (this.app.UIManager && this.app.UIManager.eqCanvas) this.app.UIManager.updateEQ(this.frequencyData);
            this.energy.low = this.energy.mid = this.energy.high = this.energy.overall = 0;
            return;
        }

        this.analyser.getByteFrequencyData(this.frequencyData);
        if (this.app.UIManager && this.app.UIManager.eqCanvas) this.app.UIManager.updateEQ(this.frequencyData);

        const smoothingFactor = this.app.vizSettings.gpgpu_eqRippleSmoothing;
        for (let i = 0; i < this.frequencyData.length; i++) {
            this.smoothedFrequencyData[i] = this.smoothedFrequencyData[i] * smoothingFactor + this.frequencyData[i] * (1.0 - smoothingFactor);
            this.textureDataUint8[i] = Math.round(this.smoothedFrequencyData[i]);
        }
        if (this.audioTexture) {
            this.audioTexture.needsUpdate = true;
        }


        const n = this.analyser.frequencyBinCount;
        const norm = 1 / 255.0;

        const lowEnd = Math.floor(n * 0.15);
        const midStart = Math.floor(n * 0.15);
        const midEnd = Math.floor(n * 0.50);
        const highStart = Math.floor(n * 0.50);

        let lowSum = 0, midSum = 0, highSum = 0;
        for (let i = 0; i < n; i++) {
            const val = this.frequencyData[i];
            if (i <= lowEnd) lowSum += val;
            if (i >= midStart && i <= midEnd) midSum += val;
            if (i >= highStart) highSum += val;
        }
        this.energy.low = (lowSum / (lowEnd + 1)) * norm || 0;
        this.energy.mid = (midSum / (midEnd - midStart + 1)) * norm || 0;
        this.energy.high = (highSum / (n - highStart)) * norm || 0;
        this.energy.overall = (this.energy.low + this.energy.mid + this.energy.high) / 3.0;

        const currentMidEnergy = this.energy.mid;
        
        let historySum = 0;
        for (let i = 0; i < this._HISTORY_LENGTH; i++) {
            historySum += this._energyHistory[i];
        }
        const averageEnergy = historySum / this._HISTORY_LENGTH;
        const dynamicThreshold = averageEnergy * (this.app.vizSettings.joltSensitivity || 1.8);

        if (currentMidEnergy > this._MINIMUM_BEAT_ENERGY &&
            currentMidEnergy > dynamicThreshold && 
           (this.app.currentTime - this._beatTime > this._onsetTimeout)) 
        {
            this._beatTime = this.app.currentTime;
            this._beatCount++;
            this.triggers.beat = true;
            if (this._beatCount % 2 === 0) this.triggers.beat2 = true;
            if (this._beatCount % 4 === 0) this.triggers.beat4 = true;
        }

        this._energyHistory.shift();
        this._energyHistory.push(currentMidEnergy);
    }
};