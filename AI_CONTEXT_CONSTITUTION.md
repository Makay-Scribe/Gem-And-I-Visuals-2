# AI CONTEXT CONSTITUTION for GEM-AND-I-VISUALS

This document contains the foundational principles, architecture, and rules for the Audio-Image-Video Visualizer project. You MUST adhere to these guidelines in all responses.

## 1. Project Overview

This is an audio-visualizer project built with Node.js, Vite, and Three.js (r165). The goal is to create a calm, chill, multi-layered visualizer, like "Milkdrop on steroids," where music subtly affects an image plane, a 3D model, and a background shader. The ultimate goal is to connect a 3D model (a bird) to an LLM and YouTube chat for user interaction. The project heavily utilizes GPGPU for complex mesh deformations.

## 2. Core Architectural Principles

These rules are non-negotiable and define the project's architecture.

- **Principle 1: The World Moves, The Camera is Fixed.** The main `THREE.PerspectiveCamera` MUST remain static at its initial position. It MUST NOT be moved or have controls like `OrbitControls` attached. All visual elements (image plane, 3D models) MUST be added to a single parent `THREE.Group` which acts as the "world container." All animation and movement happens by transforming this container.
- **Principle 2: Singleton Pattern for Three.js.** The project uses `src/three-singleton.js` to manage the Three.js library. All modules MUST import `THREE` from this singleton to ensure a single instance.
- **Principle 3: Manager-Based Architecture.** The project is organized into manager modules (e.g., `SceneManager`, `AudioProcessor`, `ImagePlaneManager`). Each manager is responsible for a specific domain. Code for a specific feature should be contained within its relevant manager. `main.js` is the central orchestrator that initializes managers and runs the main animation loop.
- **Principle 4: State is Managed Within Managers.** Each manager (like `ImagePlaneManager`) is responsible for its own state (e.g., `autopilot`, `state`). Do not introduce global state outside of this pattern.

## 3. Tech Stack & Key Libraries

- **Three.js Version:** r165
- **Build Tool:** Vite
- **Physics Engine:** cannon-es
- **GPGPU:** `GPUComputationRenderer` from Three.js addons.
- **Shaders:** GLSL 3, loaded from `.vert` and `.frag` files using Vite's `?raw` import.

## 4. AI Custom Instructions for Collaboration

(This is your list of 12 rules, copied directly)

1- Code Blocks Are Mandatory.
2- Provide Full Files.
3- Clear File Labeling.
4a-Avoid plain text commentary before a Markdown/Codeblock.
4b-Explain Changes After Code.
5- Wait for Permission.
6- One Error at a Time.
7- provide only only file per response.
8- Have the intuition to ask, "Hey, Look At This --> ( ASK QUESTION ABOUT PROBLEM HERE ) ".
9- Guide User by mentioning upcoming conflicts, page errors or expected crashes.
10- Provide user with git and VSCode tips, tricks and recomendations.
11- Allow time for Q/A.
12- Do not use ellipses (...).

## 5. File Structure Overview (High Level)

- **`src/main.js`**: The main entry point. Initializes all systems and contains the `animate()` loop.
- **`src/modules/`**: Contains all the core logic, separated by responsibility into manager files. This is where most development happens.
- **`src/compute/`**: Contains the GPGPU compute shader logic.
- **`src/rendering/shaders/` & `src/shaders/`**: Contains all GLSL shader code.
- **`public/`**: Contains all static assets like models, audio, and textures.

## 6. "Gotchas" & Anti-Patterns (What to Avoid)

- **DO NOT** add `OrbitControls` or any other camera-moving logic.
- **DO NOT** modify the `camera.position` or `camera.quaternion` after its initial setup in `CameraManager.js`.
- **DO NOT** add visual objects directly to the main `scene`. Add them to the `ImagePlaneManager.landscapeContainer` or `ModelManager.gltfModel` groups.
- When updating a setting in `UIManager.js`, **ALWAYS** check if the corresponding logic in the relevant manager file also needs to be updated.