# Gem-And-I-Visuals: GPGPU Rebuild Roadmap
# Document Version: 4.0 (Final Comprehensive Version)

This document is the definitive, master guide for the GPGPU Engine Rebuild. It incorporates all strategic decisions and detailed explanations to ensure complete clarity throughout the project.

## Project Onboarding

*   **Project Name:** Gem-And-I-Visuals
*   **Primary Goal:** To build a top-tier, audio-reactive generative art engine based on a dynamic landscape, controlled by a user and a future AI Director.
*   **Chosen Architecture:** GPGPU (General-Purpose computing on GPU) using a Compute Shader pipeline in Three.js with a strict "Single Responsibility" principle for shaders.
*   **Roles:**
    *   **User (Gem):** Project Director, Lead Developer. Makes final architectural decisions, performs all file operations and testing.
    *   **AI:** Coding Assistant. Translates decisions into clean code, explains concepts, and follows this roadmap meticulously.

---

## Target File Architecture

Gem-And-I-Visuals/
├── node_modules/
├── public/
├── src/
│ ├── compute/
│ │ ├── ComputeManager.js
│ │ └── shaders/
│ │ ├── position_frag.glsl
│ │ ├── velocity_frag.glsl
│ │ ├── normal_frag.glsl // <-- DEDICATED normal shader
│ │ ├── peel_frag.glsl
│ │ └── sag_frag.glsl
│ ├── modules/
│ │ ├── UIManager.js
│ │ ├── ImagePlaneManager.js
│ │ ├── LightingManager.js
│ │ ├── AudioProcessor.js
│ │ └── Director.js
│ ├── rendering/
│ │ ├── landscape_vert.glsl
│ │ └── landscape_frag.glsl
│ ├── Engine.js
│ ├── main.js
│ └── style.css
├── .gitignore
├── index.html
├── package.json
└── vite.config.js


---

## Phase 1: The GPGPU Foundation Complete

**Objective:** To establish the core GPGPU pipeline. This phase is complete when we can render and animate thousands of individual points on the screen, with their positions being calculated entirely on the GPU via a compute shader. This proves the foundational architecture works.

**Key Concepts:**
*   **Data Textures:** We will use `WebGLRenderTarget` objects as our data storage. These are textures that the GPU can write to. Each pixel in these textures will store data (e.g., a pixel's RGB values will represent a point's XYZ position).
*   **Compute Shader:** A special fragment shader whose only purpose is to perform calculations and write the results to a data texture. It does not render directly to the screen.
*   **Ping-Pong Buffers:** A technique using two data textures for a given property (e.g., positionA and positionB). In each frame, we read from one texture and write the updated data to the other, then swap them. This is handled automatically by Three.js's `GPUComputationRenderer`.

**Estimated Interactions:** 10 - 15

### Step-by-Step Plan

**1.1: Project Setup & Developer Experience (DX)** Complete
*   **Action(s):**
    *   Create the initial project files: `package.json`, `vite.config.js`, `index.html`, and `.gitignore`.
    *   **Install Vite and `vite-plugin-glsl`. We will configure the plugin in `vite.config.js` to enable GLSL shader hot-reloading. This is a critical DX improvement that will save countless hours by allowing instant shader updates without page refreshes.**
    *   Create core application files: `src/main.js`, `src/style.css`, `src/Engine.js`.
    *   Establish our directory structure: `src/compute/shaders/`, `src/rendering/`, `src/modules/`.
    *   In `Engine.js`, set up a minimal Three.js scene: a `Scene`, `PerspectiveCamera`, `WebGLRenderer`, and an empty `update()` loop connected to `requestAnimationFrame`.
*   **Success Metric:** A blank webpage loads from the Vite dev server without errors. We can test that saving a temporary `.glsl` file triggers a console log in our JavaScript without a full page refresh.

**1.2: Compute Manager** Complete
*   **Action(s):**
    *   Create the file `src/compute/ComputeManager.js`. This class will be our primary interface for the entire GPGPU system.
    *   In its constructor, initialize properties for the dedicated `Scene` and `OrthographicCamera` required for off-screen compute rendering.
    *   In `Engine.js`, import and instantiate the `ComputeManager` to integrate it into our application.
*   **Success Metric:** The application runs with the `ComputeManager` instantiated, and no errors are thrown.

**1.3: Initial Data Textures** Complete
*   **Action(s):**
    *   In `ComputeManager.js`, define the simulation dimensions (e.g., `WIDTH = 256`). This determines the number of particles (WIDTH * WIDTH).
    *   Initialize the `GPUComputationRenderer` helper class from Three.js.
    *   Create a `position` variable within the renderer. We will write a helper function to create a `DataTexture` filled with random initial XYZ positions to seed this variable.
    *   Create a `velocity` variable within the renderer, seeded with a `DataTexture` of all zeros.
*   **Success Metric:** The `GPUComputationRenderer` is successfully initialized, and the Frame Buffer Objects (FBOs) for position and velocity are allocated on the GPU.

**1.4: Velocity & Position Compute Shaders** Complete
*   **Action(s):**
    *   Create `src/compute/shaders/velocity_frag.glsl`. For now, this will be a "pass-through" shader that simply reads the incoming velocity and writes it back out unchanged.
    *   Create `src/compute/shaders/position_frag.glsl`. This shader will read the current position from the position texture and the current velocity from the velocity texture. It will perform a simple physics integration (`new_position = old_position + velocity * delta_time`) and write the result to `gl_FragColor`.
    *   In `ComputeManager.js`, load these shaders and associate them with the `velocity` and `position` variables in the `GPUComputationRenderer`.
*   **Success Metric:** The GLSL shaders are created and compile without errors when the `GPUComputationRenderer` initializes its materials. The architectural link between velocity and position is now established.

**1.5: Engine Loop Integration (The "Compute" Step)** Complete
*   **Action(s):**
    *   In the main `Engine.js` `update()` loop, we will make a single call: `this.computeManager.update()`.
    *   Inside the `ComputeManager.js` `update()` method, we will call `this.gpuCompute.compute()`. This tells Three.js to execute all the compute shader passes, updating our data textures on the GPU.
*   **Success Metric:** The compute pipeline runs every frame. We can't see anything yet, but the data is being updated on the GPU in the background.

**1.6: Particle Render Material & Geometry** Complete
*   **Action(s):**
    *   Create the rendering shaders: `src/rendering/landscape_vert.glsl` and `src/rendering/landscape_frag.glsl`.
    *   The vertex shader is the crucial link. It will receive the latest position texture from the `ComputeManager` as a uniform. It will use the vertex's ID (`gl_VertexID`) to calculate the correct pixel to look up in the texture to find its world position, which it then assigns to `gl_Position`.
    *   The fragment shader will be simple, outputting a solid color.
    *   Create `ImagePlaneManager.js`. This manager will create a `BufferGeometry` for our particles and the `ShaderMaterial` that uses our new rendering shaders. It will add the final `THREE.Points` object to the main scene.
*   **Success Metric:** A `Points` object is created and added to the main scene, ready to be rendered using the GPGPU data.

**1.7: Implement Debug View & Finalize Phase** Complete
*   **Action(s):**
    *   To verify our compute shaders are working, we will create a simple `THREE.PlaneGeometry` with a `MeshBasicMaterial`.
    *   We will map the raw position texture from the `GPUComputationRenderer` directly to the material's `map` property.
    *   This debug plane will be added to the scene in a corner, likely with its own camera, to provide a live view of our raw data.
*   **Success Metric:** We see two things: 1) The debug plane shows a texture of shifting colors, proving our compute shader is writing new data. 2) The main view shows thousands of points moving in unison. This is the successful completion of Phase 1.

--- 

## Phase 2: From Points to a Surface

**Objective:** To transform the cloud of discrete points from Phase 1 into a continuous, visually coherent, and lit surface that can be textured.

**Key Concepts:**
*   **Indexed Geometry (`BufferGeometry.setIndex`):** To create a surface, we must define how vertices connect to form triangles. An index buffer is an array that defines these connections. `PlaneGeometry` handles this for us.
*   **UV Coordinates:** 2D coordinates mapped to each vertex that tell the GPU which part of a texture to apply. Critically, these same coordinates will be used to look up the vertex's position from our data textures.
*   **Dedicated Normal Pass:** To achieve realistic lighting, we need to calculate the normal vector for each point on our surface. We will do this in a separate, dedicated compute pass for cleanliness and correctness.

**Estimated Interactions:** 8 - 12

### Step-by-Step Plan

**2.1: Indexed Grid Geometry** Complete 
*   **Action(s):**
    *   In `ImagePlaneManager.js`, modify the `createLandscape` method. We will remove the `Points` object and replace it with a `THREE.Mesh`.
    *   This mesh will use a high-resolution `THREE.PlaneGeometry` (e.g., 256x256 segments) to match our simulation `WIDTH`.
*   **Success Metric:** A single, static, un-textured plane mesh appears in the scene, replacing the cloud of points.

**2.2: Linking Rendering to Compute Data** Complete 
*   **Action(s):**
    *   Modify the rendering vertex shader (`landscape_vert.glsl`). Instead of using `gl_VertexID`, it will now use the geometry's built-in `uv` attribute to look up its position in the `t_position` data texture uniform.
    *   The shader will then assign this fetched position to `gl_Position` after applying matrix transformations.
*   **Success Metric:** The flat plane from the previous step now animates exactly as the points did, confirming that our rendered mesh vertices are correctly fetching their positions from the GPGPU simulation.

**2.3: Texture Mapping** Complete 
*   **Action(s):**
    *   In `ImagePlaneManager.js`, load a `THREE.Texture` (from an image or video) and pass it as a `t_diffuse` uniform to the rendering `ShaderMaterial`.
    *   In `landscape_vert.glsl`, pass the `uv` attribute to the fragment shader as a `varying` variable (`vUv`).
    *   In `landscape_frag.glsl`, use the incoming `vUv` to sample from the `t_diffuse` uniform and output its color to `gl_FragColor`.
*   **Success Metric:** We can load an image, and it correctly appears mapped across the animated plane surface.

**2.4: Dedicated Normal Calculation Pass** Complete 
*   **Action(s):**
    *   **This is a critical architectural step.** Create a new compute shader: `src/compute/shaders/normal_frag.glsl`.
    *   This shader's **only responsibility** is to calculate the surface normal. It will take the final, deformed position texture as input. By sampling the positions of neighboring points (left, right, up, down), it can compute two vectors on the surface and their cross product, which is the normal.
    *   In `ComputeManager.js`, add a new `normal` variable to the `GPUComputationRenderer`, driven by this new shader.
    *   The `ComputeManager`'s update loop will now execute the passes in a specific order: Velocity -> Position -> Normals. This ensures normals are always calculated based on the final geometry for that frame.
*   **Success Metric:** A `normal` data texture is being correctly calculated and updated each frame, representing the orientation of the surface at every point.

**2.5: Basic Lighting** Complete 
*   **Action(s):**
    *   Create `LightingManager.js` to add `AmbientLight` and `DirectionalLight` to the scene.
    *   Pass the light's properties (color, direction) as uniforms to the rendering fragment shader (`landscape_frag.glsl`).
    *   The rendering vertex shader (`landscape_vert.glsl`) will fetch the calculated normal from our new `normal` texture uniform (using its `uv` attribute) and pass it to the fragment shader.
    *   The fragment shader will perform a basic N-dot-L (Normal dot Light direction) diffuse lighting calculation and combine it with the diffuse texture color.
*   **Success Metric:** The textured plane is now correctly lit. As it deforms, the lighting dynamically changes based on the surface's angle, proving our entire pipeline is working.

---

## Phase 3: Core Feature Integration

**Objective:** To re-implement the essential, non-deforming features from the old project. This phase focuses on connecting our new GPGPU engine to user controls, audio data, and proper scene lighting.

**Key Concepts:**
*   **State-Driven Uniforms:** We will introduce a single `Engine.state` object as the source of truth. The UI modifies this state object. Managers read from this state object and update shader uniforms accordingly.
*   **Manager Specialization:** Each manager has a clearly defined role. `UIManager` handles DOM. `AudioProcessor` handles Web Audio API. `LightingManager` handles lights. This separation keeps the codebase clean.

**Estimated Interactions:** 12 - 16

### Step-by-Step Plan

**3.1: UI Controls & State**
*   **Action(s):** Create `UIManager.js` and a global `Engine.state` object. Populate the UI with controls for `Aspect Ratio` and `Orientation`. These controls will only modify the `Engine.state` object. `ImagePlaneManager` will read the state in its update loop and trigger a geometry rebuild if the aspect ratio has changed.
*   **Success Metric:** UI dropdowns for aspect ratio and orientation reliably and correctly modify the landscape mesh's shape and rotation.

**3.2: Audio Processor**
*   **Action(s):** Create `src/modules/AudioProcessor.js` to encapsulate all Web Audio API logic. It will contain methods for mic/file input and an `update()` method that runs `analyser.getByteFrequencyData()`. It will expose a method that provides a `DataTexture` of the frequency data.
*   **Success Metric:** The `AudioProcessor` can process audio and provides a texture containing audio frequency data, updated each frame.

**3.3: Audio-Reactive Deformation**
*   **Action(s):** Pass the audio data texture as a `t_audio` uniform to the `velocity_frag.glsl` compute shader. In the UI, add a slider for "Audio Strength" that updates `state.landscape.audioStrength`. In the velocity shader, we will sample the audio texture and use it to apply a force to the particles (e.g., pushing them along their normal vector).
*   **Success Metric:** The landscape surface visibly deforms in real-time in response to audio input, and the intensity is controlled by the UI slider.

**3.4: Lighting Manager**
*   **Action(s):** Fully implement `LightingManager.js`. Populate the UI with the full suite of lighting controls (colors, intensity, position/orbit). The UI will update `state.lighting`, and the `LightingManager` will read this state to update the Three.js light objects and the corresponding shader uniforms.
*   **Success Metric:** All UI lighting controls correctly manipulate the scene's lighting in real-time. The system is now fully interactive.

---

## Phase 4: The Generative Effects Engine

**Objective:** To build the library of landscape deformation effects (Peel, Sag) as a series of modular, chainable compute shader passes. This phase realizes the core promise of the GPGPU architecture.

**Key Concepts:**
*   **Uniform Buffer Objects (UBOs):** To manage the growing number of uniforms cleanly, we will use `UniformsGroup` to group related uniforms (like lighting or effect parameters) into blocks, mirroring `structs` in GLSL. This greatly improves maintainability.
*   **Effect Chaining:** The output position texture from one effect's compute pass will become the input position for the next effect's pass. This forms a "pipeline" of effects.
*   **Conditional Execution:** The `ComputeManager` will be upgraded to read the `Engine.state` and decide which effect passes to run and in what order for any given frame.

**Estimated Interactions:** 15 - 20+

### Step-by-Step Plan

**4.1: Architect for Uniform Buffer Objects (UBOs)**
*   **Action(s):** Before adding new effects, we will refactor our uniform management. We will create `UniformsGroup` objects in our JavaScript managers for logical sets of data (e.g., `lightingUniforms`, `timeUniforms`). In GLSL, we will mirror these with `uniform` blocks.
*   **Success Metric:** Uniforms are now passed to shaders in clean, organized blocks. This refactor makes adding and managing uniforms for the upcoming effects vastly simpler and less error-prone.

**4.2: Compute Manager Refactor for Chaining**
*   **Action(s):** Refactor the `ComputeManager.js` `update` method. It will no longer have a hardcoded list of passes. Instead, it will manage a dynamic list of effect passes. It will loop through the active effects, ping-ponging the position data between each pass.
*   **Success Metric:** The compute manager can successfully run a chain of multiple compute passes, transforming position data sequentially.

**4.3: Peel Deformer**
*   **Action(s):** Create `src/compute/shaders/peel_frag.glsl`. Implement the GLSL logic for the peel effect. This shader simply reads an input position and writes a deformed output position. Create the UI controls for the Peel deformer, linked to `state.landscape.peel`. Integrate the peel shader as a conditional pass in the `ComputeManager`'s chain.
*   **Success Metric:** The "Peel Deformer" is fully functional, can be toggled on/off, and all its parameters can be controlled from the UI.

**4.4: Sag Deformer**
*   **Action(s):** Create `src/compute/shaders/sag_frag.glsl`. Implement the sag GLSL logic. Create its UI controls, link to `state.landscape.sag`, and integrate as another conditional pass in the chain.
*   **Success Metric:** The "Sag Deformer" is fully functional. We can now enable Peel, Sag, or both simultaneously, and the effects will chain together visually.

**4.5: Porting Additional Warpers**
*   **Action(s):** Systematically re-implement other desired deformers (e.g., Droop, Fold) one at a time. The process for each is: 1. Create the GLSL file. 2. Create the UI controls. 3. Integrate it as a conditional pass in `ComputeManager`.
*   **Success Metric:** A library of desired deformation effects is complete. Each can be toggled and controlled independently, and they can be layered in any combination to create complex, emergent visual shapes.

---

## Phase 5: The Director Engine & AI-Readiness

**Objective:** To abstract the low-level control of effects and actors into a high-level "Director" system. This phase is about creating a clean, powerful API that allows us to script complex visual sequences easily, making the entire engine controllable by a future AI agent.

**Key Concepts:**
*   **Behavioral Scripting:** Instead of manipulating `position.x` directly, we will command actors with simple behaviors like `moveTo(target, duration)`.
*   **Decoupling:** The UI will no longer directly modify the state. Instead, the UI sends commands to the Director. The Director executes behaviors that modify the state. The managers read the state and update the Three.js objects. This one-way data flow is key to a stable system.
*   **State Machine:** The Director will act as a simple state machine, capable of managing different modes like "Manual Control," "Preset 1," or "AI Control."

**Estimated Interactions:** 12 - 18

### Step-by-Step Plan

**5.1: Create the Director Manager**
*   **Action(s):** Create `src/modules/Director.js`. This class will be the central "brain." It will hold references to all controllable "actors" in the scene (e.g., `this.actors.landscape`). Instantiate it in `Engine.js`.
*   **Success Metric:** The `Director.js` file is created and integrated into the Engine without errors.

**5.2: Define the Behavior Library**
*   **Action(s):** Within `Director.js`, define a library of data-driven behavior functions (`moveTo`, `rotateTo`, `setEffectStrength`). These functions will modify properties within a target actor's state object over time. Each actor manager (e.g., `ImagePlaneManager`) will then be updated to be "state-seeking"—its `update()` loop will read its own state and smoothly interpolate the Three.js object towards that target state.
*   **Success Metric:** We can call a behavior from the browser console (e.g., `Engine.director.moveTo(...)`) and see the landscape smoothly move to a new position.

**5.3: Refactor UI to Command the Director**
*   **Action(s):** This is a critical refactor. Go through `UIManager.js` and change the event listeners. Instead of directly changing values in `Engine.state`, these UI elements will now call methods on the Director.
*   **Success Metric:** The UI is completely decoupled from the application state. All user interactions are now commands that are sent to the Director for execution. The application functions identically from the user's perspective, but the internal architecture is far more robust.

**5.4: Implement Preset Scripting**
*   **Action(s):** In `Director.js`, create a `runPreset(presetName)` method. Define presets as arrays of behavior commands: `[{ command: 'moveTo', args: {...} }, { command: 'wait', args: { duration: 2.0 } }, ...]`. The `runPreset` method will asynchronously execute these commands.
*   **Success Metric:** Clicking the autopilot preset buttons now runs flexible scripts from the Director, producing complex, multi-step visual sequences.

**5.5: The AI Bridge (Final Step)**
*   **Action(s):** Create a single, simple, public method in `Director.js` called `executeCommandFromAI(commandObject)`. This method will be a simple API that takes a command object and executes the corresponding behavior. This is the only connection point the future AI project will need.
*   **Success Metric:** The system is now AI-Ready. We have a clean, high-level API for an external system to control the entire visual experience. This completes the entire rebuild project.

### Architectural Implementations & Strategic Considerations (v4.7.1)
1.  **Memory Management & Texture Cleanup**
    *   **Action:** Explicitly create `.dispose()` methods in `ComputeManager` and `ImagePlaneManager` to properly deallocate all GPU textures, materials, and geometries.
    *   **Implementation:** Implement this when features that require re-creating assets (like changing landscape resolution) are added in Phase 3.
2.  **State Validation Layer**
    *   **Action:** Add a validation layer or schema for commands sent to the Director to prevent invalid data from crashing shaders.
    *   **Implementation:** Implement this in Phase 5 when building the Director and AI Bridge to ensure system stability against external inputs.


Remove
3.   particle system for now 
4.   Randomized Initial Data:
     - The old plan likely involved starting particles at random positions to create a cloud.
     - New base state is a structured, flat grid of vertices, which is already implemented.
