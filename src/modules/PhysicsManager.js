import THREE from '../three-singleton.js';
import * as CANNON from 'cannon-es';

export const PhysicsManager = {
    app: null,
    world: null,
    groundBody: null,
    physicsMeshes: [], // Array to store { mesh: THREE.Mesh, body: CANNON.Body } objects

    // Physics materials (for defining interaction properties)
    groundMaterial: null,
    cubeMaterial: null,

    // NEW: Properties for Heightfield
    heightfieldData: null,
    heightfieldElementSize: 1.0, // Calculated from plane dimensions and resolution

    init(appInstance) {
        this.app = appInstance;
        console.log("PhysicsManager: Initializing physics world.");

        // 1. Create a new Cannon.js world
        this.world = new CANNON.World();
        // Set up gravity based on vizSettings
        this.world.gravity.set(0, this.app.vizSettings.physicsGravityY, 0); 

        // 2. Define physics materials
        this.groundMaterial = new CANNON.Material('groundMaterial');
        this.cubeMaterial = new CANNON.Material('cubeMaterial');

        // Define a contact material for how cubes interact with the ground
        const cubeGroundContactMaterial = new CANNON.ContactMaterial(
            this.groundMaterial,
            this.cubeMaterial,
            {
                friction: this.app.vizSettings.physicsCubeFriction,    // Friction between cubes and ground
                restitution: this.app.vizSettings.physicsCubeBounciness, // Bounciness
                contactEquationStiffness: 1e8,
                contactEquationRelaxation: 3,
                frictionEquationStiffness: 1e8,
                frictionEquationRelaxation: 3
            }
        );
        this.world.addContactMaterial(cubeGroundContactMaterial);

        // Add event listener for spawning cubes
        const spawnButton = document.getElementById('spawnPhysicsCubesButton');
        if (spawnButton) {
            spawnButton.addEventListener('click', () => this.spawnCubes());
        }

        // Add event listener for clearing cubes
        const clearButton = document.getElementById('clearPhysicsCubesButton');
        if (clearButton) {
            clearButton.addEventListener('click', () => this.clearCubes());
        }

        console.log("PhysicsManager: Physics world initialized (awaiting ground/cubes from main.js).");
    },

    // NEW: Function to read the GPGPU terrain heights from the position texture
    readGPGPUTerrainHeights() {
        const C = this.app.ComputeManager;
        if (!C || !C.gpuCompute || !C.positionVariable) {
            console.warn("ComputeManager or GPGPU compute variable not available for terrain height read.");
            return null;
        }

        const positionRenderTarget = C.gpuCompute.getCurrentRenderTarget(C.positionVariable);
        if (!positionRenderTarget) {
            console.warn("GPGPU position render target not available.");
            return null;
        }

        const width = C.WIDTH;
        const height = C.HEIGHT;
        const area = C.AREA;
        
        // Ensure the read buffer is correctly sized for RGBA Float data
        const readBuffer = new Float32Array(area * 4); 

        // Perform GPU readback
        try {
            this.app.renderer.readRenderTargetPixels(
                positionRenderTarget,
                0, 0, // x, y (top-left corner)
                width, height, // width, height of the texture
                readBuffer
            );
        } catch (e) {
            console.error("Failed to read GPGPU render target pixels:", e);
            return null;
        }

        const S = this.app.vizSettings;
        const planeOrientation = S.planeOrientation;

        // Determine element size based on which dimension of the plane corresponds to the Cannon.js Heightfield's 'width' (X-axis).
        // For 'xz' and 'xy', the visual plane's width (planeDimensions.x) is the Cannon.js Heightfield's width.
        // For 'yz', the visual plane's height (planeDimensions.y) becomes the Cannon.js Heightfield's width.
        let elementSize;
        if (planeOrientation === 'xz' || planeOrientation === 'xy') {
            elementSize = this.app.ImagePlaneManager.planeDimensions.x / (width - 1);
        } else { // 'yz'
            elementSize = this.app.ImagePlaneManager.planeDimensions.y / (width - 1); // Note: 'width' from ComputeManager is the first dimension
        }
        this.heightfieldElementSize = elementSize;

        // Convert 1D RGBA Float32Array into a 2D height array for Cannon.js Heightfield
        // Cannon.js Heightfield expects heights[row][col], where row corresponds to Cannon.js Z and col to Cannon.js X.
        // The value stored is Cannon.js Y (height).
        // `i` in the loop is the row index (visual Y or visual Z depending on orientation)
        // `j` in the loop is the column index (visual X or visual Y depending on orientation)
        const heights = [];
        for (let i = 0; i < height; i++) {
            const row = [];
            for (let j = 0; j < width; j++) {
                const dataIndex = (i * width + j) * 4;
                let heightValue;

                if (planeOrientation === 'xz') {
                    // Visual XZ plane, deformation along visual local Z. Visual local Z is at dataIndex + 2.
                    heightValue = readBuffer[dataIndex + 2]; 
                } else if (planeOrientation === 'xy') {
                    // Visual XY plane, deformation along visual local Z. Visual local Z is at dataIndex + 2.
                    heightValue = readBuffer[dataIndex + 2];
                } else { // 'yz' plane
                    // Visual YZ plane, deformation along visual local X. Visual local X is at dataIndex + 0.
                    heightValue = readBuffer[dataIndex + 0];
                }
                row.push(heightValue);
            }
            heights.push(row);
        }

        this.heightfieldData = heights;
        console.log(`PhysicsManager: Read GPGPU terrain heights (${width}x${height} grid) for ${planeOrientation}. Element size: ${this.heightfieldElementSize.toFixed(2)}`);
        return heights;
    },

    createGroundPlane() {
        if (this.groundBody) {
            this.world.removeBody(this.groundBody);
            this.groundBody = null; // Clear reference
        }

        const S = this.app.vizSettings;
        const landscapeMesh = this.app.ImagePlaneManager.landscape;
        if (!landscapeMesh) {
            console.warn("PhysicsManager: Landscape mesh not found, cannot create ground body.");
            this.createFlatGroundPlane(new THREE.Vector3(), new THREE.Quaternion()); // Fallback if no landscape
            return;
        }

        landscapeMesh.updateWorldMatrix(true, false); 
        const worldPosition = new THREE.Vector3();
        const worldQuaternion = new THREE.Quaternion();
        landscapeMesh.getWorldPosition(worldPosition);
        landscapeMesh.getWorldQuaternion(worldQuaternion);

        // Attempt to read terrain heights. If it fails or no deformation mode, fall back.
        const heights = this.readGPGPUTerrainHeights();
        const gpgpuDeformationActive = (
            S.deformationEngine === 'gpgpu' && (
                S.gpgpu_enableQbert || 
                S.gpgpu_enableTriangleWave || 
                S.gpgpu_enableWaterRipple || 
                S.gpgpu_enableEqRipple || 
                S.gpgpu_enableCloth || 
                S.gpgpu_enableTendrils
            )
        );

        if (!gpgpuDeformationActive || !heights || heights.length === 0 || heights[0].length === 0) {
            console.log("PhysicsManager: Not in GPGPU deformation mode or no height data, creating flat ground plane.");
            this.createFlatGroundPlane(worldPosition, worldQuaternion);
            return;
        }

        const heightfieldShape = new CANNON.Heightfield(heights, {
            elementSize: this.heightfieldElementSize
        });

        // Dimensions of the Heightfield in its local Cannon.js (XZ grid, Y up) space
        const hfLocalWidth = (heights[0].length - 1) * this.heightfieldElementSize;
        const hfLocalDepth = (heights.length - 1) * this.heightfieldElementSize;

        // Cannon.js Heightfield origin is at (0,0,0) which corresponds to the first point of the grid (index [0][0]).
        // We need to offset it by half its local dimensions to center it.
        // This offset is relative to the *Heightfield's local axes*.
        let hfCenteringOffset = new CANNON.Vec3(-hfLocalWidth / 2, 0, -hfLocalDepth / 2);
        
        let initialCannonRotation = new CANNON.Quaternion(); // Base rotation for the Cannon.js Heightfield to align with visual plane's local orientation

        if (S.planeOrientation === 'xz') {
            // Visual XZ plane: (X_visual, Y_deformation, Z_visual) -> Cannon (X, Y_height, Z)
            // Three.js plane default (XY) is rotated -PI/2 around X for 'xz' visual.
            // Cannon.js Heightfield is naturally XZ (Y up). So just make its Y align with world Y.
            // Initial position data has (X, Y, Z_deformation).
            // We want (X_visual, Z_visual) to be the grid, and Y_deformation to be the height.
            // When ImagePlaneManager rotates for 'xz', it maps visual Y to world -Z.
            // And visual Z (deformation) to world Y.
            // So we need Cannon.js's local X to be visual X, local Z to be visual Y, and local Y (height) to be visual Z (deformation).
            // This means we need to rotate Cannon.js heightfield (which is XZ with Y-up) to align with this.
            // Rotate around X by -PI/2. This will map Cannon.Y to old Z, and Cannon.Z to old -Y.
            initialCannonRotation.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);

        } else if (S.planeOrientation === 'xy') {
            // Visual XY plane: (X_visual, Y_visual, Z_deformation) -> Cannon (X, Y_height, Z)
            // Three.js plane is not rotated. So visual local X = world X, visual local Y = world Y, visual local Z = world Z.
            // Cannon.js: X_cannon = visual X, Z_cannon = visual Y, Y_cannon = visual Z (deformation)
            // Rotate Cannon.js heightfield (XZ, Y up) around X by +PI/2.
            // This will make Cannon.Y align with old Z, Cannon.Z align with old -Y.
            // Effectively, Cannon.X is world X, Cannon.Y is world Z, Cannon.Z is world -Y.
            // We want Cannon.X = world X, Cannon.Y = world Y (height), Cannon.Z = world Z.
            // So this specific rotation is to map world coordinates to what Cannon expects *if its height is world Y*.
            // The height (visual Z) is correctly read as Y_height.
            // We need Cannon.js X to be visual X. And Cannon.Z to be visual Y.
            // This means we rotate XZ (Y up) to XY (Z up) and then re-align.
            // Rotate X by PI/2: X(1,0,0) -> X(1,0,0), Y(0,1,0) -> Y(0,0,1), Z(0,0,1) -> Z(0,-1,0).
            // So, Cannon.X=X, Cannon.Y=Z, Cannon.Z=-Y.
            // We want Cannon.X=visual X, Cannon.Y=visual Z, Cannon.Z=visual Y.
            // A rotation of -PI/2 around X makes Cannon Y point to where Z was and Z to where -Y was.
            // Let's use Euler to simplify:
            // This makes the Heightfield's local Y (height) align with world Z, its local X with world X, its local Z with world Y.
            initialCannonRotation.setFromEuler(new CANNON.Euler(-Math.PI / 2, 0, 0, 'XYZ'));

        } else { // 'yz'
            // Visual YZ plane: (X_deformation, Y_visual, Z_visual) -> Cannon (X, Y_height, Z)
            // Three.js plane is rotated Y by PI/2 for 'yz' visual.
            // Visual local X = world Z, Visual local Y = world Y, Visual local Z = world X.
            // Cannon.js: X_cannon = visual Y, Z_cannon = visual Z, Y_cannon = visual X (deformation)
            // Rotate Cannon.js heightfield (XZ, Y up) to align with this mapping.
            // Rotate around Y by -PI/2. This will map Cannon.X to old Z, Cannon.Z to old -X.
            // Then rotate around X by PI/2. This maps Cannon.Y to old -Z, Cannon.Z to old Y.
            // Combined:
            let q1 = new CANNON.Quaternion(); q1.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -Math.PI / 2); // Rotate Y by -90
            let q2 = new CANNON.Quaternion(); q2.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);  // Rotate X by +90
            initialCannonRotation.copy(q1.mult(q2)); // Apply q1 then q2 (q2 * q1)
        }
        
        // Transform the local centering offset by the landscape's world quaternion
        // The hfCenteringOffset is defined in the Cannon.js Heightfield's natural (XZ grid, Y up) local space.
        // This vector needs to be rotated by the target world rotation.
        let rotatedOffset = new CANNON.Vec3();
        new CANNON.Quaternion(worldQuaternion.x, worldQuaternion.y, worldQuaternion.z, worldQuaternion.w)
            .mult(initialCannonRotation) // Combine world rotation with base Cannon rotation
            .vmult(hfCenteringOffset, rotatedOffset);

        // The final position of the ground body is the world position of the Three.js mesh,
        // plus the rotated centering offset.
        let finalGroundPosition = new CANNON.Vec3(
            worldPosition.x + rotatedOffset.x,
            worldPosition.y + rotatedOffset.y,
            worldPosition.z + rotatedOffset.z
        );

        this.groundBody = new CANNON.Body({
            mass: 0, // Static body
            shape: heightfieldShape,
            material: this.groundMaterial,
            position: finalGroundPosition,
            quaternion: new CANNON.Quaternion(worldQuaternion.x, worldQuaternion.y, worldQuaternion.z, worldQuaternion.w)
                         .mult(initialCannonRotation) // Apply combined rotation
        });
        this.world.addBody(this.groundBody);
        console.log(`PhysicsManager: Heightfield ground plane created for ${S.planeOrientation}.`);
    },

    // NEW: Helper function for creating a flat ground plane (used as fallback)
    createFlatGroundPlane(position, quaternion) {
        if (this.groundBody) { // Remove existing if this is a fallback after heightfield attempt
            this.world.removeBody(this.groundBody);
            this.groundBody = null;
        }

        this.groundBody = new CANNON.Body({
            mass: 0,
            shape: new CANNON.Plane(), // Simple infinite plane
            material: this.groundMaterial,
            position: new CANNON.Vec3(position.x, position.y, position.z),
            quaternion: new CANNON.Quaternion(quaternion.x, quaternion.y, quaternion.z, quaternion.w)
        });
        this.world.addBody(this.groundBody);
        console.log("PhysicsManager: Flat ground plane created and added to world.");
    },

    // Spawns a new set of physics cubes
    spawnCubes() {
        this.clearCubes(); // Clear existing cubes first

        const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
        const S = this.app.vizSettings;
        const count = S.physicsCubeCount;
        const size = S.physicsCubeSize;

        const maxSpawnHeight = 20; // Max height above the plane to spawn
        const spawnSpread = this.app.ImagePlaneManager.planeDimensions.x * 0.4; // Spread across the plane

        // Get the current base Y-position of the landscape to spawn cubes above it
        const landscapeBaseY = this.app.ImagePlaneManager.landscapeContainer.position.y;

        for (let i = 0; i < count; i++) {
            // Visual Three.js mesh
            const material = new THREE.MeshStandardMaterial({
                color: new THREE.Color(Math.random(), Math.random(), Math.random()),
                metalness: 0.1,
                roughness: 0.5
            });
            const mesh = new THREE.Mesh(cubeGeometry, material);
            mesh.scale.set(size, size, size);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.app.scene.add(mesh);

            // Cannon.js physics body
            const halfExtents = new CANNON.Vec3(size / 2, size / 2, size / 2);
            const boxShape = new CANNON.Box(halfExtents);
            
            const startX = (Math.random() - 0.5) * spawnSpread;
            const startZ = (Math.random() - 0.5) * spawnSpread;
            const startY = landscapeBaseY + maxSpawnHeight + Math.random() * 5; // Spawn above the landscape

            const body = new CANNON.Body({
                mass: 1, // Give it mass so it's affected by gravity and collisions
                shape: boxShape,
                material: this.cubeMaterial,
                position: new CANNON.Vec3(startX, startY, startZ),
                angularVelocity: new CANNON.Vec3(Math.random() * 5, Math.random() * 5, Math.random() * 5)
            });
            this.world.addBody(body);

            this.physicsMeshes.push({ mesh, body });
        }
        console.log(`PhysicsManager: Spawned ${count} cubes.`);
    },

    // Clears all currently spawned physics cubes
    clearCubes() {
        this.physicsMeshes.forEach(({ mesh, body }) => {
            this.app.scene.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
            this.world.removeBody(body);
        });
        this.physicsMeshes = [];
        console.log("PhysicsManager: Cleared all physics cubes.");
    },

    // Update function called in the main animation loop
    update(delta) {
        if (!this.world || !this.app.vizSettings.enablePhysicsCubes) {
            this.clearCubes(); // Ensure cubes are cleared if effect is disabled
            return;
        }

        // Update gravity if the setting changed
        if (this.world.gravity.y !== this.app.vizSettings.physicsGravityY) {
            this.world.gravity.set(0, this.app.vizSettings.physicsGravityY, 0);
        }

        // Update physics material properties if settings changed
        if (this.world.contactmaterials.length > 0) {
            const contactMaterial = this.world.contactmaterials[0]; // Assuming first contact material is cube-ground
            if (contactMaterial.friction !== this.app.vizSettings.physicsCubeFriction) {
                contactMaterial.friction = this.app.vizSettings.physicsCubeFriction;
            }
            if (contactMaterial.restitution !== this.app.vizSettings.physicsCubeBounciness) {
                contactMaterial.restitution = this.app.vizSettings.physicsCubeBounciness;
            }
        }

        // Step the physics world forward
        // Use a fixed timestep for physics simulation for stability
        const fixedTimeStep = 1 / 60; // 60 updates per second
        const maxSubSteps = 10;      // Max physics iterations per frame
        this.world.step(fixedTimeStep, delta, maxSubSteps);

        // Synchronize Three.js meshes with Cannon.js bodies
        this.physicsMeshes.forEach(({ mesh, body }) => {
            mesh.position.copy(body.position);
            mesh.quaternion.copy(body.quaternion);

            // Handle scaling here to apply the vizSetting.physicsCubeSize to existing cubes
            // Only update if the current scale is different
            if (mesh.scale.x !== this.app.vizSettings.physicsCubeSize) {
                mesh.scale.set(this.app.vizSettings.physicsCubeSize, this.app.vizSettings.physicsCubeSize, this.app.vizSettings.physicsCubeSize);
            }
        });
    }
};