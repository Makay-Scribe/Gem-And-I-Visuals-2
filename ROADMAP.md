

# Project Roadmap

> **Note for AI Reviewers:**  
> This roadmap is the authoritative guide for HydroSim development. Review the project closely against this roadmap to identify and fix mistakes or mismatches between:  
> 1. What the user describes,  
> 2. What is written here, and  
> 3. The actual code in the repo.  
> Ensure file references, shader sequences, and UI wiring are consistent. Flag discrepancies and propose corrections.

---

## 📌 Progress Tracking Table

| Milestone | Files | Status | Notes |
|-----------|-------|--------|-------|
| **Sandbox (Phase 1)** | `index.html`, `UIManager.js` | ✅ Done | Hydro Sim tab + panel created |
| **Hello World (Phase 2)** | `HydroSimManager.js`, `ComputeManager.js`, `ImagePlaneManager.js`, `main.js`, `style.css` | ✅ Done | Black square renders |
| **Core Fluid Physics (Phase 3)** | `splat.glsl`, `advect.glsl`, `divergence.glsl`, `jacobi.glsl`, `gradient.glsl`, `common.glsl`, `HydroSimManager.js`, `main.js`, `ComputeManager.js`, `ImagePlaneManager.js`, `GPGPUDebugger.js` | 🔧 In Progress | Shaders exist, orchestration works, mouse splat debugging |
| **Director Integration (Phase 4)** | `HydroSimManager.js`, `FluidDirector.js`, `UIManager.js` | ⏳ Not Started | Needs API + scripting |
| **Mid‑Term Creative Presets** | `FluidDirector.js`, new GLSL presets | ⏳ Not Started | Artistic transitions |
| **Long‑Term Unified Vision** | `DirectorManager.js`, all engines | ⏳ Not Started | Seamless wall → effect → wall |

---

## ✅ Milestone 1: Sandbox & Hello World (DONE)

**Goal:** Establish HydroSim as a new, isolated engine with UI integration. The ultimate goal is not just an interactive fluid toy, but a powerful transitional effects engine. The HydroSim will act as a "texture generator" that creates the elemental appearance (fire, water, smoke) which will then be mapped onto the particles as they perform the physical motion of transitioning from the 2D plane to the 3D model.

- **Files touched:**  
  - `index.html` → Added Hydro Sim button + `hydroSimControlsContainer`.  
  - `UIManager.js` → Logic to show/hide HydroSim panel.  
  - `HydroSimManager.js` → Skeleton module created.  
  - `ComputeManager.js` → Imported and delegated update loop to HydroSimManager.  
  - `ImagePlaneManager.js` → Added `_createHydroSimPlane()`, hydroSimPlane object, visibility/cleanup logic.  
  - `main.js` → Imported and initialized HydroSimManager.  
  - `style.css` → Minor tweaks (if needed).  

**Status:** HydroSim tab exists, black square renders successfully.

---

## 🔧 Milestone 2: Core Fluid Physics (IN PROGRESS)

**Goal:** Implement Eulerian fluid simulation shaders and orchestration.

- **Shaders created (DONE):**  
  - `/src/compute/shaders/hydro/splat.glsl`  
  - `/src/compute/shaders/hydro/advect.glsl`  
  - `/src/compute/shaders/hydro/divergence.glsl`  
  - `/src/compute/shaders/hydro/jacobi.glsl`  
  - `/src/compute/shaders/hydro/gradient.glsl`  
  - `/src/compute/shaders/hydro/common.glsl` (shared functions, optional)  

- **Files modified:**  
  - `HydroSimManager.js` → Orchestrates multi‑pass sequence: advect → divergence → jacobi (loop) → gradient → splat.  
  - `main.js` → Event handling for mouse input (currently conflicting).  
  - `ImagePlaneManager.js` → Integration of hydroSimPlane with scene.  
  - `ComputeManager.js` → Routing for HydroSim compute passes.  
  - `GPGPUDebugger.js` → (optional) Inspect HydroSim textures.  

**Current Status:**  
- Black canvas renders reliably.  
- Shaders exist and sequence runs.  
- **Critical blocker:** Mouse splatting not working. Event handling conflict in `main.js` prevents fluid painting.  
- **Next steps:**  
  - Debug mouse input pipeline.  
  - Ensure splat shader writes non‑black values to density/velocity textures.  
  - Add debugging hooks in `GPGPUDebugger.js`.  

---

## 🎬 Milestone 3: Director Integration (NOT STARTED)

**Goal:** Connect HydroSim to high‑level scripting engines.

- **Files to modify:**  
  - `HydroSimManager.js` → Add API functions (`applyGlobalForce`, `triggerSplat`, etc.).  
  - `FluidDirector.js` → Add `runHydroScript()` for HydroSim sequences.  
  - `UIManager.js` → Ensure preset buttons trigger HydroSim director functions.  

**Planned Scripts:**  
- Canvas eruption → ash particles → 3D model morph.  
- Paintbrush particles painting the model.  

---

## 🌟 Mid‑Term Milestones

**Goal:** Expand HydroSim beyond raw physics into creative transitions.

- **Effect Presets:**  
  - Fire → ash → 3D model.  
  - Paintbrush particles painting the model.  
  - Cloud morphs, surreal glitch effects.  
- **Optimization:**  
  - Refactor `ComputeManager.js` wiring for modularity.  
  - Ensure HydroSim remains self‑contained and toggleable.  
- **Background Consistency:**  
  - Audit cube map reflection integration (Shadertoy + Butterchurn).  
  - Ensure HydroSim visuals reflect environment maps correctly.  

---

## 🧠 Long‑Term Milestones

**Goal:** Achieve the full artistic vision.

- **Unified Morphing Illusion:**  
  - Perfect seamless wall → effect → wall transitions across all engines.  
- **AI Director Expansion:**  
  - Broaden `DirectorManager.js` to orchestrate autopilot, demo mode, effect launching, chatbot integration.  
- **Performance Scaling:**  
  - Benchmark HydroSim across browsers/hardware.  
  - Optimize GPGPU pipelines for stability in long DJ sessions.  
- **Creative Exploration:**  
  - Allow AI to propose new engines/effects as self‑contained modules.  
  - Expand presets library for Director scripts.  

---

## 📂 Roadmap Principles
- **Self‑Contained Effects:** Every new effect must live in its own folder, toggle cleanly, and integrate with managers.  
- **Consistency:** All effects must respect the “wall” zero‑state for seamless morphing.  
- **AI Collaboration:** Roadmap items should be phrased to invite AI suggestions, not just execution.  
- **Iterative Development:** Each milestone builds on the previous (Particles → FluidSim → HydroSim → Future Engines).  

---

## 🔧 Suggestions for Structure & Info Components
Since you’re an amateur coder working with Cascade, here are extra components you can add to make this roadmap even more useful:

1. **Progress Tracking Table (already added)** → AI can instantly see file‑level status.  
2. **Known Issues Section** → List bugs (e.g., “mouse splat not updating textures”) so AI can prioritize fixes.  
3. **Testing Checklist** → For each milestone, add “expected output” (e.g., “HydroSim renders colored splats when dragging mouse”).  
4. **Debugging Notes** → Keep a short log of failed attempts (e.g., “return; in main.js broke simultaneous input”).  
5. **Creative Prompts Section** → At the end, list visionary ideas (paintbrush morph, fire → ash) so AI knows where to brainstorm.  
6. **AI Review Instructions** → Already at the top, but you can expand: “AI should cross‑check roadmap vs repo vs overview.”  
7. **Versioning** → Add dates or version tags to milestones so you know when each was completed.  

---

✅ This roadmap is now **file‑level, milestone‑based, AI‑friendly, and beginner‑friendly**. It includes tracking, debugging, and creative prompts so Cascade/Gemini can act as both fixer and collaborator.  

------------------------------->

Here’s a **separate section**. It’s structured for AI reviewers to track bugs, expected outputs, and debugging notes clearly.

---

## 🐞 Known Issues

- **HydroSim Mouse Splatting**
  - Symptom: Clicking/dragging does not add color to the black canvas.  
  - Root Cause (suspected): Event handling conflict in `main.js`. Current fix attempt (`return;`) broke simultaneous input.  
  - Status: **Critical blocker** — simulation runs but splat commands fail to update textures.  

- **HydroSim Rendering**
  - Symptom: Black square renders, but no visible fluid dynamics yet.  
  - Root Cause: Shader sequence runs, but outputs remain uniform black.  
  - Status: **In progress** — shaders exist, orchestration works, but outputs need verification.  

---

## ✅ Testing Checklist

For each milestone, confirm the following outputs:

- **Sandbox (Phase 1)**  
  - Hydro Sim tab appears in UI.  
  - Panel toggles correctly.  

- **Hello World (Phase 2)**  
  - HydroSimManager renders a solid black square.  
  - No crashes in `main.js` or `ComputeManager.js`.  

- **Core Fluid Physics (Phase 3)**  
  - `splat.glsl`: Mouse drag adds visible color splats to canvas.  
  - `advect.glsl`: Colors move smoothly across canvas.  
  - `divergence.glsl`: Fluid expansion/compression visible.  
  - `jacobi.glsl`: Pressure solver stabilizes simulation (no infinite blow‑ups).  
  - `gradient.glsl`: Velocity field corrected, fluid flows naturally.  
  - Debug: `GPGPUDebugger.js` shows non‑black textures.  

- **Director Integration (Phase 4)**  
  - Preset buttons trigger HydroSim scripts.  
  - Example: “Fire & Ash” script runs → eruption effect visible.  

---

## 📝 Debugging Notes

- **Main.js Input Handling**
  - Current attempt: `return;` in mouse handler → broke simultaneous camera + splat input.  
  - Next attempt: Separate event channels for camera vs HydroSimManager.  

- **HydroSimManager.js**
  - Multi‑pass orchestration confirmed, but outputs remain black.  
  - Need to verify texture writes in `splat.glsl`.  

- **Shader Debugging**
  - Add temporary color outputs (e.g., red = velocity.x, green = velocity.y) to confirm shader passes.  
  - Use `common.glsl` for shared math functions to reduce duplication.  

---

## 🎨 Creative Prompts for AI

- Canvas erupts into fire → ashes settle into 3D model.  
- Canvas breaks into particle clouds → paintbrush strokes form the model.  
- Surreal morphs: glitch, holographic, dreamlike transitions.  

---

✅ This section gives you:  
- **Known Issues** → AI knows what’s broken.  
- **Testing Checklist** → AI knows what “success” looks like.  
- **Debugging Notes** → AI sees past attempts and avoids repeating mistakes.  
- **Creative Prompts** → AI knows where to brainstorm once HydroSim is stable.  

------------------------>

Here’s a **separate “Success Criteria” section**.It complements the Known Issues + Testing Checklist by giving you clear, milestone‑by‑milestone definitions of what “done” looks like. This way AI can mark progress confidently.

---

## 🎯 Success Criteria

### Milestone 1: Sandbox & Hello World
- Hydro Sim tab visible in UI.  
- HydroSim panel toggles correctly.  
- HydroSimManager renders a solid black square without errors.  
- No crashes in `main.js`, `ComputeManager.js`, or `ImagePlaneManager.js`.  

### Milestone 2: Core Fluid Physics
- Mouse splatting adds visible color to HydroSim canvas.  
- Advect shader moves colors smoothly across canvas.  
- Divergence shader shows expansion/compression effects.  
- Jacobi solver stabilizes simulation (no infinite blow‑ups).  
- Gradient shader corrects velocity field → fluid flows naturally.  
- Debug tools (`GPGPUDebugger.js`) confirm non‑black textures.  

### Milestone 3: Director Integration
- HydroSimManager exposes clean API functions (`applyGlobalForce`, `triggerSplat`).  
- FluidDirector can run HydroSim scripts (`runHydroScript()`).  
- UI buttons trigger HydroSim presets correctly.  
- Example script (“Fire & Ash”) runs end‑to‑end with visible eruption effect.  

### Mid‑Term Milestones
- Effect presets (fire → ash, paintbrush morph, cloud morphs) run reliably.  
- ComputeManager wiring refactored for modularity.  
- HydroSim remains self‑contained and toggleable.  
- Cube map reflections integrated consistently across HydroSim visuals.  

### Long‑Term Milestones
- Seamless wall → effect → wall transitions across all engines.  
- DirectorManager orchestrates autopilot, demo mode, effect launching, chatbot integration.  
- HydroSim benchmarks stable across browsers/hardware for long DJ sessions.  
- AI proposes new self‑contained engines/effects; presets library expanded.  
