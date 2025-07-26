import THREE from '../three-singleton.js';

export const CubeWallManager = {
    app: null,
    playerCube: null,

    // --- CONFIG ---
    PLAYER_MOVE_DURATION: 350, // ms
    PLAYER_ROLL_LIFT_AMOUNT: 0.25,
    
    // --- STATE ---
    gridSize: 10,
    animationState: {
        isMoving: false,
        startTime: 0,
        startPosition: null, 
        targetPosition: null,
        startQuaternion: null,
        targetQuaternion: null,
    },
    playerGridPos: { x: 0, y: 0 },
    currentDirection: null,
    moveTimeoutId: null,

    _getCubeSize() {
        if (!this.app.ImagePlaneManager) return 1.0;
        const S = this.app.vizSettings;
        return this.app.ImagePlaneManager.planeDimensions.x / S.gpgpu_cubeWallGridSize;
    },

    init(appInstance) {
        this.app = appInstance;
        
        this.animationState.startPosition = new THREE.Vector3();
        this.animationState.targetPosition = new THREE.Vector3();
        this.animationState.startQuaternion = new THREE.Quaternion();
        this.animationState.targetQuaternion = new THREE.Quaternion();

        console.log("CubeWallManager initialized.");
    },

    _createPlayerCube() {
        if (this.playerCube) {
            this.playerCube.geometry.dispose();
            this.playerCube.material.dispose();
            this.playerCube.removeFromParent();
        }
        const cubeSize = this._getCubeSize() * 0.9;
        const playerGeometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
        const playerMaterial = new THREE.MeshPhongMaterial({ color: 0xe2e8f0, emissive: 0x1a202c });
        this.playerCube = new THREE.Mesh(playerGeometry, playerMaterial);
        
        this.app.ImagePlaneManager.landscapeContainer.add(this.playerCube);
    },

    setActive(isActive) {
        if (isActive && !this.playerCube) {
            this._createPlayerCube();
        }

        if (this.playerCube) {
            this.playerCube.visible = isActive;
        }

        if (isActive) {
            this.resetPlayerState();
            if (this.moveTimeoutId) clearTimeout(this.moveTimeoutId);
            this.moveTimeoutId = setTimeout(() => this.startNextMove(), 1500);
        } else {
            if (this.moveTimeoutId) clearTimeout(this.moveTimeoutId);
            this.animationState.isMoving = false;
        }
    },

    resetPlayerState() {
        if (!this.app.ImagePlaneManager || !this.playerCube) return;

        this.gridSize = this.app.vizSettings.gpgpu_cubeWallGridSize;
        this.playerGridPos.x = Math.floor(this.gridSize / 2);
        this.playerGridPos.y = Math.floor(this.gridSize / 2);

        const initialPlayerPos = this.app.ImagePlaneManager.getCubeLocalPosition(this.playerGridPos.x, this.playerGridPos.y);
        
        if (initialPlayerPos) {
            const cubeSize = this._getCubeSize() * 0.9;
            this.playerCube.position.copy(initialPlayerPos);
            this.playerCube.position.z += cubeSize / 2;
            this.playerCube.quaternion.identity();
        }
        
        this.animationState.isMoving = false;
        this.currentDirection = null;
    },

    startNextMove() {
        if (this.animationState.isMoving || !this.playerCube || !this.playerCube.visible) return;

        let nextMove = null;
        if (this.currentDirection && Math.random() > 0.25) {
            const potentialX = this.playerGridPos.x + this.currentDirection.dx;
            const potentialY = this.playerGridPos.y + this.currentDirection.dy;
            if (potentialX >= 0 && potentialX < this.gridSize && potentialY >= 0 && potentialY < this.gridSize) {
                nextMove = this.currentDirection;
            }
        }
        
        if (nextMove === null) {
            const allDirections = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];
            const validMoves = allDirections.filter(dir => {
                const nextX = this.playerGridPos.x + dir.dx;
                const nextY = this.playerGridPos.y + dir.dy;
                if (nextX < 0 || nextX >= this.gridSize || nextY < 0 || nextY >= this.gridSize) return false;
                if (this.currentDirection && dir.dx === -this.currentDirection.dx && dir.dy === -this.currentDirection.dy) return false;
                return true;
            });

            if (validMoves.length > 0) {
                nextMove = validMoves[Math.floor(Math.random() * validMoves.length)];
            } else {
                this.resetPlayerState(); // Stuck, so reset
                this.moveTimeoutId = setTimeout(() => this.startNextMove(), 1000);
                return;
            }
        }

        this.currentDirection = nextMove;
        
        const state = this.animationState;
        
        state.isMoving = true;
        state.startTime = performance.now();
        state.startPosition.copy(this.playerCube.position);
        state.startQuaternion.copy(this.playerCube.quaternion);

        this.playerGridPos.x += nextMove.dx;
        this.playerGridPos.y += nextMove.dy;

        const targetPos = this.app.ImagePlaneManager.getCubeLocalPosition(this.playerGridPos.x, this.playerGridPos.y);
        const cubeSize = this._getCubeSize() * 0.9;
        state.targetPosition.copy(targetPos);
        state.targetPosition.z += cubeSize / 2;
        
        const rotationAxis = new THREE.Vector3();
        if (nextMove.dx !== 0) rotationAxis.set(0, nextMove.dx, 0);
        else if (nextMove.dy !== 0) rotationAxis.set(-nextMove.dy, 0, 0);
        
        // ** THE FIX IS HERE: The angle is now positive to ensure a forward roll. **
        const rollQuaternion = new THREE.Quaternion().setFromAxisAngle(rotationAxis.normalize(), Math.PI / 2);
        
        state.targetQuaternion.copy(rollQuaternion).multiply(state.startQuaternion);
    },

    update() {
        const S = this.app.vizSettings;
        if (!this.playerCube || !this.playerCube.visible || !S.gpgpu_enableCubeWall) return;

        const state = this.animationState;
        
        // This is a placeholder for checking if the slider is active. The actual implementation
        // will depend on how you track UI interaction state globally. For now, we'll assume a flag exists.
        const isSliderActive = false; // TODO: Replace with actual check, e.g., this.app.UIManager.isMorphSliderActive

        if (state.isMoving && !isSliderActive) {
            const progress = Math.min(1, (performance.now() - state.startTime) / this.PLAYER_MOVE_DURATION);
            
            const cubeSize = this._getCubeSize() * 0.9;
            const targetLandscapeZ = this.app.ImagePlaneManager.getCubeLocalPosition(this.playerGridPos.x, this.playerGridPos.y).z;
            state.targetPosition.z = targetLandscapeZ + cubeSize / 2;

            const tempPosition = new THREE.Vector3().lerpVectors(state.startPosition, state.targetPosition, progress);
            
            tempPosition.z += this.PLAYER_ROLL_LIFT_AMOUNT * this._getCubeSize() * Math.sin(progress * Math.PI);
            this.playerCube.position.copy(tempPosition);
            
            this.playerCube.quaternion.slerpQuaternions(state.startQuaternion, state.targetQuaternion, progress);

            if (progress >= 1) {
                state.isMoving = false;
                this.playerCube.position.copy(state.targetPosition);
                this.playerCube.quaternion.copy(state.targetQuaternion);

                const pauseDuration = Math.random() < 0.15 ? 500 : 200;
                this.moveTimeoutId = setTimeout(() => this.startNextMove(), pauseDuration);
            }
        } else {
            if (this.playerCube && !state.isMoving) {
                 const currentLandscapeZ = this.app.ImagePlaneManager.getCubeLocalPosition(this.playerGridPos.x, this.playerGridPos.y).z;
                 const cubeSize = this._getCubeSize() * 0.9;
                 this.playerCube.position.z = currentLandscapeZ + cubeSize / 2;
            }
        }
    }
};