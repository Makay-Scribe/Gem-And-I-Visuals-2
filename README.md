# Gem-And-I-Visuals

## Operation Clean Slate: The GPGPU Engine Rebuild

### Project Overview

This is a complete, from-scratch rebuild of the Gem-And-I-Visuals project. The goal is to create a top-tier, robust, and highly expressive generative art engine for audio-reactive visuals. This new engine is being built with stability, extensibility, and performance as the highest priorities, designed to be controllable by a future AI Director.

### Architecture

The chosen architecture is a GPGPU (General-Purpose computing on GPU) pipeline implemented in Three.js, using a modern Vite-based development environment. This approach was selected after previous architectures (`onBeforeCompile` injection and NodeMaterial) proved to be unstable or unworkable for the project's long-term goals.

The core of the system involves:
1.  **Data Textures:** Using `WebGLRenderTarget` objects to store particle data (position, velocity, etc.) on the GPU.
2.  **Compute Shaders:** A series of GLSL fragment shaders that perform calculations to update the data textures each frame.
3.  **Rendering Shaders:** A final set of vertex and fragment shaders that use the data from the compute passes to render the final visual to the screen.

### Current Status

The project is in the initial phase of development, following a detailed, multi-phase roadmap.

### Development

To run this project locally:

1.  Clone the repository.
2.  Install dependencies: `npm install`
3.  Start the development server: `npm run dev`

### Roadmap

For a detailed, step-by-step plan of the project's development, please see the [ROADMAP.md](./ROADMAP.md) file.