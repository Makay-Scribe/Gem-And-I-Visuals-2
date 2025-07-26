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
        
        const playerMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xe2e8f0,
            metalness: this.app.vizSettings.metalness,
            roughness: this.app.vizSettings.roughness,
        });

        playerMaterial.onBeforeCompile = (shader) => {
            shader.uniforms.u_gpgpu_enableCubeWall = { value: this.app.vizSettings.gpgpu_enableCubeWall };
            shader.uniforms.u_gpgpu_cubeWallBevelWidth = { value: this.app.vizSettings.gpgpu_cubeWallBevelWidth };
            shader.uniforms.u_gpgpu_cubeWallBevelIntensity = { value: this.app.vizSettings.gpgpu_cubeWallBevelIntensity };

            shader.vertexShader = 'varying vec2 vUv;\n' + shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                '#include <begin_vertex>\n\tvUv = uv;'
            );

            shader.fragmentShader = `
                uniform bool u_gpgpu_enableCubeWall;
                uniform float u_gpgpu_cubeWallBevelWidth;
                uniform float u_gpgpu_cubeWallBevelIntensity;
                varying vec2 vUv; 

                vec3 getBeveledNormal(vec3 originalNormal, vec2 faceUV, float bevelWidth, float bevelIntensity) {
                    if (bevelWidth <= 0.0 || bevelIntensity <= 0.0) {
                        return originalNormal;
                    }
                    vec2 dist_to_center = abs(faceUV - 0.5);
                    float dist_to_edge = 0.5 - max(dist_to_center.x, dist_to_center.y);
                    float bevel_factor = smoothstep(0.0, bevelWidth, dist_to_edge);
                    if (bevel_factor >= 1.0) {
                        return originalNormal;
                    }
                    vec2 edge_dir = step(dist_to_center.y, dist_to_center.x) * vec2(1.0, 0.0) + (1.0 - step(dist_to_center.y, dist_to_center.x)) * vec2(0.0, 1.0);
                    edge_dir *= sign(faceUV - 0.5);
                    
                    vec3 tangent = (abs(originalNormal.z) > 0.9) ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 0.0, 1.0);
                    if (abs(originalNormal.y) > 0.9) tangent = vec3(1.0, 0.0, 0.0);
                    vec3 bitangent = cross(originalNormal, tangent);
                    vec3 bevel_normal_local = normalize(originalNormal + (tangent * edge_dir.x + bitangent * edge_dir.y) * bevelIntensity);
                    return normalize(mix(bevel_normal_local, originalNormal, bevel_factor));
                }
            ` + shader.fragmentShader;

            const normalCalculationHook = '#include <normal_fragment_maps>';
            
            const bevelLogic = `
                if (u_gpgpu_enableCubeWall) {
                    normal = getBeveledNormal(normal, vUv, u_gpgpu_cubeWallBevelWidth, u_gpgpu_cubeWallBevelIntensity);
                }
            `;
            shader.fragmentShader = shader.fragmentShader.replace(normalCalculationHook, normalCalculationHook + '\n' + bevelLogic);

            playerMaterial.userData.shader = shader;
        };


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
            const landscapeCubeSize = this._getCubeSize();
            const playerCubeSize = landscapeCubeSize * 0.9;
            const zOffset = (landscapeCubeSize / 2) + (playerCubeSize / 2);

            this.playerCube.position.copy(initialPlayerPos);
            this.playerCube.position.z += zOffset;
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
        const landscapeCubeSize = this._getCubeSize();
        const playerCubeSize = landscapeCubeSize * 0.9;
        const zOffset = (landscapeCubeSize / 2) + (playerCubeSize / 2);
        
        state.targetPosition.copy(targetPos);
        state.targetPosition.z += zOffset;
        
        const rotationAxis = new THREE.Vector3();
        if (nextMove.dx !== 0) rotationAxis.set(0, nextMove.dx, 0);
        else if (nextMove.dy !== 0) rotationAxis.set(-nextMove.dy, 0, 0);
        
        const rollQuaternion = new THREE.Quaternion().setFromAxisAngle(rotationAxis.normalize(), Math.PI / 2);
        
        state.targetQuaternion.copy(rollQuaternion).multiply(state.startQuaternion);
    },

    update() {
        const S = this.app.vizSettings;
        if (!this.playerCube || !this.playerCube.visible || !S.gpgpu_enableCubeWall) return;

        this.playerCube.material.roughness = S.roughness;
        this.playerCube.material.metalness = S.metalness;
        // ** THE FIX IS HERE: Sync the reflection strength **
        this.playerCube.material.envMapIntensity = S.reflectionStrength;

        if (this.playerCube.material.userData.shader) {
            const shaderUniforms = this.playerCube.material.userData.shader.uniforms;
            shaderUniforms.u_gpgpu_enableCubeWall.value = S.gpgpu_enableCubeWall;
            shaderUniforms.u_gpgpu_cubeWallBevelWidth.value = S.gpgpu_cubeWallBevelWidth;
            shaderUniforms.u_gpgpu_cubeWallBevelIntensity.value = S.gpgpu_cubeWallBevelIntensity;
        }

        const state = this.animationState;
        
        const isSliderActive = false; // TODO: Replace with actual check

        if (state.isMoving && !isSliderActive) {
            const progress = Math.min(1, (performance.now() - state.startTime) / this.PLAYER_MOVE_DURATION);
            
            const landscapeCubeSize = this._getCubeSize();
            const zOffset = (landscapeCubeSize / 2) + ((landscapeCubeSize * 0.9) / 2);

            const targetLandscapeZ = this.app.ImagePlaneManager.getCubeLocalPosition(this.playerGridPos.x, this.playerGridPos.y).z;
            state.targetPosition.z = targetLandscapeZ + zOffset;

            const tempPosition = new THREE.Vector3().lerpVectors(state.startPosition, state.targetPosition, progress);
            
            tempPosition.z += this.PLAYER_ROLL_LIFT_AMOUNT * landscapeCubeSize * Math.sin(progress * Math.PI);
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
                const landscapeCubeSize = this._getCubeSize();
                const zOffset = (landscapeCubeSize / 2) + ((landscapeCubeSize * 0.9) / 2);
                 
                const currentLandscapeZ = this.app.ImagePlaneManager.getCubeLocalPosition(this.playerGridPos.x, this.playerGridPos.y).z;
                this.playerCube.position.z = currentLandscapeZ + zOffset;
            }
        }
    }
};