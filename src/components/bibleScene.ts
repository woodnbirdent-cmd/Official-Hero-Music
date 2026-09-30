import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  DirectionalLight,
  EquirectangularReflectionMapping,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NoColorSpace,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  PointLight,
  RepeatWrapping,
  Scene,
  SpotLight,
  SRGBColorSpace,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";

/**
 * One connected Bible mesh. The closed book is a single leather volume.
 * Opening swings the front board and the top half of the pages off a shared
 * spine, so the spread stays one object: leather, gilt edges, scripture.
 * Page words are King James Version (public domain), printed as texture only.
 */

const VERSES = [
  "The LORD is my shepherd; I shall not want.",
  "He maketh me to lie down in green pastures: he leadeth me beside the still waters.",
  "He restoreth my soul: he leadeth me in the paths of righteousness for his name's sake.",
  "Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me.",
  "Thou preparest a table before me in the presence of mine enemies: thou anointest my head with oil; my cup runneth over.",
  "Surely goodness and mercy shall follow me all the days of my life: and I will dwell in the house of the LORD for ever.",
  "I will lift up mine eyes unto the hills, from whence cometh my help.",
  "My help cometh from the LORD, which made heaven and earth.",
  "He will not suffer thy foot to be moved: he that keepeth thee will not slumber.",
  "Behold, he that keepeth Israel shall neither slumber nor sleep.",
  "The LORD is thy keeper: the LORD is thy shade upon thy right hand.",
  "The sun shall not smite thee by day, nor the moon by night.",
  "The LORD shall preserve thee from all evil: he shall preserve thy soul.",
  "The LORD shall preserve thy going out and thy coming in from this time forth, and even for evermore.",
  "In the beginning was the Word, and the Word was with God, and the Word was God.",
  "The same was in the beginning with God.",
  "All things were made by him; and without him was not any thing made that was made.",
  "In him was life; and the life was the light of men.",
  "And the light shineth in darkness; and the darkness comprehended it not.",
  "Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee.",
] as const;

const COVER_W = 1.7;
const COVER_H = 2.26;
const COVER_T = 0.058;
const PAGE_W = 1.52;
const PAGE_H = 2.04;
const PAGE_T = 0.44;
const HALF_T = PAGE_T / 2;
const HINGE = 0.02;

type Disposable = { dispose: () => void };

export type BibleHandle = {
  setProgress: (value: number) => void;
  resize: () => void;
  dispose: () => void;
};

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function segment(progress: number, start: number, end: number) {
  return clamp((progress - start) / (end - start));
}

function ease(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function hash(n: number) {
  let x = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

function dataTexture(canvas: HTMLCanvasElement, color: boolean) {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = color ? SRGBColorSpace : NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function pebbleField(size: number) {
  const cols = 70;
  const rows = 92;
  const jitter = new Float32Array(cols * rows * 2);
  for (let i = 0; i < cols * rows; i += 1) {
    jitter[i * 2] = 0.22 + hash(i + 3) * 0.56;
    jitter[i * 2 + 1] = 0.22 + hash(i + 19) * 0.56;
  }

  const heightAt = (u: number, v: number) => {
    const gx = u * cols;
    const gy = v * rows;
    const ix = Math.floor(gx);
    const iy = Math.floor(gy);
    let minD = 4;
    for (let oy = -1; oy <= 1; oy += 1) {
      for (let ox = -1; ox <= 1; ox += 1) {
        const cx = ix + ox;
        const cy = iy + oy;
        if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue;
        const j = (cy * cols + cx) * 2;
        const dx = gx - (cx + jitter[j]);
        const dy = gy - (cy + jitter[j + 1]);
        const d = dx * dx + dy * dy;
        if (d < minD) minD = d;
      }
    }
    const bump = Math.max(0, 1 - Math.sqrt(minD) * 2.35);
    const fine = hash(Math.floor(u * size) * 13 + Math.floor(v * size) * 7);
    return bump * bump * 0.82 + fine * 0.18;
  };

  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      height[y * size + x] = heightAt(x / (size - 1), y / (size - 1));
    }
  }
  return height;
}

function makeLeatherMaps(withTitle: boolean) {
  const width = 768;
  const height = Math.round(width * (COVER_H / COVER_W));
  const pebbles = pebbleField(width);
  const sample = (x: number, y: number) => {
    const sx = Math.max(0, Math.min(width - 1, x));
    const sy = Math.max(0, Math.min(width - 1, y));
    return pebbles[sy * width + sx];
  };

  const albedo = document.createElement("canvas");
  const normal = document.createElement("canvas");
  const rough = document.createElement("canvas");
  const metal = document.createElement("canvas");
  albedo.width = normal.width = rough.width = metal.width = width;
  albedo.height = normal.height = rough.height = metal.height = height;

  const ag = albedo.getContext("2d");
  const ng = normal.getContext("2d");
  const rg = rough.getContext("2d");
  const mg = metal.getContext("2d");
  if (!ag || !ng || !rg || !mg) throw new Error("canvas");

  const image = ag.createImageData(width, height);
  const normals = ng.createImageData(width, height);
  const roughData = rg.createImageData(width, height);
  const metalData = mg.createImageData(width, height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const u = x / (width - 1);
      const v = y / (height - 1);
      const h = sample(Math.floor((x / (width - 1)) * (width - 1)), Math.floor((y / (height - 1)) * (width - 1)));
      const wear = Math.exp(-((u - 0.5) ** 2) * 5.2 - ((v - 0.46) ** 2) * 4.4);
      const edge = Math.min(u, 1 - u, v * 0.9, (1 - v) * 0.9);
      const vignette = clamp(edge * 7);
      const crack = Math.pow(1 - h, 1.6);
      const grain = 0.42 + h * 0.85 - crack * 0.28;
      const tone = grain * (0.72 + wear * 0.7) * (0.62 + vignette * 0.5);
      const i = (y * width + x) * 4;
      image.data[i] = clamp(tone * 168 + 26, 0, 255);
      image.data[i + 1] = clamp(tone * 150 + 22, 0, 255);
      image.data[i + 2] = clamp(tone * 128 + 16, 0, 255);
      image.data[i + 3] = 255;

      const dx = sample(Math.floor(u * (width - 1)) + 1, Math.floor(v * (width - 1))) - sample(Math.floor(u * (width - 1)) - 1, Math.floor(v * (width - 1)));
      const dy = sample(Math.floor(u * (width - 1)), Math.floor(v * (width - 1)) + 1) - sample(Math.floor(u * (width - 1)), Math.floor(v * (width - 1)) - 1);
      const nx = -dx * 3.1;
      const ny = -dy * 3.1;
      const len = Math.hypot(nx, ny, 1) || 1;
      normals.data[i] = (nx / len) * 127 + 128;
      normals.data[i + 1] = (ny / len) * 127 + 128;
      normals.data[i + 2] = (1 / len) * 127 + 128;
      normals.data[i + 3] = 255;

      const roughness = clamp(210 - h * 70 - wear * 45, 70, 255);
      roughData.data[i] = roughness;
      roughData.data[i + 1] = roughness;
      roughData.data[i + 2] = roughness;
      roughData.data[i + 3] = 255;

      metalData.data[i] = 0;
      metalData.data[i + 1] = 0;
      metalData.data[i + 2] = 0;
      metalData.data[i + 3] = 255;
    }
  }

  ag.putImageData(image, 0, 0);
  ng.putImageData(normals, 0, 0);
  rg.putImageData(roughData, 0, 0);
  mg.putImageData(metalData, 0, 0);

  const paintGold = (draw: (ctx: CanvasRenderingContext2D) => void) => {
    draw(ag);
    mg.save();
    mg.globalCompositeOperation = "source-over";
    draw(mg);
    mg.restore();
  };

  const frame = (inset: number, line: number) => {
    paintGold((ctx) => {
      ctx.strokeStyle = ctx === mg ? "#ffffff" : "#e4d0a2";
      ctx.lineWidth = line;
      ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
    });
  };

  if (withTitle) {
    frame(46, 7);
    frame(62, 3);
    frame(74, 2);
    ag.save();
    ag.textAlign = "center";
    ag.textBaseline = "middle";
    ag.font = "600 42px 'Noto Serif', Georgia, serif";
    const label = "HOLY BIBLE";
    const y = height * 0.47;
    ag.fillStyle = "rgba(0,0,0,0.6)";
    ag.fillText(label, width / 2 + 1, y + 3);
    ag.fillStyle = "#e6d3a4";
    ag.fillText(label, width / 2, y);
    ag.strokeStyle = "#c6a86a";
    ag.lineWidth = 2;
    ag.beginPath();
    ag.moveTo(width * 0.3, y - 46);
    ag.lineTo(width * 0.7, y - 46);
    ag.moveTo(width * 0.34, y + 42);
    ag.lineTo(width * 0.66, y + 42);
    ag.stroke();
    ag.restore();

    mg.save();
    mg.fillStyle = "#ffffff";
    mg.fillRect(width * 0.28, yForMetal(height) , width * 0.44, 8);
    mg.restore();
  }

  return {
    map: dataTexture(albedo, true),
    normalMap: dataTexture(normal, false),
    roughnessMap: dataTexture(rough, false),
    metalnessMap: dataTexture(metal, false),
  };
}

function yForMetal(height: number) {
  return height * 0.47 - 18;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function makePageCanvas(gutter: "left" | "right") {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1360;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");

  ctx.fillStyle = "#efe4cf";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const specks = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < specks.data.length; i += 16) {
    const n = (hash(i + 11) - 0.5) * 16;
    specks.data[i] = clamp(specks.data[i] + n, 0, 255);
    specks.data[i + 1] = clamp(specks.data[i + 1] + n * 0.95, 0, 255);
    specks.data[i + 2] = clamp(specks.data[i + 2] + n * 0.7, 0, 255);
  }
  ctx.putImageData(specks, 0, 0);

  const gutterX = gutter === "left" ? 0 : canvas.width - 110;
  const shade = ctx.createLinearGradient(gutterX, 0, gutterX + (gutter === "left" ? 110 : -110), 0);
  shade.addColorStop(0, "rgba(62, 42, 22, 0.34)");
  shade.addColorStop(1, "rgba(62, 42, 22, 0)");
  ctx.fillStyle = shade;
  ctx.fillRect(gutter === "left" ? 0 : canvas.width - 110, 0, 110, canvas.height);

  ctx.fillStyle = "#141414";
  ctx.textBaseline = "top";
  const columns = gutter === "left" ? [78, 540] : [64, 526];
  columns.forEach((x, column) => {
    let y = 52;
    ctx.font = "700 28px 'Noto Serif', Georgia, serif";
    ctx.fillText(column === 0 ? "PSALM 23" : "PSALM 121", x, y);
    y += 44;
    let verse = column * 5;
    const colW = 400;
    while (y < canvas.height - 70 && verse < VERSES.length + 8) {
      const text = VERSES[verse % VERSES.length];
      ctx.font = "700 30px 'Noto Serif', Georgia, serif";
      const lines = wrapLines(ctx, text, colW - 36);
      ctx.font = "700 16px 'Noto Serif', Georgia, serif";
      ctx.fillStyle = "#7a2424";
      ctx.fillText(String((verse % VERSES.length) + 1), x, y + 6);
      ctx.fillStyle = "#141414";
      ctx.font = "700 30px 'Noto Serif', Georgia, serif";
      lines.forEach((line, index) => {
        ctx.fillText(line, x + (index === 0 ? 32 : 0), y);
        y += 36;
      });
      y += 16;
      verse += 1;
    }
  });

  return canvas;
}

function makeGiltMaps() {
  const width = 32;
  const height = 48;
  const color = document.createElement("canvas");
  const normal = document.createElement("canvas");
  color.width = normal.width = width;
  color.height = normal.height = height;
  const cg = color.getContext("2d");
  const ng = normal.getContext("2d");
  if (!cg || !ng) throw new Error("canvas");
  const image = cg.createImageData(width, height);
  const normals = ng.createImageData(width, height);
  for (let y = 0; y < height; y += 1) {
    const t = (y % 4) / 4;
    const crease = t < 0.12 ? 0.84 : 1;
    const shine = t > 0.45 && t < 0.62 ? 1.08 : 1;
    const r = clamp(214 * crease * shine, 0, 255);
    const g = clamp(176 * crease * shine, 0, 255);
    const b = clamp(104 * crease * shine, 0, 255);
      const groove = t < 0.12 ? -0.45 : 0.2;
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const speckle = hash(x * 17 + y * 3) * 18;
      image.data[i] = clamp(r + speckle, 0, 255);
      image.data[i + 1] = clamp(g + speckle * 0.8, 0, 255);
      image.data[i + 2] = clamp(b + speckle * 0.35, 0, 255);
      image.data[i + 3] = 255;
      const nx = groove * 0.65;
      const len = Math.hypot(nx, 0, 1);
      normals.data[i] = 128;
      normals.data[i + 1] = (nx / len) * 127 + 128;
      normals.data[i + 2] = (1 / len) * 127 + 128;
      normals.data[i + 3] = 255;
    }
  }
  cg.putImageData(image, 0, 0);
  ng.putImageData(normals, 0, 0);
  const map = dataTexture(color, true);
  const normalMap = dataTexture(normal, false);
  map.wrapS = map.wrapT = RepeatWrapping;
  normalMap.wrapS = normalMap.wrapT = RepeatWrapping;
  return { map, normalMap };
}

function makeGlowCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  const glow = ctx.createRadialGradient(256, 150, 8, 256, 140, 230);
  glow.addColorStop(0, "rgba(255, 214, 140, 0.95)");
  glow.addColorStop(0.4, "rgba(190, 150, 80, 0.35)");
  glow.addColorStop(1, "rgba(190, 150, 80, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 512, 256);
  return canvas;
}

function makeEnvCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = "#050403";
  ctx.fillRect(0, 0, 1024, 512);
  const key = ctx.createRadialGradient(760, 150, 8, 760, 170, 260);
  key.addColorStop(0, "#fff8ea");
  key.addColorStop(0.25, "#f0d7a4");
  key.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = key;
  ctx.fillRect(0, 0, 1024, 512);
  const rim = ctx.createRadialGradient(180, 210, 6, 200, 220, 180);
  rim.addColorStop(0, "#e7c48a");
  rim.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, 1024, 512);
  ctx.fillStyle = "#14110e";
  ctx.fillRect(0, 340, 1024, 172);
  return canvas;
}

function cloneGilt(
  source: { map: CanvasTexture; normalMap: CanvasTexture },
  repeat: Vector2,
  keep: (texture: Texture) => Texture,
) {
  const map = source.map.clone();
  const normalMap = source.normalMap.clone();
  map.repeat.copy(repeat);
  normalMap.repeat.copy(repeat);
  map.wrapS = map.wrapT = RepeatWrapping;
  normalMap.wrapS = normalMap.wrapT = RepeatWrapping;
  keep(map);
  keep(normalMap);
  return { map, normalMap };
}

export function mountBible(canvas: HTMLCanvasElement, initialProgress = 0): BibleHandle {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x000000, 1);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.08, 40);
  const bin: Disposable[] = [];
  const keep = <T extends Disposable>(item: T) => {
    bin.push(item);
    return item;
  };

  const envImage = dataTexture(makeEnvCanvas(), true);
  envImage.mapping = EquirectangularReflectionMapping;
  const pmrem = new PMREMGenerator(renderer);
  const envTarget = pmrem.fromEquirectangular(envImage);
  scene.environment = envTarget.texture;
  envImage.dispose();
  pmrem.dispose();
  bin.push(envTarget);

  const anisotropy = renderer.capabilities.getMaxAnisotropy();

  const leatherOutside = makeLeatherMaps(true);
  const leatherInside = makeLeatherMaps(false);
  const pageRight = dataTexture(makePageCanvas("left"), true);
  const pageLeft = dataTexture(makePageCanvas("right"), true);
  const gilt = makeGiltMaps();
  const glowMap = dataTexture(makeGlowCanvas(), true);
  [leatherOutside, leatherInside].forEach((set) => {
    keep(set.map);
    keep(set.normalMap);
    keep(set.roughnessMap);
    keep(set.metalnessMap);
    set.map.anisotropy = anisotropy;
    set.normalMap.anisotropy = anisotropy;
  });
  [pageRight, pageLeft].forEach((texture) => {
    texture.generateMipmaps = false;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.anisotropy = 1;
    texture.needsUpdate = true;
    keep(texture);
  });
  [gilt.map, gilt.normalMap, glowMap].forEach((texture) => {
    texture.anisotropy = anisotropy;
    keep(texture);
  });

  const leatherMat = (maps: ReturnType<typeof makeLeatherMaps>, clearcoat: number) =>
    keep(
      new MeshPhysicalMaterial({
        map: maps.map,
        normalMap: maps.normalMap,
        roughnessMap: maps.roughnessMap,
        metalnessMap: maps.metalnessMap,
        normalScale: new Vector2(2.4, 2.4),
        roughness: 0.78,
        metalness: 0.12,
        clearcoat,
        clearcoatRoughness: 0.42,
        envMapIntensity: 0.55,
      }),
    );

  const coverMat = leatherMat(leatherOutside, 0.28);
  const insideMat = leatherMat(leatherInside, 0.08);
  const plainMat = keep(
    new MeshStandardMaterial({
      color: 0x2a241c,
      roughness: 0.86,
      metalness: 0.04,
    }),
  );

  const giltForeTex = cloneGilt(gilt, new Vector2(1, 22), keep);
  const giltEdgeTex = cloneGilt(gilt, new Vector2(10, 3), keep);
  const giltMaterial = (tex: { map: Texture; normalMap: Texture }, emissive: number) =>
    keep(
      new MeshStandardMaterial({
        map: tex.map,
        normalMap: tex.normalMap,
        normalScale: new Vector2(0.35, 0.9),
        color: 0xffe6b0,
        metalness: 0.58,
        roughness: 0.36,
        emissive: 0xc4893a,
        emissiveIntensity: emissive,
        envMapIntensity: 1.35,
      }),
    );
  const giltFore = giltMaterial(giltForeTex, 0.18);
  const giltEdge = giltMaterial(giltEdgeTex, 0.22);
  const goldTrim = keep(
    new MeshStandardMaterial({
      color: 0xf3ddb0,
      metalness: 0.72,
      roughness: 0.34,
      emissive: 0xb8883c,
      emissiveIntensity: 0.28,
      envMapIntensity: 1.2,
    }),
  );

  const paperRight = keep(new MeshBasicMaterial({ map: pageRight }));
  const paperLeft = keep(new MeshBasicMaterial({ map: pageLeft }));
  const paperHidden = keep(
    new MeshStandardMaterial({
      color: 0xe7dcc6,
      roughness: 0.9,
      metalness: 0,
    }),
  );
  const bindingMat = keep(
    new MeshStandardMaterial({
      color: 0x1a1410,
      roughness: 0.92,
      metalness: 0,
    }),
  );
  const ribbonMat = keep(
    new MeshStandardMaterial({
      color: 0x3a1418,
      roughness: 0.55,
      metalness: 0.08,
    }),
  );
  const tabDark = keep(
    new MeshStandardMaterial({
      color: 0x140e0c,
      roughness: 0.45,
      metalness: 0.35,
    }),
  );

  const rig = new Group();
  scene.add(rig);
  const book = new Group();
  rig.add(book);

  const backCover = new Mesh(keep(new BoxGeometry(COVER_W, COVER_H, COVER_T)), [
    plainMat,
    plainMat,
    plainMat,
    plainMat,
    insideMat,
    coverMat,
  ]);
  backCover.position.set(COVER_W / 2, 0, -COVER_T / 2);
  book.add(backCover);

  const spine = new Mesh(keep(new BoxGeometry(0.1, COVER_H, 0.1)), coverMat);
  spine.position.set(-0.05, 0, -0.01);
  book.add(spine);
  for (let i = 0; i < 5; i += 1) {
    const band = new Mesh(keep(new BoxGeometry(0.028, 0.05, 0.072)), plainMat);
    band.position.set(-0.1, (i - 2) * 0.36, -0.01);
    book.add(band);
  }

  const pageGeom = keep(new BoxGeometry(PAGE_W, PAGE_H, HALF_T));
  const rightPage = new Mesh(pageGeom, [giltFore, bindingMat, giltEdge, giltEdge, paperRight, paperHidden]);
  rightPage.position.set(HINGE + PAGE_W / 2, 0, HALF_T / 2 + 0.004);
  book.add(rightPage);

  const tabs = new Group();
  for (let i = 0; i < 8; i += 1) {
    const gold = i % 2 === 0;
    const tab = new Mesh(keep(new BoxGeometry(0.05, 0.095, 0.055)), gold ? goldTrim : tabDark);
    tab.position.set(
      PAGE_W / 2 + 0.018,
      -PAGE_H * 0.36 + (i / 7) * PAGE_H * 0.72,
      0,
    );
    tabs.add(tab);
  }
  rightPage.add(tabs);

  const leftPivot = new Group();
  leftPivot.position.set(HINGE, 0, HALF_T + 0.004);
  const leftPage = new Mesh(pageGeom, [giltFore, bindingMat, giltEdge, giltEdge, paperHidden, paperLeft]);
  leftPage.position.set(PAGE_W / 2, 0, HALF_T / 2);
  leftPivot.add(leftPage);
  book.add(leftPivot);

  const frontPivot = new Group();
  frontPivot.position.set(0, 0, PAGE_T + 0.01);
  const frontCover = new Mesh(keep(new BoxGeometry(COVER_W, COVER_H, COVER_T)), [
    plainMat,
    plainMat,
    plainMat,
    plainMat,
    coverMat,
    insideMat,
  ]);
  frontCover.position.set(COVER_W / 2, 0, COVER_T / 2);
  frontPivot.add(frontCover);
  book.add(frontPivot);

  const addBar = (width: number, height: number, x: number, y: number) => {
    const bar = new Mesh(keep(new BoxGeometry(width, height, 0.008)), goldTrim);
    bar.position.set(x, y, COVER_T / 2 + 0.005);
    frontCover.add(bar);
  };
  const outer = 0.13;
  const inner = 0.19;
  addBar(COVER_W - outer * 2, 0.014, 0, COVER_H / 2 - outer);
  addBar(COVER_W - outer * 2, 0.014, 0, -(COVER_H / 2 - outer));
  addBar(0.014, COVER_H - outer * 2, COVER_W / 2 - outer, 0);
  addBar(0.014, COVER_H - outer * 2, -(COVER_W / 2 - outer), 0);
  addBar(COVER_W - inner * 2, 0.008, 0, COVER_H / 2 - inner);
  addBar(COVER_W - inner * 2, 0.008, 0, -(COVER_H / 2 - inner));
  addBar(0.008, COVER_H - inner * 2, COVER_W / 2 - inner, 0);
  addBar(0.008, COVER_H - inner * 2, -(COVER_W / 2 - inner), 0);
  addBar(0.62, 0.01, 0, 0.2);
  addBar(0.46, 0.008, 0, -0.2);

  const makeRibbon = (length: number) => {
    const group = new Group();
    const strap = new Mesh(keep(new BoxGeometry(0.046, length, 0.01)), ribbonMat);
    strap.position.y = -length / 2;
    const tip = new Mesh(keep(new BoxGeometry(0.056, 0.09, 0.012)), goldTrim);
    tip.position.y = -length + 0.01;
    group.add(strap, tip);
    return group;
  };
  const ribbonA = makeRibbon(0.58);
  ribbonA.position.set(HINGE + PAGE_W * 0.58, -PAGE_H / 2 + 0.02, PAGE_T * 0.72);
  ribbonA.rotation.z = 0.2;
  ribbonA.rotation.x = 0.35;
  const ribbonB = makeRibbon(0.72);
  ribbonB.position.set(HINGE + PAGE_W * 0.8, -PAGE_H / 2 + 0.02, PAGE_T * 0.58);
  ribbonB.rotation.z = 0.42;
  ribbonB.rotation.x = 0.2;
  book.add(ribbonA, ribbonB);

  const gutterRibbon = makeRibbon(0.46);
  gutterRibbon.position.set(HINGE + 0.22, 0.15, PAGE_T / 2 + 0.012);
  gutterRibbon.rotation.z = 0.35;
  book.add(gutterRibbon);

  scene.add(new AmbientLight(0x4a4036, 0.55));
  const key = new DirectionalLight(0xfff6e8, 2.05);
  key.position.set(2.2, 3.8, 4.2);
  scene.add(key);
  const fill = new DirectionalLight(0xe6d2b4, 0.85);
  fill.position.set(-2.4, 1.6, 3.2);
  scene.add(fill);
  const edgeLight = new PointLight(0xffd898, 8, 9, 2);
  edgeLight.position.set(2.5, 0.15, 1.4);
  scene.add(edgeLight);
  const rim = new DirectionalLight(0xffe2b0, 1.7);
  rim.position.set(-1.4, 2.2, -2.4);
  scene.add(rim);
  const spot = new SpotLight(0xfff8ee, 5, 16, 0.5, 0.45, 1.2);
  spot.position.set(1.4, 3.6, 2.6);
  spot.target.position.set(0.2, 0, 0.2);
  scene.add(spot);
  scene.add(spot.target);
  const giltLight = new PointLight(0xffc56a, 0.2, 7, 1.4);
  giltLight.position.set(0, -1.35, 2.5);
  scene.add(giltLight);

  const glow = new Mesh(
    keep(new PlaneGeometry(5.2, 2.1)),
    keep(
      new MeshBasicMaterial({
        map: glowMap,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        opacity: 0,
      }),
    ),
  );
  glow.position.set(0, -0.95, 0.35);
  glow.rotation.x = -1.15;
  scene.add(glow);

  const closedPos = new Vector3(1.48, 0.78, 3.85);
  const openPos = new Vector3(0.0, -0.28, 3.35);
  const closedLook = new Vector3(0.02, -0.16, 0);
  const openLook = new Vector3(0, 0.22, -0.05);
  const look = new Vector3();
  let shown = clamp(initialProgress);

  const resize = () => {
    const width = canvas.clientWidth || canvas.parentElement?.clientWidth || 1;
    const height = canvas.clientHeight || canvas.parentElement?.clientHeight || 1;
    camera.aspect = width / Math.max(height, 1);
    camera.fov = camera.aspect < 0.9 ? 38 : 30;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };

  const apply = () => {
    const open = ease(segment(shown, 0.05, 0.46));
    const leaf = ease(segment(shown, 0.18, 0.6));
    const low = ease(segment(shown, 0.38, 0.88));

    frontPivot.rotation.y = -open * Math.PI * 0.992;
    frontPivot.position.z = PAGE_T + 0.01 - open * (PAGE_T + 0.01);
    leftPivot.rotation.y = -leaf * Math.PI * 0.992;

    book.position.x = (-COVER_W / 2) * (1 - Math.max(open, leaf));
    book.rotation.y = 0.22 * (1 - low);
    book.rotation.x = 0.16 * (1 - low) + -1.02 * low;
    camera.position.lerpVectors(closedPos, openPos, low);
    look.lerpVectors(closedLook, openLook, low);
    camera.lookAt(look);

    const glowAmount = 0.55 + low * 0.6;
    giltFore.emissiveIntensity = glowAmount;
    giltEdge.emissiveIntensity = glowAmount + 0.25;
    goldTrim.emissiveIntensity = 0.1 + low * 0.28;
    giltLight.intensity = 0.35 + low * 7.5;
    (glow.material as MeshBasicMaterial).opacity = low * 0.85;
    ribbonA.visible = open < 0.42;
    ribbonB.visible = open < 0.42;
    gutterRibbon.visible = leaf > 0.45;
    tabs.visible = leaf > 0.72;
  };

  let frame = 0;
  let running = true;
  const loop = () => {
    if (!running) return;
    frame = 0;
    apply();
    renderer.render(scene, camera);
  };
  const requestDraw = () => {
    if (!running || frame) return;
    frame = window.requestAnimationFrame(loop);
  };

  resize();
  apply();
  renderer.render(scene, camera);

  const observer = new ResizeObserver(() => {
    resize();
    requestDraw();
  });
  observer.observe(canvas);

  return {
    setProgress: (value) => {
      shown = clamp(value);
      requestDraw();
    },
    resize,
    dispose: () => {
      running = false;
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      bin.forEach((item) => item.dispose());
      renderer.dispose();
      scene.clear();
    },
  };
}
