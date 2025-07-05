import * as THREE from 'three';

export default class LightingManager {
  constructor(scene) {
    this.scene = scene;
    this.ambientLight = null;
    this.directionalLight = null;

    this.init();
  }

  init() {
    // Ambient light provides a base color to the whole scene.
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    this.scene.add(this.ambientLight);

    // Directional light acts like the sun, casting parallel rays.
    this.directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    this.directionalLight.position.set(5, 10, 7.5);
    this.scene.add(this.directionalLight);

    console.log('LightingManager initialized');
  }

  // We can add an update method later for things like orbiting the light
  update() {}
}