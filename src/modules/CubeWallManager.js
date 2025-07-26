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
        pivot: null,
        axis: null,
        angle: 0
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
        this.animationState.pivot = new THREE.Object3D();

        this.app.scene.add(this.animationState.pivot); 

        console.log("CubeWallManager initialized.");
    },

    _createPlayerCube() {
        if (this.playerCube) {
            this.playerCube.geometry.dispose();
            this.playerCube.material.dispose();
            this.app.scene.remove(this.playerCube);
        }
        const cubeSize = this._getCubeSize() * 0.9;
        const playerGeometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
        const playerMaterial = new THREE.MeshPhongMaterial({ color: 0xe2e8f0, emissive: 0x1a202c });
        this.playerCube = new THREE.Mesh(playerGeometry, playerMaterial);
        this.app.scene.add(this.playerCube);
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

        const initialPlayerPos = this.app.ImagePlaneManager.getCubeWorldPosition(this.playerGridPos.x, this.playerGridPos.y);
        
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
                this.resetPlayerState();
                this.moveTimeoutId = setTimeout(() => this.startNextMove(), 1000);
                return;
            }
        }

        this.currentDirection = nextMove;
        
        const state = this.animationState;
        const cubeSize = this._getCubeSize() * 0.9;
        state.isMoving = true;
        state.startTime = performance.now();
        state.startPosition.copy(this.playerCube.position);
        
        this.playerGridPos.x += nextMove.dx;
        this.playerGridPos.y += nextMove.dy;

        const targetPos = this.app.ImagePlaneManager.getCubeWorldPosition(this.playerGridPos.x, this.playerGridPos.y);
        state.targetPosition.copy(targetPos);
        state.targetPosition.z += cubeSize / 2;

        const CUBE_UNIT_SIZE = this._getCubeSize();
        state.axis = new THREE.Vector3(-nextMove.dy, nextMove.dx, 0);
        state.angle = Math.PI / 2;
        
        const pivotPoint = new THREE.Vector3(
            (nextMove.dx * CUBE_UNIT_SIZE) / 2,
            (nextMove.dy * CUBE_UNIT_SIZE) / 2,
            -cubeSize / 2
        );
        
        state.pivot.position.copy(this.playerCube.position);
        state.pivot.quaternion.copy(this.playerCube.quaternion);
        state.pivot.translateX(pivotPoint.x);
        state.pivot.translateY(pivotPoint.y);
        state.pivot.translateZ(pivotPoint.z);
        
        this.app.scene.attach(state.pivot);
        state.pivot.attach(this.playerCube);
    },

    update() {
        if (!this.playerCube || !this.playerCube.visible || !this.app.ImagePlaneManager) return;

        const state = this.animationState;
        
        if (state.isMoving) {
            const progress = Math.min(1, (performance.now() - state.startTime) / this.PLAYER_MOVE_DURATION);
            const easedProgress = 1.0 - Math.pow(1.0 - progress, 3);

            const cubeSize = this._getCubeSize() * 0.9;
            const startGridPos = this.app.ImagePlaneManager.getCubeWorldPosition(this.playerGridPos.x - this.currentDirection.dx, this.playerGridPos.y - this.currentDirection.dy);
            
            if (startGridPos) {
                 const lift = this.PLAYER_ROLL_LIFT_AMOUNT * this._getCubeSize() * Math.sin(progress * Math.PI);
                 
                 const liftVector = new THREE.Vector3(0, 0, lift);
                 liftVector.applyQuaternion(this.app.ImagePlaneManager.landscapeContainer.quaternion);
                 
                 const startPosWithOffset = startGridPos.clone();
                 const localZOffset = new THREE.Vector3(0, 0, cubeSize / 2);
                 localZOffset.applyQuaternion(this.app.ImagePlaneManager.landscapeContainer.quaternion);
                 startPosWithOffset.add(localZOffset);

                 state.pivot.position.copy(startPosWithOffset).add(liftVector);
            }
            
            state.pivot.quaternion.setFromAxisAngle(state.axis, state.angle * easedProgress);

            if (progress >= 1) {
                state.isMoving = false;
                
                this.app.scene.attach(this.playerCube);
                state.pivot.rotation.set(0, 0, 0);
                state.pivot.position.set(0, 0, 0);

                const finalRotation = new THREE.Quaternion().setFromAxisAngle(state.axis, state.angle);
                this.playerCube.quaternion.premultiply(finalRotation).normalize();
                this.playerCube.position.copy(state.targetPosition);

                const pauseDuration = Math.random() < 0.15 ? 500 : 200;
                this.moveTimeoutId = setTimeout(() => this.startNextMove(), pauseDuration);
            }
        } else {
            const currentLandscapePos = this.app.ImagePlaneManager.getCubeWorldPosition(this.playerGridPos.x, this.playerGridPos.y);
            if (currentLandscapePos) {
                const cubeSize = this._getCubeSize() * 0.9;
                
                const localZOffset = new THREE.Vector3(0, 0, cubeSize / 2);
                localZOffset.applyQuaternion(this.app.ImagePlaneManager.landscapeContainer.quaternion);
                
                this.playerCube.position.copy(currentLandscapePos).add(localZOffset);
            }
        }
    }
};