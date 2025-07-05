import * as THREE from 'three';

// The dimensions of the texture that will store particle data.
// This should match the dimensions of your Devimage.jpeg.
const TEXTURE_WIDTH = 1024;
const TEXTURE_HEIGHT = 965;

export class ParticleSystem {
    /**
     * @param {THREE.WebGLRenderer} renderer The Three.js WebGL renderer instance.
     */
    constructor(renderer) {
        this.renderer = renderer;
        this.textureWidth = TEXTURE_WIDTH;
        this.textureHeight = TEXTURE_HEIGHT;
        this.particleCount = this.textureWidth * this.textureHeight;

        this.positionTexture = null; // This will hold the particle position data.
    }

    /**
     * Asynchronously initializes the particle system by creating the initial data textures.
     * This must be called before the particle system can be used.
     */
    async init() {
        console.log(`Initializing particle system with ${this.particleCount} particles.`);
        // Corrected the full path to the image.
        this.positionTexture = await this._createPositionTextureFromImage('/Devmedia/Devimage.jpeg');
    }

    /**
     * Loads an image and creates a THREE.DataTexture from its pixel data.
     * Each particle's (x, y) corresponds to the pixel grid, and z is the pixel brightness.
     * @param {string} imageUrl The URL of the image to load.
     * @returns {Promise<THREE.DataTexture>} A promise that resolves with the data texture.
     * @private
     */
    _createPositionTextureFromImage(imageUrl) {
        return new Promise((resolve, reject) => {
            const textureLoader = new THREE.TextureLoader();
            textureLoader.load(
                imageUrl,
                (imageTexture) => {
                    const canvas = document.createElement('canvas');
                    canvas.width = this.textureWidth;
                    canvas.height = this.textureHeight;
                    const context = canvas.getContext('2d');
                    // Draw the loaded image onto the canvas to read its pixel data.
                    context.drawImage(imageTexture.image, 0, 0, this.textureWidth, this.textureHeight);
                    const imageData = context.getImageData(0, 0, this.textureWidth, this.textureHeight).data;

                    // Create a Float32Array to hold our particle data.
                    // Each particle needs 4 floats (r, g, b, a) for (x, y, z, w).
                    const data = new Float32Array(this.particleCount * 4);

                    for (let i = 0; i < this.particleCount; i++) {
                        const stride = i * 4;

                        // Map particle index back to 2D image coordinates.
                        const x = (i % this.textureWidth) / this.textureWidth - 0.5;
                        const y = Math.floor(i / this.textureWidth) / this.textureHeight - 0.5;

                        // Use the red channel of the pixel for the z-coordinate (height).
                        const z = imageData[stride] / 255.0;

                        // Scale the positions to make the shape more visible in the scene.
                        data[stride] = x * 20;     // Position X
                        data[stride + 1] = y * 20; // Position Y
                        data[stride + 2] = z * 5;  // Position Z (height from image brightness)
                        data[stride + 3] = 0.0;    // W component (can be used for lifetime, etc. later)
                    }

                    // Create the final DataTexture.
                    const texture = new THREE.DataTexture(
                        data,
                        this.textureWidth,
                        this.textureHeight,
                        THREE.RGBAFormat,
                        THREE.FloatType // Use full float precision for positions.
                    );
                    texture.needsUpdate = true; // Important!

                    console.log("Created initial position texture from image.");
                    resolve(texture);
                },
                undefined, // onProgress callback (not needed)
                (error) => {
                    console.error('An error occurred while loading the texture.', error);
                    reject(error);
                }
            );
        });
    }

    /**
     * This method will eventually run our compute shader each frame.
     */
    update() {
        // To be implemented.
    }
}