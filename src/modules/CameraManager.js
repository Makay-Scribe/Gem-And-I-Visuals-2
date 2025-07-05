import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const CameraManager = {
    app: null, // Will be set on init

    _controls: null, _isMouseDragging: false, _state: 'manual',
    _autopilotTargetPos: null, _autopilotTargetLookAt: null,
    _transition: { active: false, startPos: null, endPos: null, startLookAt: null, endLookAt: null, progress: 0, duration: 25.0, },
    _hold: { timer: 0 },
    _fovTransition: { active: false, start: 0, end: -1, progress: 0, duration: 1.0 },
    _manualReturnTransition: { active: false, startPos: null, endPos: null, startLookAt: null, endLookAt: null, progress: 0, duration: 0.5 },
    _masterReturnTransition: { active: false, startPos: null, endPos: null, startLookAt: null, endLookAt: null, progress: 0, duration: 2.0 },

    init(appInstance) {
        this.app = appInstance;
        const THREE = this.app.THREE;

        // Initialize Vector3 properties here where THREE is available
        this._autopilotTargetPos = new THREE.Vector3();
        this._autopilotTargetLookAt = new THREE.Vector3();
        this._transition.startPos = new THREE.Vector3();
        this._transition.endPos = new THREE.Vector3();
        this._transition.startLookAt = new THREE.Vector3();
        this._transition.endLookAt = new THREE.Vector3();
        this._manualReturnTransition.startPos = new THREE.Vector3();
        this._manualReturnTransition.endPos = new THREE.Vector3();
        this._manualReturnTransition.startLookAt = new THREE.Vector3();
        this._manualReturnTransition.endLookAt = new THREE.Vector3();
        this._masterReturnTransition.startPos = new THREE.Vector3();
        this._masterReturnTransition.endPos = new THREE.Vector3();
        this._masterReturnTransition.startLookAt = new THREE.Vector3();
        this._masterReturnTransition.endLookAt = new THREE.Vector3();
        
        this._controls = new OrbitControls(this.app.camera, this.app.renderer.domElement);
        this._controls.enableDamping = true;
        this._controls.dampingFactor = 0.1;
        this._controls.enabled = false; // Initially disabled, will be enabled by mode manager

        this._controls.addEventListener('start', () => {
            this._isMouseDragging = true;
            this._manualReturnTransition.active = false; // Cancel any return transition if user drags again
        });
        this._controls.addEventListener('end', () => {
            this._isMouseDragging = false;
            if (this.app.vizSettings.cameraControlMode === 'freelook') {
                this.app.UIManager.updateFreeLookSlidersFromCamera();
            } else if (this.app.vizSettings.cameraControlMode === 'manual') {
                this.startManualReturn();
            }
        });
         this._controls.addEventListener('change', () => {
            if (this.app.vizSettings.cameraControlMode === 'freelook' && this._isMouseDragging) {
                this.app.UIManager.updateFreeLookSlidersFromCamera();
            }
        });
    },

    returnToHome(duration = 2.0) {
        const mrt = this._masterReturnTransition;
        mrt.active = true;
        mrt.progress = 0;
        mrt.duration = duration;
        mrt.startPos.copy(this.app.camera.position);
        mrt.startLookAt.copy(this._controls.target);
        mrt.endPos.copy(this._getHomePos());
        mrt.endLookAt.copy(this._getHomeLookAt());
    },

    startManualReturn() {
        const S = this.app.vizSettings;
        const mrt = this._manualReturnTransition;
        mrt.active = true;
        mrt.progress = 0;
        mrt.startPos.copy(this.app.camera.position);
        mrt.startLookAt.copy(this._controls.target);
        mrt.endPos.set(0, parseFloat(S.cameraHeight), parseFloat(S.cameraDistance));
        mrt.endLookAt.set(0, parseFloat(S.cameraLookAtY), 0);
    },

    setMode(mode) {
        this._state = mode;
        this._controls.enabled = (mode === 'freelook' || mode === 'manual');
        this._manualReturnTransition.active = false;
        
        if (mode === 'autopilot') {
            this._prepareTransition(this.app.camera.position, this._controls.target, this._getHomePos(), this._getHomeLookAt(), 1.0);
        } else if (mode === 'manual') {
            this.startManualReturn();
        } else if (mode === 'freelook') {
            this.app.UIManager.updateFreeLookSlidersFromCamera();
        }
    },

    setAutopilotMode(newMode) {
        this.app.vizSettings.autopilotMode = newMode;
        if (this._state !== 'autopilot' || this._transition.active) return;
        let leash = 40, nextWaypoint;
        switch (newMode) {
            case 'stage':
                this._state = 'idling_stage';
                if (!this._autopilotTargetPos.equals(this._getHomePos()) || !this._autopilotTargetLookAt.equals(this._getHomeLookAt())) {
                    this._prepareTransition(this._autopilotTargetPos, this._autopilotTargetLookAt, this._getHomePos(), this._getHomeLookAt(), 0.5);
                }
                break;
            case 'waypoint':
                nextWaypoint = this._getRandomWaypoint();
                break;
            case 'random1':
                leash = 40;
                nextWaypoint = this._getRandomWaypoint(leash);
                break;
            case 'random2':
            case 'birdseye': // Bird's Eye uses the same random waypoint logic to start
                leash = 80;
                nextWaypoint = this._getRandomWaypoint(leash);
                break;
        }
        if (nextWaypoint) {
            this._prepareTransition(this._autopilotTargetPos, this._autopilotTargetLookAt, nextWaypoint.pos, nextWaypoint.lookAt);
        }
    },

    _prepareTransition(startPos, startLookAt, endPos, endLookAt, duration = 25.0) {
        const T = this._transition;
        const currentSpeed = this.app.vizSettings.autopilotSpeeds[this.app.vizSettings.autopilotMode] || 0.2;
        T.active = true;
        T.startPos.copy(startPos);
        T.startLookAt.copy(startLookAt);
        T.endPos.copy(endPos);
        T.endLookAt.copy(endLookAt);
        T.duration = Math.max(0.1, duration * (1.1 - currentSpeed));
        T.progress = 0;
    },

    _getHomePos() { 
        return new this.app.THREE.Vector3(0, 0, this.app.defaultVisualizerSettings.cameraDistance);
    },
    
    _getHomeLookAt() {
        return new this.app.THREE.Vector3(0, 0, 0);
    },

    _getRandomWaypoint(leash = 40) {
        const posLeash = leash, lookAtLeash = leash / 4;
        const baseZDistance = parseFloat(this.app.defaultVisualizerSettings.cameraDistance);
        return {
            pos: new this.app.THREE.Vector3((Math.random() - 0.5) * posLeash, (Math.random() - 0.5) * (posLeash / 2), baseZDistance + (Math.random() - 0.5) * (leash / 3)),
            lookAt: new this.app.THREE.Vector3((Math.random() - 0.5) * lookAtLeash, (Math.random() - 0.5) * lookAtLeash, 0),
        };
    },

    update(delta) {
        const S = this.app.vizSettings;
        const camera = this.app.camera;
        const THREE = this.app.THREE;

        // --- MASTER TRANSITION OVERRIDE ---
        const masterReturn = this._masterReturnTransition;
        if (masterReturn.active) {
            masterReturn.progress = Math.min(1.0, masterReturn.progress + delta / masterReturn.duration);
            const easeProgress = 0.5 - 0.5 * Math.cos(masterReturn.progress * Math.PI);
            
            camera.position.lerpVectors(masterReturn.startPos, masterReturn.endPos, easeProgress);
            this._controls.target.lerpVectors(masterReturn.startLookAt, masterReturn.endLookAt, easeProgress);

            if (masterReturn.progress >= 1.0) {
                masterReturn.active = false;
            }
            this._controls.update();
            camera.updateProjectionMatrix(); // Also update FOV during this transition if needed
            return; // Skip all other camera logic
        }

        // --- Autopilot / Manual Position ---
        if (this._state === 'autopilot') {
            if (this._transition.active) {
                this._transition.progress += delta / this._transition.duration;
                const easeProgress = 0.5 - 0.5 * Math.cos(this._transition.progress * Math.PI);
                this._autopilotTargetPos.lerpVectors(this._transition.startPos, this._transition.endPos, easeProgress);
                this._autopilotTargetLookAt.lerpVectors(this._transition.startLookAt, this._transition.endLookAt, easeProgress);
                if (this._transition.progress >= 1) {
                    this._autopilotTargetPos.copy(this._transition.endPos);
                    this._autopilotTargetLookAt.copy(this._transition.endLookAt);
                    this._transition.active = false;
                    this._hold.timer = Math.random() * 2.0 + 1.0;
                }
            } else if (this._hold.timer > 0) {
                 this._hold.timer -= delta;
            } else {
                const mode = S.autopilotMode;
                if (mode === 'waypoint') {
                     const nextWaypoint = this._getRandomWaypoint();
                     this._prepareTransition(this._autopilotTargetPos, this._autopilotTargetLookAt, nextWaypoint.pos, nextWaypoint.lookAt);
                } else if (mode.startsWith('random')) {
                    this.setAutopilotMode(mode);
                } else if (mode === 'birdseye') {
                    // For every 5 seconds of movement, spend 1 second (20%) orbiting
                    if (this.app.currentTime % 5 < 1) {
                        // Orbit
                        const orbitSpeed = S.autopilotSpeeds.birdseye * 0.5;
                        const orbitRadius = 25;
                        this._autopilotTargetPos.set(
                            Math.cos(this.app.currentTime * orbitSpeed) * orbitRadius,
                            15, // High vantage point
                            Math.sin(this.app.currentTime * orbitSpeed) * orbitRadius
                        );
                        this._autopilotTargetLookAt.set(0, 5, 0); // Look down towards the center
                    } else {
                        // Move to a new random point
                        this.setAutopilotMode('birdseye');
                    }
                }
                else { // stage mode
                    const homePos = this._getHomePos();
                    const speedFactor = S.autopilotSpeeds.stage || 1.0;
                    this._autopilotTargetPos.set(homePos.x + Math.sin(this.app.currentTime * speedFactor * 0.4) * 5, homePos.y + Math.cos(this.app.currentTime * speedFactor * 0.3) * 3, homePos.z);
                    this._autopilotTargetLookAt.copy(this._getHomeLookAt());
                }
            }
            if (!this._isMouseDragging) {
                camera.position.lerp(this._autopilotTargetPos, delta * 2.0);
                this._controls.target.lerp(this._autopilotTargetLookAt, delta * 2.0);
            }
             this.app.UIManager.updateAutopilotSliders();
        } else if (this._state === 'manual') {
            const mrt = this._manualReturnTransition;
            if (mrt.active) {
                mrt.progress = Math.min(1.0, mrt.progress + delta / mrt.duration);
                const easeProgress = 0.5 - 0.5 * Math.cos(mrt.progress * Math.PI);
                camera.position.lerpVectors(mrt.startPos, mrt.endPos, easeProgress);
                this._controls.target.lerpVectors(mrt.startLookAt, mrt.endLookAt, easeProgress);
                if (mrt.progress >= 1.0) {
                    mrt.active = false;
                }
            } else if (!this._isMouseDragging) {
                // *** CHANGE HERE ***
                // Only set camera position from sliders if the target is NOT the model.
                // If the target IS the model, the main app loop handles aiming the camera.
                if (S.cameraTarget !== 'model') {
                    camera.position.set(0, parseFloat(S.cameraHeight), parseFloat(S.cameraDistance));
                    this._controls.target.set(0, parseFloat(S.cameraLookAtY), 0);
                }
            }
        }
        
        this._controls.update();

        // --- FOV LOGIC ---
        const fovT = this._fovTransition;
        let targetFov = parseFloat(S.cameraFOV);

        // Bird's Eye FOV override
        if (S.cameraControlMode === 'autopilot' && S.autopilotMode === 'birdseye') {
            const camHeight = camera.position.y;
            // Map height (e.g., 0 to 20) to FOV (e.g., 75 down to 20)
            const minHeight = 5;
            const maxHeight = 20;
            const minFov = 20;
            const maxFov = 75;
            if (camHeight > minHeight) {
                const normalizedHeight = Math.min(1, (camHeight - minHeight) / (maxHeight - minHeight));
                targetFov = THREE.MathUtils.lerp(maxFov, minFov, normalizedHeight);
            }
        }

        if (S.enableFovPlus) targetFov += 15;
        if (S.enableFovMinus) targetFov -= 15;
        targetFov = Math.max(10, Math.min(150, targetFov));

        if (fovT.end !== targetFov) {
            fovT.start = camera.fov;
            fovT.end = targetFov;
            fovT.progress = 0;
            fovT.active = true;
        }
        
        if (fovT.active) {
            fovT.progress = Math.min(1.0, fovT.progress + delta / fovT.duration);
            const easeProgress = 0.5 - 0.5 * Math.cos(fovT.progress * Math.PI);
            camera.fov = THREE.MathUtils.lerp(fovT.start, fovT.end, easeProgress);
            
            if (fovT.progress >= 1.0) {
                camera.fov = fovT.end;
                fovT.active = false;
            }
        }

        if (S.enableCameraPulse) {
            camera.fov += (this.app.AudioProcessor.beat * S.cameraPulseStrength);
        }
        camera.fov = Math.max(10, Math.min(150, camera.fov));
        camera.updateProjectionMatrix();
    }
};