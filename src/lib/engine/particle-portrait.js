/*!
 * particle-portrait.js
 * A living particle portrait for your website, rendered with three.js.
 * Made with https://particle-portrait.chelvynkleden.com
 *
 * MIT License — free to use, modify and ship.
 *
 * Usage:
 *   import { createPortrait } from "./particle-portrait.js";
 *
 *   const portrait = createPortrait(document.getElementById("portrait"));
 *   portrait.setTheme("dark");
 *   portrait.destroy(); // when the element is removed
 *
 * The container needs a size (e.g. `height: 600px`); the canvas fills it.
 */
import * as THREE from "three";

// Filled in by the export step. The tool passes images and options directly.
const EMBEDDED_OPTIONS = /*__PP_OPTIONS__*/ {};
const EMBEDDED_IMAGES = /*__PP_IMAGES__*/ [];

const DEFAULTS = deepFreeze({
  image: null, // PNG data URL / URL, or an array of them to morph between
  density: 150, // sample width in px (120–360)
  sharpen: 1.1, // unsharp mask strength (0–3)
  autoLevels: true, // stretch each photo's tones to full black-to-white
  brightness: 0, // -0.5–0.5
  contrast: 1, // 0.5–2
  pointSize: 1, // particle size multiplier
  theme: "auto", // "auto" | "light" | "dark"
  colors: {
    light: { main: "#0a0a0a", shadow: "#6b6b6b" },
    dark: { main: "#f2f2f2", shadow: "#8c8c8c" },
  },
  opacity: { light: 1, dark: 1 },
  align: "center", // "left" | "center" | "right"
  fill: 0.9, // portrait height relative to the container (0.5–1.2)
  edgeFade: 1, // dissolve the photo's hard crop at the sides and bottom (0–1)
  intro: { enabled: true, duration: 3 },
  morph: { auto: true, hold: 5.5, duration: 2.4 },
  mouseRepel: 90, // repel radius in px, 0 = off
  tilt: 4, // parallax tilt toward the cursor in degrees, 0 = off
  scrollScatter: true,
  shimmer: 1, // 0 = off
  dust: 160, // loose floating particles, 0 = off
  mobile: { enabled: true, densityScale: 0.6 },
  alt: "Particle portrait",
  onReady: null,
  onShow: null,
});

/** The engine's default options (read-only). */
export const DEFAULT_OPTIONS = DEFAULTS;

function deepFreeze(object) {
  for (const value of Object.values(object)) {
    if (value && typeof value === "object") deepFreeze(value);
  }
  return Object.freeze(object);
}

const MIN_ALPHA = 0.5;
const LEVELS_CLIP = 0.01; // auto-levels ignores the darkest and brightest 1%
const KEEP = 0.82; // fraction of pixels kept — a light stipple reads better than a full grid
const MAX_WIDTH = 1.1; // portrait may overflow the container a little; its edges are faded
const MOBILE_QUERY = "(max-width: 768px)";
const MAX_DPR = 2;
const DEPTH = 60; // px of relief between the darkest and brightest particles, for tilt
const SWIRL = 30; // px of curl on the path between two portraits
// Natural length (s) of each transition before `duration` scaling.
const NATURAL_INTRO = 3;
const NATURAL_MORPH = 2.9;

const VERTEX = /* glsl */ `
  attribute float aSeed;
  attribute vec4 aFrom; // nx, ny, luminance, fade
  attribute vec4 aTo;

  uniform vec2 uResolution;
  uniform float uDpr;
  uniform float uTime;
  uniform float uStart;
  uniform float uSpeed;
  uniform float uIntro;
  uniform vec4 uFromRect; // left, top, width, height in px
  uniform vec4 uToRect;
  uniform float uToAspect;
  uniform float uSwirl;
  uniform vec2 uMouse;
  uniform float uRepel;
  uniform float uRadius;
  uniform vec2 uTilt;
  uniform float uScatter;
  uniform float uShimmer;
  uniform float uInvert;
  uniform float uBrightness;
  uniform float uContrast;
  uniform float uCell;
  uniform float uPointSize;
  uniform vec3 uMain;
  uniform vec3 uShadow;
  uniform float uOpacity;

  varying vec4 vColor;

  float hash(float n) {
    return fract(sin(n) * 43758.5453);
  }

  // Damped spring from 0 to 1 (overshoots slightly, then settles).
  float spring(float s, float a, float w) {
    if (s <= 0.0) return 0.0;
    return 1.0 - exp(-a * s) * (cos(w * s) + a / w * sin(w * s));
  }

  void main() {
    float seed = aSeed;
    float t = (uTime - uStart) * uSpeed;
    vec2 toPos = uToRect.xy + aTo.xy * uToRect.zw;
    vec2 pos;
    float lum;
    float fade;

    if (uIntro > 0.5) {
      // Gather from dust: the face first, the edges follow.
      float fromFace = length(vec2(aTo.x - 0.5, (aTo.y - 0.35) / uToAspect));
      float s = t - (0.1 + fromFace * 1.4 + seed * 0.5);
      float angle = hash(seed * 3.1 + 1.0) * 6.2831853;
      float dist = 40.0 + pow(hash(seed * 7.7 + 2.0), 1.6) * length(uResolution) * 0.55;
      vec2 start = toPos + vec2(cos(angle), sin(angle)) * dist;
      start += vec2(sin(uTime * 0.8 + seed * 90.0), cos(uTime * 0.6 + seed * 70.0)) * 6.0;
      pos = mix(start, toPos, spring(s, 4.5, 4.21));
      lum = aTo.z;
      fade = aTo.w * smoothstep(-0.3, 0.6, s);
    } else {
      // Morph: a wave from the top of the old portrait to the bottom, curling like dust.
      vec2 fromPos = uFromRect.xy + aFrom.xy * uFromRect.zw;
      float s = t - (0.05 + aFrom.y * 0.9 + seed * 0.35);
      pos = mix(fromPos, toPos, spring(s, 3.0, 2.6));
      float curl = sin(3.14159265 * clamp(s / 1.2, 0.0, 1.0)) * uSwirl;
      pos += vec2(cos(seed * 80.0 + s * 3.0), sin(seed * 60.0 + s * 3.0)) * curl;
      float m = smoothstep(-0.1, 0.8, s);
      lum = mix(aFrom.z, aTo.z, m);
      fade = mix(aFrom.w, aTo.w, m);
    }

    lum = clamp((lum - 0.5) * uContrast + 0.5 + uBrightness, 0.0, 1.0);

    // Light theme: dark pixels become solid ink. Dark theme: bright pixels glow.
    float ink = mix(lum, 1.0 - lum, uInvert);
    float tone = pow(smoothstep(0.03, 0.97, ink), 0.9);
    float alpha = (0.12 + 0.88 * tone) * fade;

    alpha *= 1.0 - uShimmer * (0.14 - 0.14 * sin(uTime * 2.0 + seed * 50.0));
    pos += vec2(sin(uTime * 1.7 + seed * 40.0), cos(uTime * 1.3 + seed * 31.0)) * 0.3 * uShimmer;

    pos += uTilt * (tone - 0.5) * ${DEPTH.toFixed(1)};

    vec2 away = pos - uMouse;
    float d = length(away);
    if (uRepel > 0.0 && d < uRadius && d > 0.001) {
      float f = 1.0 - d / uRadius;
      pos += away / d * f * f * uRadius * 0.7 * uRepel;
    }

    float sa = hash(seed * 13.0 + 5.0) * 6.2831853;
    pos += vec2(cos(sa), sin(sa)) * uScatter * (80.0 + seed * 320.0) + vec2(0.0, -120.0 * uScatter);
    alpha *= 1.0 - uScatter * 0.8;

    gl_PointSize = max(1.0, uCell * (0.3 + 0.3 * tone)) * uPointSize * uDpr;
    gl_Position = vec4(pos.x / uResolution.x * 2.0 - 1.0, 1.0 - pos.y / uResolution.y * 2.0, 0.0, 1.0);
    vColor = vec4(mix(uShadow, uMain, tone), alpha * uOpacity);
  }
`;

const DUST_VERTEX = /* glsl */ `
  attribute vec4 aDust; // x, y, drift seed, alpha

  uniform vec2 uResolution;
  uniform float uDpr;
  uniform float uTime;
  uniform float uScatter;
  uniform vec3 uMain;
  uniform float uOpacity;

  varying vec4 vColor;

  void main() {
    vec2 size = uResolution + 8.0;
    float vx = (aDust.z - 0.5) * 8.0;
    float vy = 2.0 + fract(aDust.z * 7.31) * 6.0;
    float x = mod(aDust.x * size.x + vx * uTime, size.x) - 4.0;
    float y = mod(aDust.y * size.y - vy * uTime, size.y) - 4.0;
    gl_PointSize = uDpr;
    gl_Position = vec4(x / uResolution.x * 2.0 - 1.0, 1.0 - y / uResolution.y * 2.0, 0.0, 1.0);
    vColor = vec4(uMain, aDust.w * uOpacity * (1.0 - uScatter * 0.5));
  }
`;

const FRAGMENT = /* glsl */ `
  varying vec4 vColor;

  void main() {
    if (vColor.a < 0.004) discard;
    gl_FragColor = vColor;
  }
`;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function merge(base, patch) {
  const out = { ...base };
  if (!isObject(patch)) return out;
  for (const key of Object.keys(patch)) {
    const value = patch[key];
    if (value === undefined) continue;
    out[key] = isObject(value) && isObject(base[key]) ? merge(base[key], value) : value;
  }
  return out;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// Deterministic noise so the stipple pattern is stable between rebuilds.
function hash(x, y) {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function toList(image) {
  if (Array.isArray(image)) return image.filter(Boolean);
  return image ? [image] : [];
}

function loadImage(src) {
  const img = new Image();
  if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
  img.decoding = "async";
  img.src = src;
  return img.decode().then(() => img);
}

/** Remaps luminance so the visible subject spans the full 0–1 range. */
function stretchLevels(lum, alpha) {
  const histogram = new Uint32Array(256);
  let total = 0;
  for (let i = 0; i < lum.length; i++) {
    if (alpha[i] < MIN_ALPHA) continue;
    histogram[Math.min(255, Math.floor(lum[i] * 256))]++;
    total++;
  }
  if (!total) return;
  let low = 0;
  let high = 255;
  for (let seen = 0; low < 255 && seen + histogram[low] <= total * LEVELS_CLIP; low++) {
    seen += histogram[low];
  }
  for (let seen = 0; high > 0 && seen + histogram[high] <= total * LEVELS_CLIP; high--) {
    seen += histogram[high];
  }
  const lo = low / 256;
  const range = (high + 1) / 256 - lo;
  if (range < 0.05) return; // flat image: leave it alone
  for (let i = 0; i < lum.length; i++) lum[i] = clamp((lum[i] - lo) / range, 0, 1);
}

/** Turns a portrait into row-major particles: position, luminance and fade. */
function sample(img, cols, sharpen, edgeFade, autoLevels) {
  const rows = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * cols));
  const canvas = document.createElement("canvas");
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, cols, rows);
  const data = ctx.getImageData(0, 0, cols, rows).data;

  const lum = new Float32Array(cols * rows);
  const alpha = new Float32Array(cols * rows);
  for (let i = 0; i < cols * rows; i++) {
    lum[i] = (0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]) / 255;
    alpha[i] = data[i * 4 + 3] / 255;
  }
  if (autoLevels) stretchLevels(lum, alpha);

  const out = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (alpha[i] < MIN_ALPHA) continue;

      const nx = (x + 0.5) / cols;
      const ny = (y + 0.5) / rows;
      // Dissolve the hard crop at the sides and bottom into dust.
      const edge = smoothstep(0, 0.14, Math.min(nx, 1 - nx)) * smoothstep(0, 0.26, 1 - ny);
      const fade = 1 - edgeFade + edgeFade * edge;
      if (hash(y + 0.17, x + 0.31) > KEEP * Math.pow(fade, 0.6)) continue;

      // Unsharp mask against a 3x3 box blur.
      let blur = 0;
      let n = 0;
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const sx = x + ox;
          const sy = y + oy;
          if (sx < 0 || sy < 0 || sx >= cols || sy >= rows) continue;
          blur += lum[sy * cols + sx];
          n++;
        }
      }

      out.push(
        nx + (hash(x + 0.5, y) - 0.5) * (0.7 / cols),
        ny + (hash(y + 0.5, x) - 0.5) * (0.7 / rows),
        clamp(lum[i] + sharpen * (lum[i] - blur / n), 0, 1),
        fade,
      );
    }
  }
  return { aspect: cols / rows, data: out, count: out.length / 4 };
}

/**
 * Spreads every portrait evenly over one pool of particles, in row-major order,
 * so particle i lands on roughly the same row in each portrait. Pool slots a
 * smaller portrait doesn't need get fade = 0.
 */
function buildPool(sampled) {
  const total = Math.max(1, ...sampled.map((s) => s.count));
  const targets = sampled.map((s) => {
    const array = new Float32Array(total * 4);
    let prev = -1;
    for (let i = 0; i < total; i++) {
      const j = Math.floor((i * s.count) / total);
      array[i * 4] = s.data[j * 4];
      array[i * 4 + 1] = s.data[j * 4 + 1];
      array[i * 4 + 2] = s.data[j * 4 + 2];
      array[i * 4 + 3] = j === prev ? 0 : s.data[j * 4 + 3];
      prev = j;
    }
    return { aspect: s.aspect, count: s.count, data: array };
  });
  const seeds = new Float32Array(total);
  for (let i = 0; i < total; i++) seeds[i] = hash(i * 0.618, 1.37);
  return { total, targets, seeds };
}

let colorContext = null;

/** Any CSS color → [r, g, b] in 0–1 (sRGB, written straight to the canvas). */
function parseColor(value, fallback) {
  colorContext = colorContext || document.createElement("canvas").getContext("2d");
  colorContext.fillStyle = fallback;
  colorContext.fillStyle = value;
  const hex = colorContext.fillStyle;
  if (hex.startsWith("#")) {
    return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  }
  const parts = hex.match(/[\d.]+/g) || ["0", "0", "0"];
  return parts.slice(0, 3).map((v) => Number(v) / 255);
}

/**
 * Creates a particle portrait inside `container`.
 * @param {HTMLElement} container
 * @param {object} [options]
 */
export function createPortrait(container, options = {}) {
  if (!container) throw new Error("createPortrait: a container element is required");

  const doc = container.ownerDocument;
  const win = doc.defaultView;
  const root = doc.documentElement;
  const mqDark = win.matchMedia("(prefers-color-scheme: dark)");
  const mqReduce = win.matchMedia("(prefers-reduced-motion: reduce)");
  const mqMobile = win.matchMedia(MOBILE_QUERY);

  let opts = merge(merge(DEFAULTS, EMBEDDED_OPTIONS), options);
  let destroyed = false;
  let readyFired = false;

  // GL state (only while mounted)
  let canvas = null;
  let renderer = null;
  let scene = null;
  let camera = null;
  let points = null;
  let material = null;
  let dustPoints = null;
  let dustMaterial = null;
  let fallback = null;

  // Particle data
  let pool = null;
  let loadToken = 0;
  let sampledKey = "";
  let sampledImages = "";
  let boundFrom = -1;
  let boundTo = -1;

  // Layout
  let width = 0;
  let height = 0;
  let rects = [];

  // Animation
  let raf = 0;
  let last = 0;
  let clock = 0;
  let visible = !doc.hidden;
  let inView = true;
  let motion = !mqReduce.matches;
  const pointer = { x: -1e4, y: -1e4, tx: -1e4, ty: -1e4, active: false, repel: 0, nx: 0, ny: 0 };
  const tilt = { x: 0, y: 0 };
  let scrollTarget = 0;
  let scroll = 0;

  // Transitions: which portrait particles leave (`from`) and head to (`to`).
  let from = 0;
  let to = 0;
  let mode = "idle"; // "intro" | "morph" | "idle"
  let transitionStart = 0;
  let transitionEnd = 0;
  let idleSince = 0;
  let queued = -1;

  function images() {
    const list = toList(opts.image);
    return list.length ? list : EMBEDDED_IMAGES;
  }

  function isMobile() {
    return mqMobile.matches;
  }

  function isDark() {
    if (opts.theme === "dark") return true;
    if (opts.theme === "light") return false;
    if (root.classList.contains("dark") || root.dataset.theme === "dark") return true;
    if (root.classList.contains("light") || root.dataset.theme === "light") return false;
    return mqDark.matches;
  }

  function shouldRun() {
    return !(isMobile() && opts.mobile.enabled === false);
  }

  function sampleKey() {
    const scale = isMobile() ? opts.mobile.densityScale : 1;
    return JSON.stringify([
      images(),
      opts.density,
      scale,
      opts.sharpen,
      opts.edgeFade,
      !!opts.autoLevels,
    ]);
  }

  // ---------------------------------------------------------------- mount

  function showFallback() {
    const src = images()[0];
    if (fallback || !src) return;
    fallback = doc.createElement("img");
    fallback.src = src;
    fallback.alt = opts.alt;
    fallback.style.cssText =
      "display:block;width:100%;height:100%;object-fit:contain;object-position:50% 100%;";
    container.appendChild(fallback);
  }

  function hideFallback() {
    if (!fallback) return;
    fallback.remove();
    fallback = null;
  }

  function mount() {
    if (renderer) return true;
    canvas = doc.createElement("canvas");
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", opts.alt);
    canvas.style.cssText = "display:block;width:100%;height:100%;touch-action:pan-y;";
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: false,
        powerPreference: "high-performance",
      });
    } catch {
      canvas = null;
      renderer = null;
      showFallback();
      return false;
    }
    hideFallback();
    renderer.setClearColor(0x000000, 0);
    container.appendChild(canvas);

    scene = new THREE.Scene();
    camera = new THREE.Camera(); // positions are computed in clip space directly

    const shared = {
      uResolution: { value: new THREE.Vector2(1, 1) },
      uDpr: { value: 1 },
      uTime: { value: 0 },
      uScatter: { value: 0 },
      uMain: { value: new THREE.Vector3() },
      uOpacity: { value: 1 },
    };
    material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        ...shared,
        uStart: { value: 0 },
        uSpeed: { value: 1 },
        uIntro: { value: 0 },
        uFromRect: { value: new THREE.Vector4() },
        uToRect: { value: new THREE.Vector4() },
        uToAspect: { value: 1 },
        uSwirl: { value: SWIRL },
        uMouse: { value: new THREE.Vector2(-1e4, -1e4) },
        uRepel: { value: 0 },
        uRadius: { value: 90 },
        uTilt: { value: new THREE.Vector2() },
        uShimmer: { value: 1 },
        uInvert: { value: 0 },
        uBrightness: { value: 0 },
        uContrast: { value: 1 },
        uCell: { value: 4 },
        uPointSize: { value: 1 },
        uShadow: { value: new THREE.Vector3() },
      },
    });
    dustMaterial = new THREE.ShaderMaterial({
      vertexShader: DUST_VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      // Same objects, so shared uniforms only need setting once.
      uniforms: shared,
    });

    buildDust();
    resize();
    applyStyle();
    if (pool) {
      buildPoints();
      setTransitionUniforms();
    }
    return true;
  }

  function unmount() {
    stopLoop();
    if (points) {
      points.geometry.dispose();
      scene.remove(points);
      points = null;
    }
    if (dustPoints) {
      dustPoints.geometry.dispose();
      scene.remove(dustPoints);
      dustPoints = null;
    }
    material?.dispose();
    dustMaterial?.dispose();
    material = null;
    dustMaterial = null;
    if (renderer) {
      renderer.dispose();
      renderer.forceContextLoss();
      renderer = null;
    }
    canvas?.remove();
    canvas = null;
    scene = null;
    camera = null;
  }

  // ---------------------------------------------------------------- data

  function resample() {
    // Nothing to sample for when the engine isn't running (no WebGL, or off on mobile).
    if (!renderer) return;
    const list = images();
    const key = sampleKey();
    if (!list.length || key === sampledKey) return;
    sampledKey = key;
    const imagesKey = JSON.stringify(list);
    const token = ++loadToken;
    const cols = Math.max(
      8,
      Math.round(clamp(opts.density, 40, 600) * (isMobile() ? opts.mobile.densityScale : 1)),
    );
    Promise.all(list.map(loadImage))
      .then((imgs) => {
        if (destroyed || token !== loadToken) return;
        const sampled = imgs.map((img) =>
          sample(
            img,
            cols,
            clamp(opts.sharpen, 0, 3),
            clamp(opts.edgeFade, 0, 1),
            !!opts.autoLevels,
          ),
        );
        const newImages = imagesKey !== sampledImages;
        sampledImages = imagesKey;
        pool = buildPool(sampled);
        pool.cols = cols;
        from = to = newImages ? 0 : Math.min(to, pool.targets.length - 1);
        queued = -1;
        layout();
        buildPoints();
        // New photos gather from dust; a density or sharpen change just swaps in place.
        if (newImages) startIntro();
        else settle();
        wake();
      })
      .catch((error) => {
        if (token === loadToken) sampledKey = "";
        console.error("particle-portrait: could not load image", error);
      });
  }

  function buildPoints() {
    if (!scene || !pool) return;
    if (points) {
      points.geometry.dispose();
      scene.remove(points);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pool.total * 3), 3));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(pool.seeds, 1));
    geometry.setAttribute("aFrom", new THREE.BufferAttribute(new Float32Array(pool.total * 4), 4));
    geometry.setAttribute("aTo", new THREE.BufferAttribute(new Float32Array(pool.total * 4), 4));
    boundFrom = -1;
    boundTo = -1;
    points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    scene.add(points);
    bindTargets();
  }

  function buildDust() {
    if (!scene) return;
    if (dustPoints) {
      dustPoints.geometry.dispose();
      scene.remove(dustPoints);
      dustPoints = null;
    }
    const count = Math.max(0, Math.round(opts.dust));
    if (!count) return;
    const data = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      data[i * 4] = Math.random();
      data[i * 4 + 1] = Math.random();
      data[i * 4 + 2] = Math.random();
      data[i * 4 + 3] = 0.06 + Math.random() * 0.2;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geometry.setAttribute("aDust", new THREE.BufferAttribute(data, 4));
    dustPoints = new THREE.Points(geometry, dustMaterial);
    dustPoints.frustumCulled = false;
    scene.add(dustPoints);
  }

  // Copies portrait data into the two fixed buffers (cheap: once per transition).
  function bindTargets() {
    if (!points || !pool) return;
    if (boundFrom !== from) {
      const attribute = points.geometry.getAttribute("aFrom");
      attribute.array.set(pool.targets[from].data);
      attribute.needsUpdate = true;
      boundFrom = from;
    }
    if (boundTo !== to) {
      const attribute = points.geometry.getAttribute("aTo");
      attribute.array.set(pool.targets[to].data);
      attribute.needsUpdate = true;
      boundTo = to;
    }
    const u = material.uniforms;
    u.uFromRect.value.fromArray(rects[from] || [0, 0, 1, 1]);
    u.uToRect.value.fromArray(rects[to] || [0, 0, 1, 1]);
    u.uToAspect.value = pool.targets[to].aspect;
    u.uCell.value = rects[to] ? rects[to][2] / pool.cols : 4;
  }

  // ---------------------------------------------------------------- layout

  function layout() {
    if (!pool) return;
    const fill = clamp(opts.fill, 0.3, 1.5);
    rects = pool.targets.map((target) => {
      let drawH = height * fill;
      let drawW = drawH * target.aspect;
      if (drawW > width * MAX_WIDTH) {
        drawW = width * MAX_WIDTH;
        drawH = drawW / target.aspect;
      }
      let left = (width - drawW) / 2;
      if (opts.align === "left") left = 0;
      else if (opts.align === "right") left = width - drawW;
      // Bottom-aligned: the faded crop sits on the container's bottom edge.
      return [left, height - drawH, drawW, drawH];
    });
    bindTargets();
  }

  function resize() {
    width = Math.max(1, container.clientWidth);
    height = Math.max(1, container.clientHeight);
    if (renderer) {
      const dpr = Math.min(win.devicePixelRatio || 1, MAX_DPR);
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      material.uniforms.uResolution.value.set(width, height);
      material.uniforms.uDpr.value = dpr;
    }
    layout();
  }

  // ---------------------------------------------------------------- style

  function applyStyle() {
    if (!material) return;
    const dark = isDark();
    const palette = dark ? opts.colors.dark : opts.colors.light;
    const u = material.uniforms;
    u.uMain.value.fromArray(parseColor(palette.main, dark ? "#f2f2f2" : "#0a0a0a"));
    u.uShadow.value.fromArray(parseColor(palette.shadow, "#808080"));
    u.uOpacity.value = clamp(dark ? opts.opacity.dark : opts.opacity.light, 0, 1);
    u.uInvert.value = dark ? 0 : 1;
    u.uBrightness.value = clamp(opts.brightness, -1, 1);
    u.uContrast.value = clamp(opts.contrast, 0, 4);
    u.uPointSize.value = Math.max(0.1, opts.pointSize);
    u.uRadius.value = Math.max(1, opts.mouseRepel);
    u.uShimmer.value = motion ? clamp(opts.shimmer, 0, 3) : 0;
    u.uSpeed.value = transitionSpeed();
    if (dustPoints) dustPoints.visible = opts.dust > 0;
    if (canvas) canvas.setAttribute("aria-label", opts.alt);
    wake();
  }

  // ---------------------------------------------------------------- transitions

  function startIntro() {
    if (!pool) return;
    if (!motion || !opts.intro.enabled) return settle();
    from = to;
    mode = "intro";
    transitionStart = clock;
    transitionEnd = clock + Math.max(0.2, opts.intro.duration);
    setTransitionUniforms();
    notifyShow();
  }

  function startMorph(index) {
    if (!pool || index === to) return;
    from = to;
    to = index;
    if (!motion) return settle();
    mode = "morph";
    transitionStart = clock;
    transitionEnd = clock + Math.max(0.2, opts.morph.duration);
    setTransitionUniforms();
    notifyShow();
  }

  function settle() {
    from = to;
    mode = "idle";
    idleSince = clock;
    transitionStart = clock - 1e4;
    setTransitionUniforms();
    notifyShow();
  }

  function setTransitionUniforms() {
    if (!material) return;
    const u = material.uniforms;
    u.uIntro.value = mode === "intro" ? 1 : 0;
    u.uStart.value = transitionStart;
    u.uSpeed.value = transitionSpeed();
    bindTargets();
    wake();
  }

  // Shader timings are authored at a natural length; scale them to the chosen duration.
  function transitionSpeed() {
    return mode === "morph"
      ? NATURAL_MORPH / Math.max(0.2, opts.morph.duration)
      : NATURAL_INTRO / Math.max(0.2, opts.intro.duration);
  }

  function finishTransition() {
    mode = "idle";
    from = to;
    idleSince = clock;
    // Keep the shader in its finished state, then hand over to the next request.
    transitionStart = clock - 1e4;
    setTransitionUniforms();
    if (queued >= 0 && queued !== to) {
      const next = queued;
      queued = -1;
      startMorph(next);
    }
    queued = -1;
  }

  function notifyShow() {
    if (typeof opts.onShow === "function") opts.onShow(to);
  }

  // ---------------------------------------------------------------- loop

  function tick(now) {
    raf = 0;
    const dt = Math.min(1 / 30, Math.max(0, (now - last) / 1000));
    last = now;
    if (motion) clock += dt;

    if (mode !== "idle" && clock >= transitionEnd) finishTransition();
    if (
      mode === "idle" &&
      motion &&
      opts.morph.auto &&
      pool &&
      pool.targets.length > 1 &&
      clock - idleSince >= Math.max(0.5, opts.morph.hold)
    ) {
      startMorph((to + 1) % pool.targets.length);
    }

    // Ease the cursor so particles trail it instead of snapping.
    const ease = 1 - Math.exp(-dt * 12);
    pointer.x += (pointer.tx - pointer.x) * ease;
    pointer.y += (pointer.ty - pointer.y) * ease;
    const repelOn = motion && opts.mouseRepel > 0 && pointer.active;
    pointer.repel += ((repelOn ? 1 : 0) - pointer.repel) * (1 - Math.exp(-dt * 6));

    const maxTilt = motion ? (clamp(opts.tilt, 0, 30) * Math.PI) / 180 : 0;
    const tiltEase = 1 - Math.exp(-dt * 4);
    tilt.x += ((pointer.active ? pointer.nx : 0) * maxTilt - tilt.x) * tiltEase;
    tilt.y += ((pointer.active ? pointer.ny : 0) * maxTilt - tilt.y) * tiltEase;

    const scatterOn = motion && opts.scrollScatter;
    scroll += ((scatterOn ? scrollTarget : 0) - scroll) * (1 - Math.exp(-dt * 8));

    render();
    if (motion && visible && inView && renderer) raf = win.requestAnimationFrame(tick);
  }

  function render() {
    if (!renderer || !pool || !points) return;
    const u = material.uniforms;
    u.uTime.value = clock;
    u.uMouse.value.set(pointer.x, pointer.y);
    u.uRepel.value = pointer.repel;
    u.uTilt.value.set(Math.sin(tilt.x), Math.sin(tilt.y));
    u.uScatter.value = scroll;
    renderer.render(scene, camera);
    if (!readyFired) {
      readyFired = true;
      if (typeof opts.onReady === "function") opts.onReady();
    }
  }

  function wake() {
    if (!renderer || !pool || destroyed) return;
    if (!motion || !visible || !inView) {
      // Still portrait: draw once and stop.
      if (!raf) render();
      return;
    }
    if (raf) return;
    last = win.performance.now();
    raf = win.requestAnimationFrame(tick);
  }

  function stopLoop() {
    if (raf) win.cancelAnimationFrame(raf);
    raf = 0;
  }

  // ---------------------------------------------------------------- events

  function onPointerMove(event) {
    const rect = container.getBoundingClientRect();
    pointer.tx = event.clientX - rect.left;
    pointer.ty = event.clientY - rect.top;
    pointer.nx = clamp((pointer.tx / Math.max(1, rect.width)) * 2 - 1, -1, 1);
    pointer.ny = clamp((pointer.ty / Math.max(1, rect.height)) * 2 - 1, -1, 1);
    if (!pointer.active) {
      // Enter at the pointer, not from wherever it left.
      pointer.x = pointer.tx;
      pointer.y = pointer.ty;
    }
    pointer.active = true;
    wake();
  }

  function onPointerEnd(event) {
    if (event.type === "pointerup" && event.pointerType === "mouse") return;
    pointer.active = false;
  }

  function onScroll() {
    const rect = container.getBoundingClientRect();
    scrollTarget = clamp(-rect.top / Math.max(1, rect.height * 0.75), 0, 1);
    wake();
  }

  function onVisibility() {
    visible = !doc.hidden;
    if (visible) wake();
    else stopLoop();
  }

  function onMotionChange() {
    motion = !mqReduce.matches;
    if (!motion) {
      stopLoop();
      if (mode !== "idle") settle();
    }
    applyStyle();
  }

  function onMobileChange() {
    evaluate();
  }

  function onThemeChange() {
    applyStyle();
  }

  const resizeObserver = new win.ResizeObserver(() => {
    resize();
    wake();
  });
  const intersectionObserver = new win.IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    if (inView) wake();
    else stopLoop();
  });
  const themeObserver = new win.MutationObserver(onThemeChange);

  function evaluate() {
    if (shouldRun()) {
      if (mount()) {
        resample();
        wake();
      }
    } else {
      unmount();
      showFallback();
    }
  }

  // ---------------------------------------------------------------- start

  resizeObserver.observe(container);
  intersectionObserver.observe(container);
  themeObserver.observe(root, { attributes: true, attributeFilter: ["class", "data-theme"] });
  mqDark.addEventListener("change", onThemeChange);
  mqReduce.addEventListener("change", onMotionChange);
  mqMobile.addEventListener("change", onMobileChange);
  doc.addEventListener("visibilitychange", onVisibility);
  win.addEventListener("scroll", onScroll, { passive: true });
  container.addEventListener("pointermove", onPointerMove);
  container.addEventListener("pointerdown", onPointerMove);
  container.addEventListener("pointerup", onPointerEnd);
  container.addEventListener("pointerleave", onPointerEnd);
  container.addEventListener("pointercancel", onPointerEnd);

  evaluate();
  onScroll();

  // ---------------------------------------------------------------- API

  function show(index) {
    if (destroyed || !pool) return;
    const count = pool.targets.length;
    const target = ((index % count) + count) % count;
    if (mode !== "idle") {
      // Finish the running transition first; the latest request wins.
      queued = target;
      return;
    }
    startMorph(target);
  }

  return {
    update(partial = {}) {
      if (destroyed) return;
      const prevDust = opts.dust;
      const prevMobile = opts.mobile.enabled;
      opts = merge(opts, partial);
      if (opts.mobile.enabled !== prevMobile) evaluate();
      if (opts.dust !== prevDust) buildDust();
      resample(); // no-op unless image, density, sharpen, edgeFade, autoLevels or mobile scaling changed
      layout();
      applyStyle();
    },

    setTheme(theme) {
      if (destroyed) return;
      opts = merge(opts, { theme });
      applyStyle();
    },

    show,

    next() {
      show((queued >= 0 ? queued : to) + 1);
    },

    replay() {
      if (destroyed || !pool) return;
      queued = -1;
      startIntro();
    },

    get index() {
      return to;
    },

    get count() {
      return pool ? pool.targets[to].count : 0;
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      loadToken++;
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      themeObserver.disconnect();
      mqDark.removeEventListener("change", onThemeChange);
      mqReduce.removeEventListener("change", onMotionChange);
      mqMobile.removeEventListener("change", onMobileChange);
      doc.removeEventListener("visibilitychange", onVisibility);
      win.removeEventListener("scroll", onScroll);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerdown", onPointerMove);
      container.removeEventListener("pointerup", onPointerEnd);
      container.removeEventListener("pointerleave", onPointerEnd);
      container.removeEventListener("pointercancel", onPointerEnd);
      unmount();
      hideFallback();
      pool = null;
    },
  };
}
