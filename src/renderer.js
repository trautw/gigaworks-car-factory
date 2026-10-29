// Renderer, lighting, sky, environment reflections and post-processing.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export class View {
  constructor(container) {
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.pixelRatio = Math.min(devicePixelRatio, 1.5);
    r.setPixelRatio(this.pixelRatio);
    r.setSize(innerWidth, innerHeight);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.92;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = true;
    r.info.autoReset = false;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(r.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xd3e2ee, 300, 1500);
    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1500);
    this.camera.position.set(-46, 3, 50);

    // image-based lighting from a procedural room (reflections on paint)
    const pmrem = new THREE.PMREMGenerator(r);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envMap;
    this.scene.environmentIntensity = 0.55;

    // procedural gradient sky dome with a sun glow
    this.sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(40), THREE.MathUtils.degToRad(25));
    const sky = this.sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { sun: { value: this.sunDir }, top: { value: new THREE.Color(0x2f6fc4) }, mid: { value: new THREE.Color(0x8fbbe6) }, horizon: { value: new THREE.Color(0xdde9f2) } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
      fragmentShader: `uniform vec3 sun, top, mid, horizon; varying vec3 vDir;
        void main(){
          float h = max(vDir.y, 0.0);
          vec3 c = mix(horizon, mid, smoothstep(0.0, 0.18, h));
          c = mix(c, top, smoothstep(0.18, 0.75, h));
          float s = max(dot(normalize(vDir), normalize(sun)), 0.0);
          c += vec3(1.0, 0.92, 0.75) * (pow(s, 600.0) * 6.0 + pow(s, 12.0) * 0.25);
          if (vDir.y < 0.0) c = mix(horizon, vec3(0.55, 0.6, 0.62), smoothstep(0.0, -0.2, vDir.y));
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }));
    sky.frustumCulled = false;
    this.scene.add(sky);

    // lights
    this.hemi = new THREE.HemisphereLight(0xdfe9ff, 0x3a3936, 0.7);
    this.scene.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight(0xfff1dd, 2.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    const sc = sun.shadow.camera;
    sc.left = -80; sc.right = 80; sc.top = 80; sc.bottom = -80; sc.near = 1; sc.far = 400;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    this.scene.add(sun, sun.target);
    // interior fill (no shadows) so the hall reads well under its roof
    this.fill = new THREE.DirectionalLight(0xe8f0ff, 0.9);
    this.fill.position.set(-30, 50, 40);
    this.scene.add(this.fill);

    // post
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(r, rt);
    this.composer.setPixelRatio(this.pixelRatio);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.5, 0.45, 2.6);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.composer.setSize(innerWidth, innerHeight);

    addEventListener('resize', () => this.resize());
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
    this.composer.setSize(innerWidth, innerHeight);
  }

  /** Keep the shadow frustum centred around the point of interest. */
  followShadow(p) {
    const s = this.sun;
    const snap = 2;
    const x = Math.round(p.x / snap) * snap, z = Math.round(p.z / snap) * snap;
    s.target.position.set(x, 0, z);
    s.position.set(x + this.sunDir.x * 200, this.sunDir.y * 200, z + this.sunDir.z * 200);
    s.target.updateMatrixWorld();
  }

  render() {
    this.renderer.info.reset();
    this.composer.render();
  }
}
