import * as THREE from 'three';

const FFT_SIZE = 2048;

export default class AudioManager {
    constructor(camera) {
        this.listener = new THREE.AudioListener();
        camera.add(this.listener);

        this.sound = new THREE.Audio(this.listener);
        this.analyser = new THREE.AudioAnalyser(this.sound, FFT_SIZE);
    }
    
    // Updated to handle a File object from the user
    loadAudioFile(file, loop = true) {
        const url = URL.createObjectURL(file);
        const audioLoader = new THREE.AudioLoader();
        audioLoader.load(url, (buffer) => {
            if(this.sound.isPlaying) {
                this.sound.stop();
            }
            this.sound.setBuffer(buffer);
            this.sound.setLoop(loop);
            this.sound.setVolume(0.5);
            console.log('Audio file loaded.');
            // We won't auto-play, we'll wait for the user to press play
        });
    }

    getFrequency() {
        if (!this.analyser || !this.sound.isPlaying) return 0;
        return this.analyser.getAverageFrequency();
    }

    getFrequencyData() {
        if (!this.analyser || !this.sound.isPlaying) return new Uint8Array(FFT_SIZE / 2).fill(0);
        return this.analyser.getFrequencyData();
    }
}