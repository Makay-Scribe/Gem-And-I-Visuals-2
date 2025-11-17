# Project Overview: AI‑Driven Audio‑Visual World

## 🎯 Summary
This project is an advanced audio‑visual manipulator built with Three.js. It generates long‑form, cinematic experiences for platforms like YouTube, blending music‑driven visualizers (Milkdrop‑style) with layered 3D worlds.  

- Designed for DJ sets and extended sessions, where visuals evolve autonomously or under AI direction.  
- Core concept: an **image plane** that morphs into complex particle, fluid, and hydrodynamic simulations, always returning to a neutral “wall” state for seamless transitions.  
- Aimed at professional, leading‑edge visuals: calm, surreal, and absurdly complex — pushing browser‑based graphics beyond conventional limits.  

---

## 📜 History
Development has progressed through several distinct engines, all of which remain available in the UI under **GPGPU Options**:

1. **Faceted Mesh (Legacy Effects)**  
2. **GeoCube Effects**  
3. **Particles**  
   - Technically advanced for browser scripting (turbulence, morphing, gravity wells).  
   - But visually simplistic — animations appear flat, reminiscent of 1990s A→B transitions.  
   - Complexity is contained in the A/B states, not the transitions in between.  
4. **Fluid Sim Particles**  
   - Attempted richer transitions, but ultimately limited.  
5. **Hydrofluid Simulation (HydroSim)**  
   - Newly developed, not yet in a working state.  
   - This is the current development focus and starting point for the roadmap.  

### Key Notes
- Each engine is **self‑contained in separate folders**, allowing clean on/off toggling.  
- This modularity is central: new effects must remain self‑contained.  
- **ComputeManager.js** and **UIManager.js** host complex wiring between engines, options, and layers.  
- AI should constantly monitor repo structure + effect files to suggest **optimization, refactoring, and new development**.  

---

## 🧩 Current Structure

### Core Actors
- **Landscape (Layer 2)**  
  - Modes: Faceted Mesh, GeoCube, Particles/Fluid Sim, HydroSim.  
  - Morphs between flat canvas and baked 3D models.  
  - Autopilot script moves canvas around camera viewpoint.  
  - Morphing animations replicate Earth/Water/Air/Fire substances.  

- **3D Model (Layer 3)**  
  - GLTF models with animation system.  
  - Default: animated pterodactyl.  
  - Autopilot allows roaming in/out of camera view.  
  - Model swaps mid‑flight → optical illusion of multiple floating objects.  

### Background & Layers
- **Layer 0**: Background shader (Shadertoy + Butterchurn).  
  - Toggle: greenscreen or black.  
  - Integrated **cube map reflections** via CubeCamera, feeding PBR shading for canvas and models.  
  - Shadertoy cube map scripts deepen reflections and allow AI to detect inconsistencies in wiring.  
- **Layer 1**: Reserved for future creative ideas (fog, mesh world map).  

---

## ⚙️ Technical Architecture

### Main Loop
- **main.js** orchestrates managers and runs the animate loop.  
- **three‑singleton.js** ensures a single Three.js instance.  
- **UIManager.js** manages HTML/CSS controls, vizSettings, and EQ canvas.  
- **SceneManager.js & CameraManager.js** set up scene + perspective camera.  

### Rendering
- **BackgroundManager.js** renders full‑screen quad (GLSL, Butterchurn, solid color).  
- Uses CubeCamera → cube map (hdrTexture) for realistic PBR reflections.  
- **Shaders**:  
  - `landscape_render.frag`, `particle_render.frag` → PBR lighting, emissive fire/twinkle effects.  

### GPGPU Systems
- **System 1: Landscape Deformation**  
  - `gpgpu_position.glsl` + effects (`cloth.glsl`, `fold.glsl`, `peel.glsl`, `sag.glsl`, `droop.glsl`, `cylinder.glsl`, `waterRipple.glsl`, `eqRipple.glsl`).  
  - Audio‑reactive forces, geometric warping, cloth physics.  

- **System 2: Unified Particle & Fluid Simulation**  
  - Position + velocity textures.  
  - `particle_velocity.glsl` → turbulence, gravity wells, attraction.  
  - `sph_velocity.glsl` → fluid‑like forces, curl noise, vortexes.  
  - Cohesion via blurred position texture.  
  - Morphing between flat plane and 3D model via `bakeToTexture`.  

- **System 3: Hydrodynamics Simulation (HydroSim)**  
  - Managed by `HydroSimManager.js`.  
  - Classic Navier‑Stokes solver: `advect.glsl`, `splat.glsl`, `divergence.glsl`, `jacobi.glsl`, `gradient.glsl`.  
  - Currently under development, not yet functional.  

### Audio Processing
- **AudioProcessor.js**: Web Audio API (FFT, beat detection).  
- Generates `audioTexture` for high‑resolution audio‑reactive effects.  

### AI & Scripting
- **Autopilot**: `ImagePlaneManager.js`, `ModelManager.js`. Random waypoints, smooth motion.  
- **Choreographers**: `ParticleTransitions.js`, `FluidDirector.js`. Timed sequences (explode, melt, cosmicGeode, fireAndAsh).  
- **DirectorManager.js**: High‑level state machine for long‑form shows.  
  - Broader than autopilot: includes demo mode, effect launching, 3D model integration, and future chatbot control.  

---

## 🌟 Vision
- **Shared zero‑state**: All effects return to a flat “wall” plane for seamless transitions.  
- **Autopilot morphing**: Wall → effect → wall, enabling invisible transitions.  
- **AI Director**: Future system to orchestrate presets, sliders, and options automatically.  
- **Illusion goal**: Despite different engines/effects, the wall morphing creates a unified visual identity.  

---

## 🎨 Creative Directions
- Push boundaries of browser‑based animation with Three.js.  
- Explore surreal, complex, next‑level effects without time constraints.  
- Example ideas (not instructions):  
  - Landscape canvas breaks into particle clouds forming a paintbrush that paints the scene.  
  - Landscape erupts in fire, ashes settle into a new 3D model.  
- AI should suggest new directions, resources, and tools beyond current awareness.  

---

## 🚀 Goals
- Make HydroSim functional (current roadmap starting point).  
- Test cutting‑edge HD graphics animation scripts.  
- Develop effect presets for AI Director.  
- Achieve seamless morphing illusions between particle, FluidSim, HydroSim, and future engines.  
- Maintain professional, leading‑edge visuals suitable for DJ sets.  

---

Project Overview

This is an audio-visualizer project built with Node.js, Vite, and Three.js (r165). The goal is to create a calm, chill, multi-layered visualizer, like "Milkdrop on steroids," where music subtly affects an image plane, a 3D model, and a background shader. The ultimate goal is to connect a 3D model (a bird) to an LLM and YouTube chat for user interaction. The project heavily utilizes GPGPU for complex mesh deformations.

- **Three.js Version:** r165

- **Build Tool:** Vite

- **Physics Engine:** cannon-es

- **GPGPU:** `GPUComputationRenderer` from Three.js addons.

- **Node Materials:** TSL via `three/examples/jsm/nodes/Nodes.js`.

- **Shaders:** GLSL 3, loaded from `.vert` and `.frag` files using Vite's `?raw` import.


---

***File tree for AI to UPDATE constantly upon changes ***
NOTE for AI - please restructure / edit for ai to understand better with only the files it needs to see:

📦src
 ┣ 📂compute
 ┃ ┣ 📂shaders
 ┃ ┃ ┣ 📂effects
 ┃ ┃ ┃ ┣ 📜cloth.glsl
 ┃ ┃ ┃ ┣ 📜cylinder.glsl
 ┃ ┃ ┃ ┣ 📜droop.glsl
 ┃ ┃ ┃ ┣ 📜eqRipple.glsl
 ┃ ┃ ┃ ┣ 📜fold.glsl
 ┃ ┃ ┃ ┣ 📜particle_position.glsl
 ┃ ┃ ┃ ┣ 📜particle_velocity.glsl
 ┃ ┃ ┃ ┣ 📜peel.glsl
 ┃ ┃ ┃ ┣ 📜sag.glsl
 ┃ ┃ ┃ ┗ 📜waterRipple.glsl
 ┃ ┃ ┣ 📂hydro
 ┃ ┃ ┃ ┣ 📜advect.glsl
 ┃ ┃ ┃ ┣ 📜curl.glsl
 ┃ ┃ ┃ ┣ 📜divergence.glsl
 ┃ ┃ ┃ ┣ 📜gradient.glsl
 ┃ ┃ ┃ ┣ 📜jacobi.glsl
 ┃ ┃ ┃ ┣ 📜splat.glsl
 ┃ ┃ ┃ ┗ 📜splat_from_texture.glsl
 ┃ ┃ ┣ 📜common.glsl
 ┃ ┃ ┣ 📜gpgpu_position.glsl
 ┃ ┃ ┣ 📜sph_position.glsl
 ┃ ┃ ┗ 📜sph_velocity.glsl
 ┃ ┣ 📜ComputeManager.js
 ┃ ┣ 📜FluidDirector.js
 ┃ ┗ 📜HydroSimManager.js
 ┣ 📂modules
 ┃ ┣ 📜AudioProcessor.js
 ┃ ┣ 📜BackgroundManager.js
 ┃ ┣ 📜ButterchurnManager.js
 ┃ ┣ 📜CameraManager.js
 ┃ ┣ 📜CubeWallManager.js
 ┃ ┣ 📜Debugger.js
 ┃ ┣ 📜DirectorManager.js
 ┃ ┣ 📜GPGPUDebugger.js
 ┃ ┣ 📜ImagePlaneManager.js
 ┃ ┣ 📜ModelManager.js
 ┃ ┣ 📜ParticleTransitions.js
 ┃ ┣ 📜SceneManager.js
 ┃ ┣ 📜shaderPresets.js
 ┃ ┗ 📜UIManager.js
 ┣ 📂rendering
 ┃ ┗ 📂shaders
 ┃ ┃ ┣ 📜background.frag
 ┃ ┃ ┗ 📜background.vert
 ┣ 📂shaders
 ┃ ┣ 📜cubewall_render.vert
 ┃ ┣ 📜landscape_render.frag
 ┃ ┣ 📜landscape_render.vert
 ┃ ┣ 📜particle_emissive.frag
 ┃ ┣ 📜particle_render.frag
 ┃ ┗ 📜particle_render.vert
 ┣ 📜main.js
 ┣ 📜style.css
 ┗ 📜three-singleton.js