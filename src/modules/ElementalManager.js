import THREE from '../three-singleton.js';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';
import positionShader from '../compute/shaders/elemental_position.glsl?raw';

export const ElementalManager = {
    app: null,
    
    // Physics
    gpuCompute: null,
    posVar: null,
    
    // Visualizers
    meshes: {
        earth: null,
        water: null,
        wind: null,
        fire: null
    },
    
    activeMode: 'water', 
    WIDTH: 128,
    
    // Track current dimensions
    _currentPlaneWidth: 40,
    _currentPlaneHeight: 40,
    
    init(appInstance) {
        this.app = appInstance;
        this.WIDTH = this.app.vizSettings.particle_resolution || 128; 
        
        this.initPhysics();
        this.initVisualizers();
        
        console.log("ElementalManager initialized.");
    },

    _fillInitialPositions(texture) {
        const posArray = texture.image.data;
        const planeDims = this.app.ImagePlaneManager.planeDimensions;
        const halfWidth = planeDims.x / 2;
        const halfHeight = planeDims.y / 2;
        const res = this.WIDTH;

        for (let i = 0; i < res * res; i++) {
            const k = i * 4;
            const u = (i % res) / (res - 1);
            const v = Math.floor(i / res) / (res - 1);

            posArray[k + 0] = u * planeDims.x - halfWidth;
            posArray[k + 1] = v * planeDims.y - halfHeight;
            posArray[k + 2] = 0.0;
            posArray[k + 3] = 1.0;
        }
    },

    initPhysics() {
        const renderer = this.app.renderer;
        const CM = this.app.ComputeManager;
        this.gpuCompute = new GPUComputationRenderer(this.WIDTH, this.WIDTH, renderer);
        
        if (renderer.capabilities.isWebGL2 === false) {
            this.gpuCompute.setDataType(THREE.HalfFloatType);
        }

        const dtPosition = this.gpuCompute.createTexture();
        this._fillInitialPositions(dtPosition);

        this.posVar = this.gpuCompute.addVariable('texturePosition', positionShader, dtPosition);
        this.gpuCompute.setVariableDependencies(this.posVar, [this.posVar]);

        const uniforms = this.posVar.material.uniforms;
        uniforms.uTime = { value: 0.0 };
        uniforms.uDelta = { value: 0.0 };
        uniforms.uMorph = { value: 0.0 };
        uniforms.uTurbulence = { value: 0.5 };
        uniforms.uFrequency = { value: 0.1 };
        uniforms.uSpeed = { value: 0.5 };
        
        uniforms.u_canvasPosTex = { value: CM.particleFlatPositionTexture };
        uniforms.u_modelPosTex = { value: CM.particleModelPositionTexture };

        const error = this.gpuCompute.init();
        if (error !== null) {
            console.error("Elemental GPGPU Error:", error);
        }
    },

    initVisualizers() {
        // Clean up existing
        Object.values(this.meshes).forEach(mesh => {
            if (mesh) {
                mesh.geometry.dispose();
                if (mesh.material.dispose) mesh.material.dispose();
                if (this.app.ImagePlaneManager.landscapeContainer) {
                    this.app.ImagePlaneManager.landscapeContainer.remove(mesh);
                }
            }
        });

        const count = this.WIDTH * this.WIDTH;
        const container = this.app.ImagePlaneManager.landscapeContainer;
        
        const planeDims = this.app.ImagePlaneManager.planeDimensions;
        this._currentPlaneWidth = planeDims.x;
        this._currentPlaneHeight = planeDims.y;

        const refUvs = new Float32Array(count * 2);
        for (let i = 0; i < count; i++) {
            refUvs[i * 2] = (i % this.WIDTH) / this.WIDTH;
            refUvs[i * 2 + 1] = Math.floor(i / this.WIDTH) / this.WIDTH;
        }
        const refUvAttr = new THREE.InstancedBufferAttribute(refUvs, 2);

        const currentMap = this.app.ImagePlaneManager.currentTexture || null;

        // -------------------------
        // 1. EARTH (Tetrahedrons)
        // -------------------------
        const earthGeo = new THREE.TetrahedronGeometry(0.4, 0); 
        const earthMat = new THREE.MeshStandardMaterial({ 
            color: 0xffffff, 
            map: currentMap,
            roughness: 0.9, 
            metalness: 0.0, 
            flatShading: false 
        });
        const earthMesh = new THREE.InstancedMesh(earthGeo, earthMat, count);
        
        earthMat.onBeforeCompile = (shader) => {
            shader.uniforms.uPosTex = { value: null };
            shader.vertexShader = `
                uniform sampler2D uPosTex;
                attribute vec2 refUv;
                varying vec2 vRefUv;
            ` + shader.vertexShader;
            
            shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
                vec3 transformed = vec3( position );
                vec4 posData = texture2D(uPosTex, refUv);
                vec3 newPos = posData.xyz;
                float rotX = newPos.z * 1.0; 
                float rotY = newPos.x * 1.0;
                float c = cos(rotX); float s = sin(rotX);
                mat3 rx = mat3(1,0,0, 0,c,-s, 0,s,c);
                c = cos(rotY); s = sin(rotY);
                mat3 ry = mat3(c,0,s, 0,1,0, -s,0,c);
                transformed = ry * rx * transformed;
                transformed += newPos;
                vRefUv = vec2(refUv.x, 1.0 - refUv.y); 
            `);
            shader.fragmentShader = `varying vec2 vRefUv;` + shader.fragmentShader;
            shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
                #ifdef USE_MAP
                    vec4 texelColor = texture2D( map, vRefUv );
                    texelColor = mapTexelToLinear( texelColor );
                    diffuseColor *= texelColor;
                #endif
            `);
            earthMesh.userData.shader = shader;
        };
        earthMesh.geometry.setAttribute('refUv', refUvAttr);
        earthMesh.visible = (this.activeMode === 'earth');
        container.add(earthMesh);
        this.meshes.earth = earthMesh;


        // -------------------------
        // 2. WATER (Displaced Plane)
        // -------------------------
        const waterGeo = new THREE.PlaneGeometry(planeDims.x, planeDims.y, this.WIDTH - 1, this.WIDTH - 1);
        const waterMat = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            map: currentMap,
            roughness: 0.2,
            metalness: 0.1,
            transmission: 0.2,
            thickness: 1.0,
            side: THREE.DoubleSide,
            wireframe: false
        });
        const waterMesh = new THREE.Mesh(waterGeo, waterMat);

        waterMat.onBeforeCompile = (shader) => {
            shader.uniforms.uPosTex = { value: null };
            shader.uniforms.uTexelSize = { value: new THREE.Vector2(1/this.WIDTH, 1/this.WIDTH) };
            
            shader.vertexShader = `
                uniform sampler2D uPosTex;
                uniform vec2 uTexelSize;
            ` + shader.vertexShader;

            shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', `
                #include <uv_vertex>
                #ifdef USE_MAP
                    vMapUv = vec2(vMapUv.x, 1.0 - vMapUv.y);
                #endif
            `);

            shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
                #include <begin_vertex>

                // 1. Update Position from GPGPU
                transformed = texture2D(uPosTex, uv).xyz;

                // 2. Recalculate Normal
                vec3 pos = transformed;
                vec3 posRight = texture2D(uPosTex, uv + vec2(uTexelSize.x, 0.0)).xyz;
                vec3 posUp    = texture2D(uPosTex, uv + vec2(0.0, uTexelSize.y)).xyz;
                
                vec3 tX = posRight - pos;
                vec3 tY = posUp - pos;
                
                vec3 newNormal = normalize(cross(tY, tX));
                transformedNormal = normalMatrix * newNormal;

                #ifdef FLIP_SIDED
                    transformedNormal = - transformedNormal;
                #endif
            `);
            
            waterMesh.userData.shader = shader;
        };
        waterMesh.visible = (this.activeMode === 'water');
        container.add(waterMesh);
        this.meshes.water = waterMesh;


        // -------------------------
        // 3. WIND (Lines)
        // -------------------------
        const windGeo = new THREE.BoxGeometry(0.05, 0.05, 1.0);
        const windMat = new THREE.MeshBasicMaterial({
            color: 0xffffff, 
            map: currentMap,
            transparent: true, 
            opacity: 0.5, 
            blending: THREE.AdditiveBlending
        });
        const windMesh = new THREE.InstancedMesh(windGeo, windMat, count);
        windMat.onBeforeCompile = (shader) => {
            shader.uniforms.uPosTex = { value: null };
            shader.vertexShader = `
                uniform sampler2D uPosTex;
                attribute vec2 refUv;
                varying vec2 vRefUv;
            ` + shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
                vec3 transformed = vec3( position );
                vec3 pos = texture2D(uPosTex, refUv).xyz;
                float stretch = 1.0 + (pos.z * 0.5); 
                transformed.z *= stretch;
                transformed += pos;
                vRefUv = vec2(refUv.x, 1.0 - refUv.y); 
            `);
            shader.fragmentShader = `varying vec2 vRefUv;` + shader.fragmentShader;
            shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
                #ifdef USE_MAP
                    vec4 texelColor = texture2D( map, vRefUv );
                    diffuseColor *= texelColor;
                #endif
            `);
            windMesh.userData.shader = shader;
        };
        windMesh.geometry.setAttribute('refUv', refUvAttr);
        windMesh.visible = (this.activeMode === 'wind');
        container.add(windMesh);
        this.meshes.wind = windMesh;


        // -------------------------
        // 4. FIRE (Points)
        // -------------------------
        const fireGeo = new THREE.BufferGeometry();
        const firePos = new Float32Array(count * 3);
        fireGeo.setAttribute('position', new THREE.BufferAttribute(firePos, 3));
        fireGeo.setAttribute('refUv', new THREE.BufferAttribute(refUvs, 2));
        const fireMat = new THREE.ShaderMaterial({
            uniforms: {
                uPosTex: { value: null },
                uTime: { value: 0 },
                uMap: { value: currentMap }
            },
            vertexShader: `
                uniform sampler2D uPosTex;
                uniform float uTime;
                attribute vec2 refUv;
                varying float vLife;
                varying vec2 vRefUv;
                void main() {
                    vec3 pos = texture2D(uPosTex, refUv).xyz;
                    pos.y += sin(pos.x * 0.5 + uTime * 2.0) * 0.5;
                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                    gl_PointSize = (300.0 / -mvPosition.z);
                    vLife = pos.y; 
                    vRefUv = vec2(refUv.x, 1.0 - refUv.y);
                }
            `,
            fragmentShader: `
                uniform sampler2D uMap;
                varying float vLife;
                varying vec2 vRefUv;
                void main() {
                    vec2 coord = gl_PointCoord - vec2(0.5);
                    if(length(coord) > 0.5) discard;
                    vec4 texColor = texture2D(uMap, vRefUv);
                    vec3 fireTint = mix(vec3(1.0, 0.5, 0.0), vec3(1.0, 0.9, 0.5), smoothstep(-10.0, 10.0, vLife));
                    gl_FragColor = vec4(texColor.rgb * fireTint * 2.0, 0.8);
                }
            `,
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
        });
        const fireMesh = new THREE.Points(fireGeo, fireMat);
        fireMesh.visible = (this.activeMode === 'fire');
        container.add(fireMesh);
        this.meshes.fire = fireMesh;
    },

    setMode(mode) {
        this.activeMode = mode;
        Object.values(this.meshes).forEach(m => { if(m) m.visible = false; });
        if (this.meshes[mode]) {
            this.meshes[mode].visible = true;
        }
    },

    update(delta) {
        if (!this.gpuCompute) return;

        // --- FIX: FORCE HIDE THE STATIC LANDSCAPE ---
        // Because ImagePlaneManager doesn't know about 'elemental' mode,
        // we must manually hide the base landscape to prevent Z-fighting.
        if (this.app.ImagePlaneManager && this.app.ImagePlaneManager.landscape) {
            this.app.ImagePlaneManager.landscape.visible = false;
        }

        const planeDims = this.app.ImagePlaneManager.planeDimensions;
        if (Math.abs(planeDims.x - this._currentPlaneWidth) > 0.01 || 
            Math.abs(planeDims.y - this._currentPlaneHeight) > 0.01) {
            
            console.log("ElementalManager: Detected size change, rebuilding visualizers.");
            
            const dtPosition = this.gpuCompute.createTexture();
            this._fillInitialPositions(dtPosition);
            
            this.initVisualizers();
        }

        const uniforms = this.posVar.material.uniforms;
        uniforms.uTime.value = this.app.currentTime;
        uniforms.uDelta.value = delta;
        
        const S = this.app.vizSettings;
        uniforms.uMorph.value = S.particle_morphProgress || 0.0;
        uniforms.uTurbulence.value = S.particle_flowStrength || 0.5;
        uniforms.uFrequency.value = S.particle_flowScale || 0.1;
        uniforms.uSpeed.value = S.particle_flowSpeed || 0.5;

        const currentTex = this.app.ImagePlaneManager.currentTexture;
        if (currentTex) {
            if(this.meshes.earth.material.map !== currentTex) {
               this.meshes.earth.material.map = currentTex;
               this.meshes.earth.material.needsUpdate = true;
            }
            if(this.meshes.water.material.map !== currentTex) {
               this.meshes.water.material.map = currentTex;
               this.meshes.water.material.needsUpdate = true;
            }
            if(this.meshes.wind.material.map !== currentTex) {
               this.meshes.wind.material.map = currentTex;
               this.meshes.wind.material.needsUpdate = true;
            }
            if(this.meshes.fire.material.uniforms.uMap.value !== currentTex) {
               this.meshes.fire.material.uniforms.uMap.value = currentTex;
            }
        }

        this.gpuCompute.compute();
        
        const currentPosTex = this.gpuCompute.getCurrentRenderTarget(this.posVar).texture;
        const activeMesh = this.meshes[this.activeMode];
        
        if (activeMesh) {
            if (activeMesh.material.isShaderMaterial) {
                activeMesh.material.uniforms.uPosTex.value = currentPosTex;
                if (activeMesh.material.uniforms.uTime) {
                    activeMesh.material.uniforms.uTime.value = this.app.currentTime;
                }
            } else if (activeMesh.userData.shader) {
                activeMesh.userData.shader.uniforms.uPosTex.value = currentPosTex;
            }
        }
    }
};