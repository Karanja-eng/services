// Procedural GLSL Shaders

export const brickVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const brickFragmentShader = /* glsl */ `
  uniform vec3 uBrickColor;
  uniform vec3 uMortarColor;
  uniform float uBrickWidth;
  uniform float uBrickHeight;
  uniform float uMortarThickness;
  uniform float uBondPattern;
  varying vec2 vUv;

  float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898,78.233))) * 43758.5453);
  }

  void main() {
    float bw = uBrickWidth;
    float bh = uBrickHeight;
    float mt = uMortarThickness;
    float row = floor(vUv.y / (bh + mt));
    float offset = mod(row, 2.0) * 0.5 * bw;
    if (uBondPattern > 0.5) offset = mod(row, 2.0) * 0.25 * bw;
    float localX = mod(vUv.x + offset, bw + mt);
    float localY = mod(vUv.y, bh + mt);
    bool isMortar = localX > bw || localY > bh;
    float noiseVal = rand(floor(vec2((vUv.x + offset) / (bw + mt), vUv.y / (bh + mt))));
    vec3 brickVar = uBrickColor * (0.85 + 0.3 * noiseVal);
    float edgeDist = min(min(localX, bw - localX) / bw, min(localY, bh - localY) / bh);
    float edge = smoothstep(0.0, 0.04, edgeDist);
    vec3 col = isMortar ? uMortarColor : mix(uMortarColor * 0.9, brickVar, edge);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export const timberVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const timberFragmentShader = /* glsl */ `
  uniform vec3 uWoodLight;
  uniform vec3 uWoodDark;
  uniform float uGrainScale;
  uniform float uGrainContrast;
  uniform float uRingFrequency;
  varying vec2 vUv;

  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f*f*(3.0-2.0*f);
    float a = fract(sin(dot(i,vec2(127.1,311.7)))*43758.5453);
    float b = fract(sin(dot(i+vec2(1,0),vec2(127.1,311.7)))*43758.5453);
    float c = fract(sin(dot(i+vec2(0,1),vec2(127.1,311.7)))*43758.5453);
    float d = fract(sin(dot(i+vec2(1,1),vec2(127.1,311.7)))*43758.5453);
    return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
  }
  float fbm(vec2 p) {
    float v=0.0; float a=0.5;
    for(int i=0;i<4;i++){v+=a*noise(p);p*=2.02;a*=0.5;}
    return v;
  }
  void main() {
    vec2 uv = vUv * uGrainScale;
    float d = fbm(uv * 0.5) * 2.0;
    float ring = sin((uv.x + d) * uRingFrequency * 3.14159);
    float grain = fbm(uv * 8.0) * 0.15;
    float pattern = clamp(ring * 0.5 + 0.5 + grain, 0.0, 1.0);
    gl_FragColor = vec4(mix(uWoodDark, uWoodLight, pow(pattern, uGrainContrast)), 1.0);
  }
`;

export const concreteVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

export const concreteFragmentShader = /* glsl */ `
  uniform vec3 uBaseColor;
  uniform float uNoiseScale;
  uniform float uNoiseStrength;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p) {
    vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }
  float fbm(vec2 p){float v=0.0;float a=0.5;for(int i=0;i<5;i++){v+=a*noise(p);p*=2.1;a*=0.5;}return v;}

  void main() {
    vec2 uv = vUv * uNoiseScale;
    float n = fbm(uv) + fbm(uv * 3.7 + 17.3) * 0.5;
    vec3 col = uBaseColor * (1.0 - uNoiseStrength * (n - 0.75));
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`;
