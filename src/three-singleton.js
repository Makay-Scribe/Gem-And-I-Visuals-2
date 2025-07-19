// src/three-singleton.js
// This module's sole purpose is to import the Three.js library once
// and export it, creating a single, shared instance (a "singleton")
// that all other modules in our application can import from.
// This ensures we never have multiple instances of Three.js running.

import * as THREE from 'three';
export default THREE;