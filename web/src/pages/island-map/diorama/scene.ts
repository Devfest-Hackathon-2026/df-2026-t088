// 紙のジオラマの島の地図（CMP-011）。three を読み込むのはこのファイルと、ここから読む tropical.ts（南国の飾り）だけ
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { SubjectId } from "../../../data";
import type { CreateDiorama, IslandAnchor } from "./engine-api";
import { parseCubicBezier, parseDuration, type EasingFn } from "./easing";
import {
  areaFit,
  areaOf,
  areaPlaces,
  computeCloseupPose,
  computeOverviewPose,
  FOV,
  getIslandLayout,
  groundY,
  hillRiseTarget,
  ISLAND_SEED,
  isHighland,
  LAND_EXPONENT,
  LAND_INSETS,
  LAND_THICKNESS,
  LAND_TOP,
  landBridge,
  landOf,
  layerCount,
  LAYER_THICKNESS,
  layoutModeFor,
  lerpPose,
  lerpVec3,
  NOTEBOOK_TOP,
  notebookProps,
  SEA_EXPONENT,
  roadRing,
  seaExtents,
  SEA_THICKNESS,
  SEA_TOP,
  stepToward,
  summitY,
  treeSpots,
  type IslandPlace,
  type LayoutMode,
  type MapArea,
  type Pose,
  type Vec3,
} from "./layout";
import { parseColor } from "./color";
import { createRng, islandLayerOutline, wobblyOutline, type Point2 } from "./terrain";
import { buildLandmarks, type LandmarkColors } from "./landmarks";
import { createTropical } from "./tropical";

// ---- 定数（長さの単位は世界の 1 = 方眼 1 マス） ----
const NOTEBOOK_W = 110;
const NOTEBOOK_D = 110;
const GRID_PX = 28;
const WAVE_PERIOD_S = 4;
const WAVE_AMP = 0.03;
const LIFT_HEIGHT = 0.25;
const PEEK_RATIO = 0.25;
const PRESS_SLOP_PX = 8;
const HEMI_INTENSITY = 1.6;
const DIR_INTENSITY = 2.8;
const MAX_ROAD_DOTS = 120;
// 道の点はチリ紙の輪（SEA_TOP + 0.08 ほど、ゆれて 0.145 まで）より上に出す
const DOT_HEIGHT = 0.14;
const DOT_Y = SEA_TOP + 0.12;
const ROAD_SPACING = 0.65;
// 三角形の上限（07）に収めるための輪郭の点の数。揺れは低い周波数だけなので、この数でも形は変わらない
const ISLAND_POINTS = 64;
/** 画面の上の空ける割合。見出しに加えて、学年のえらびの帯（D-122）を置く */
const GRADE_BAND_RESERVE: Record<LayoutMode, number> = { wide: 0.24, narrow: 0.3 };
const HILL_POINTS = 36;
const LAND_POINTS = 72;
const SEA_POINTS = 120;
const TREE_HEIGHT = 0.5;

// ---- トークンの読み取り ----
const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const tokenColor = (name: string) => parseColor(css(name)).color;
const tokenMs = (name: string, fallback: number) => parseDuration(css(name)) ?? fallback;
const tokenEase = (name: string): EasingFn => parseCubicBezier(css(name)) ?? ((x) => x);

// ---- 形づくり ----
/** [x,z] の輪郭を押し出し、上を向いた面は cap、側面は edge の頂点色にする。y は base から */
function paperSlab(outline: Point2[], base: number, thickness: number, cap: THREE.Color, edge: THREE.Color) {
  const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 1 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, base, 0);
  return colorize(g, (ny) => (Math.abs(ny) > 0.5 ? cap : edge));
}

function colorize(g: THREE.BufferGeometry, pick: (ny: number) => THREE.Color) {
  const geo = g.index ? g.toNonIndexed() : g;
  const n = geo.getAttribute("normal");
  const colors = new Float32Array(n.count * 3);
  for (let i = 0; i < n.count; i++) {
    const c = pick(n.getY(i));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geo;
}

function flatColor(g: THREE.BufferGeometry, c: THREE.Color) {
  return colorize(g, () => c);
}

function noiseTexture(rng: () => number) {
  const size = 128;
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d");
  if (ctx) {
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const v = 238 + Math.floor(rng() * 18);
      img.data.set([v, v, v, 255], i * 4);
    }
    ctx.putImageData(img, 0, 0);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 方眼の 1 マス分だけの絵を敷き詰める。ノート全体の大きさの絵（約 3000px 四方）を 1 度に描くと、メインスレッドが 200ms ほど止まる（D-142） */
function gridTexture(bg: string, grid: string, maxAniso: number) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = GRID_PX;
  const ctx = cv.getContext("2d");
  if (ctx) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, GRID_PX, GRID_PX);
    // 線はマスの境目の両側に 1px ずつ。敷き詰めると 2px の線になる
    ctx.fillStyle = grid;
    ctx.fillRect(GRID_PX - 1, 0, 1, GRID_PX);
    ctx.fillRect(0, 0, 1, GRID_PX);
    ctx.fillRect(0, GRID_PX - 1, GRID_PX, 1);
    ctx.fillRect(0, 0, GRID_PX, 1);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(NOTEBOOK_W, NOTEBOOK_D);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

/** 島の 1 つ分（段と教科の飾りを 1 つに結合）。原点が島の中心 */
function buildIslandGeometry(
  id: SubjectId,
  radius: number,
  sand: THREE.Color,
  meadow: THREE.Color,
  subject: THREE.Color,
  edge: THREE.Color,
  landmarkColors: LandmarkColors,
) {
  const layers = layerCount(id);
  const seed = ISLAND_SEED[id];
  const hill = isHighland(id);
  const points = hill ? HILL_POINTS : ISLAND_POINTS;
  const parts: THREE.BufferGeometry[] = [];
  for (let l = 0; l < layers; l++) {
    // 海の島は下の 2 段が砂。高原の丘は下の 1 段が草地
    const cap = hill ? (l < 1 ? meadow : subject) : l < 2 ? sand : subject;
    parts.push(
      paperSlab(islandLayerOutline(seed, radius, l, layers, points), groundY(id) + l * LAYER_THICKNESS, LAYER_THICKNESS, cap, edge),
    );
  }
  // 教科の飾りは動かないので、島と一緒に描いて描画の回数を増やさない（D-79）
  const landmarks = buildLandmarks(id, landmarkColors);
  if (landmarks) parts.push(landmarks);
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return { geometry: merged, topOutline: islandLayerOutline(seed, radius, layers - 1, layers, points) };
}

/** 高原の陸地。砂、低い草地、草地の紙を重ねる（海の紙と同じ作り） */
function buildLand(mode: LayoutMode, colors: THREE.Color[], edge: THREE.Color) {
  const land = landOf(mode);
  const parts = colors.map((c, i) => {
    const inset = LAND_INSETS[i];
    const outline = wobblyOutline(90 + i, land.rx - inset, land.rz - inset, { points: LAND_POINTS, rough: 0.04, exponent: LAND_EXPONENT });
    return paperSlab(outline.map(([x, z]) => [x + land.x, z + land.z]), NOTEBOOK_TOP + i * LAND_THICKNESS, LAND_THICKNESS, c, edge);
  });
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

/** 高原の丸い木を 1 つに結合する。幹と、角ばった紙の玉 */
function buildTrees(mode: LayoutMode, leaf: THREE.Color, trunk: THREE.Color) {
  const parts: THREE.BufferGeometry[] = [];
  for (const s of treeSpots(mode)) {
    const stem = new THREE.CylinderGeometry(0.07, 0.09, TREE_HEIGHT, 5, 1, true);
    stem.scale(s.scale, s.scale, s.scale);
    stem.translate(s.x, LAND_TOP + (TREE_HEIGHT / 2) * s.scale, s.z);
    const crown = new THREE.IcosahedronGeometry(0.42, 0);
    crown.scale(s.scale, s.scale, s.scale);
    crown.translate(s.x, LAND_TOP + (TREE_HEIGHT + 0.25) * s.scale, s.z);
    parts.push(flatColor(stem, trunk), flatColor(crown, leaf));
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

function buildPencil(body: THREE.Color, wood: THREE.Color, lead: THREE.Color) {
  const r = 0.18;
  const bodyG = new THREE.CylinderGeometry(r, r, 3.2, 6);
  bodyG.rotateZ(Math.PI / 2);
  bodyG.translate(-0.2, 0, 0);
  const woodG = new THREE.CylinderGeometry(0.06, r, 0.7, 6);
  woodG.rotateZ(-Math.PI / 2);
  woodG.translate(1.75, 0, 0);
  const leadG = new THREE.ConeGeometry(0.06, 0.25, 6);
  leadG.rotateZ(-Math.PI / 2);
  leadG.translate(2.22, 0, 0);
  const parts = [flatColor(bodyG, body), flatColor(woodG, wood), flatColor(leadG, lead)];
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

/** 隣り合う海の島のふちどうしを輪につなぎ、同じ間隔の点を並べる（D-63） */
function roadPoints(places: IslandPlace[], mode: LayoutMode): Vec3[] {
  const ring = roadRing(places);
  const pts: Vec3[] = [];
  ring.forEach((from, i) => {
    const to = ring[(i + 1) % ring.length];
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const len = Math.hypot(dx, dz);
    const ux = dx / len;
    const uz = dz / len;
    const start = from.radius * 1.12;
    const end = len - to.radius * 1.12;
    const n = Math.max(1, Math.round((end - start) / ROAD_SPACING));
    for (let j = 0; j <= n; j++) {
      const s = start + ((end - start) * j) / n;
      pts.push([from.x + ux * s, 0, from.z + uz * s]);
    }
  });
  // 海の島から高原へ 1 本だけ渡す
  const bridge = landBridge(places, mode);
  const n = Math.max(1, Math.round((bridge.end - bridge.start) / ROAD_SPACING));
  for (let i = 0; i <= n; i++) {
    const s = bridge.start + ((bridge.end - bridge.start) * i) / n;
    pts.push([bridge.from.x + bridge.ux * s, 0, bridge.from.z + bridge.uz * s]);
  }
  return pts.slice(0, MAX_ROAD_DOTS);
}

type MotionTarget = { kind: "overview" } | { kind: "closeup"; id: SubjectId } | { kind: "peek"; id: SubjectId };
interface Motion {
  kind: "zoom" | "area" | "peek-out" | "peek-back";
  from: Pose;
  to: MotionTarget;
  start: number;
  duration: number;
  ease: EasingFn;
  onDone?: () => void;
}

/** 1回の持ち時間（ms）。これを超えたらメインスレッドへ返し、波や入力を止めない（D-142） */
const SLICE_MS = 30;
/** 組み立て中に dispose / WebGL の喪失があった印。ready の失敗とは区別する */
const ABORT = Symbol("diorama-abort");

/** メインスレッドへ返す。scheduler.yield があれば使い、無ければ MessageChannel（setTimeout と違い、裏のタブでも遅れない） */
function yieldToMain(): Promise<void> {
  const sched = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (sched?.yield) return sched.yield();
  return new Promise<void>((resolve) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => {
      ch.port1.close();
      resolve();
    };
    ch.port2.postMessage(null);
  });
}

interface IslandNode {
  id: SubjectId;
  open: boolean;
  place: IslandPlace;
  group: THREE.Group;
  hit: THREE.Mesh;
  lift: number;
  liftTarget: number;
  rise: number;
}

export const createDiorama: CreateDiorama = (options) => {
  const { canvas, islands, onAnchors, onIslandPress, onAreaPress, onIslandHover, onContextLost } = options;

  // ---- トークン ----
  const dur = {
    zoom: tokenMs("--duration-zoom", 1200),
    peek: tokenMs("--duration-peek", 360),
    peekBack: tokenMs("--duration-peek-back", 480),
    fast: tokenMs("--duration-fast", 120),
  };
  const ease = {
    zoom: tokenEase("--ease-zoom"),
    out: tokenEase("--ease-out"),
    inOut: tokenEase("--ease-in-out"),
  };
  const edgeColor = tokenColor("--color-paper-edge");
  const shadow = parseColor(css("--color-diorama-shadow"));

  // ---- 後始末の控え ----
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  const track = <T extends THREE.BufferGeometry>(g: T) => (geometries.push(g), g);
  const trackMat = <T extends THREE.Material>(m: T) => (materials.push(m), m);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.NoToneMapping;
  let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 300);

  // ---- 光 ----
  const hemi = new THREE.HemisphereLight(tokenColor("--color-bg"), tokenColor("--color-desk"), HEMI_INTENSITY);
  const sun = new THREE.DirectionalLight(new THREE.Color(1, 1, 1), DIR_INTENSITY);
  sun.position.set(-11, 10.5, -5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const sc = sun.shadow.camera;
  // 右奥の高原まで影を落とす
  sc.left = -30;
  sc.right = 30;
  sc.top = 30;
  sc.bottom = -30;
  sc.near = 1;
  sc.far = 80;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  // 影の濃さ：トークンの透明度の約 3.5 倍（段の重なりが見えるように強めた）
  sun.shadow.intensity = Math.min(1, shadow.alpha * 3.5);
  scene.add(hemi, sun);

  // ---- 組み立ての進み具合 ----
  // 重い物は build() が区切りながら作る。外へ出す操作は、組み上がるまで何もしない
  let disposed = false;
  let lost = false;
  let built = false;
  let sliceStart = performance.now();
  /** 持ち時間を超えていたらメインスレッドへ返す。返っている間に dispose / 喪失があれば組み立てを止める */
  const step = async (force = false) => {
    if (force || performance.now() - sliceStart >= SLICE_MS) {
      await yieldToMain();
      sliceStart = performance.now();
    }
    if (disposed || lost) throw ABORT;
  };

  // ---- 組み立て後に使う物（build() で埋める） ----
  const seaGeos: THREE.BufferGeometry[][] = [];
  const seas: THREE.Mesh[] = [];
  const lands: THREE.Group[] = [];
  const nodes = new Map<SubjectId, IslandNode>();
  const nodeList: IslandNode[] = [];
  const hitGroup = new THREE.Group();
  const roadGroup = new THREE.Group();
  const dotGeo = track(new THREE.CylinderGeometry(0.13, 0.13, DOT_HEIGHT, 12));
  let dotMat: THREE.MeshLambertMaterial;
  let roadDots: THREE.InstancedMesh;
  let landHit: THREE.Mesh;
  let pencil: THREE.Mesh;
  let tropical: ReturnType<typeof createTropical>;
  scene.add(hitGroup, roadGroup);

  let mode: LayoutMode = layoutModeFor(canvas.clientWidth || 300, canvas.clientHeight || 150);
  let layout = getIslandLayout(mode);
  const placeOf = (id: SubjectId) => layout.find((p) => p.id === id) as IslandPlace;
  // 学年で出さない島は作らない。置き場所の表は全部を持つので、道とカメラは出す島だけで引く
  const shown = new Set(islands.map((def) => def.id));
  const shownPlaces = () => layout.filter((p) => shown.has(p.id));

  /** 島の組を置き直す（島・当たり判定・道・南国の飾り） */
  const applyLayout = () => {
    layout = getIslandLayout(mode);
    for (const n of nodeList) {
      n.place = placeOf(n.id);
      const sx = n.place.radius;
      const base = getIslandLayout("wide").find((p) => p.id === n.id)?.radius ?? sx;
      // 島の絵は広い画面の半径で作ってあるので、狭い画面では縮める
      const k = sx / base;
      n.group.scale.set(k, 1, k);
      n.group.position.x = n.place.x;
      n.group.position.z = n.place.z;
      n.hit.scale.set(sx * 1.2, 1, sx * 1.2);
      n.hit.position.set(n.place.x, 1.5, n.place.z);
    }
    const land = landOf(mode);
    landHit.scale.set(land.rx, 1, land.rz);
    landHit.position.set(land.x, 0.35, land.z);
    hitGroup.updateMatrixWorld(true);
    const li = mode === "wide" ? 0 : 1;
    seas.forEach((m, i) => (m.geometry = seaGeos[li][i]));
    lands.forEach((g, i) => (g.visible = i === li));
    const props = notebookProps(mode, areaPlaces(layout, "sea"));
    pencil.position.set(props.pencil.x, NOTEBOOK_TOP + 0.17, props.pencil.z);
    pencil.rotation.y = props.pencil.rotY;
    const pts = roadPoints(shownPlaces(), mode);
    const m = new THREE.Matrix4();
    pts.forEach((p, i) => roadDots.setMatrixAt(i, m.makeTranslation(p[0], DOT_Y, p[2])));
    roadDots.count = pts.length;
    roadDots.instanceMatrix.needsUpdate = true;
    tropical.setMode(mode);
  };

  // ---- カメラの動き ----
  let area: MapArea = "sea";
  const overviewFor = (a: MapArea, aspect: number) =>
    computeOverviewPose(areaPlaces(shownPlaces(), a), aspect, {
      // 海の縁は置き場所の表の全部で引く（海の紙の大きさと合わせる）
      extra: areaFit(mode, a === "sea" ? layout : shownPlaces(), a),
      topReserve: GRADE_BAND_RESERVE[mode],
    });
  let overview = overviewFor(area, 1);
  const closeupOf = (id: SubjectId) => computeCloseupPose(placeOf(id));
  const poseOf = (t: MotionTarget): Pose => {
    if (t.kind === "overview") return overview;
    const close = closeupOf(t.id);
    if (t.kind === "closeup") return close;
    return {
      position: lerpVec3(overview.position, close.target, PEEK_RATIO),
      target: lerpVec3(overview.target, close.target, PEEK_RATIO),
    };
  };
  let rest: MotionTarget = { kind: "overview" };
  let motion: Motion | null = null;
  let pendingZoom: (() => void) | null = null;
  let current: Pose = overview;

  const applyPose = (p: Pose) => {
    current = p;
    camera.position.set(...p.position);
    camera.lookAt(...p.target);
    camera.updateMatrixWorld();
  };
  const settleZoom = () => {
    const r = pendingZoom;
    pendingZoom = null;
    r?.();
  };
  const startMotion = (m: Omit<Motion, "from" | "start">) => {
    motion = { ...m, from: current, start: performance.now() };
  };

  const recomputeCameras = (width: number, height: number) => {
    overview = overviewFor(area, width / height);
    if (!motion) applyPose(poseOf(rest));
  };

  // ---- 大きさ ----
  let width = 1;
  let height = 1;
  const resize = () => {
    if (disposed) return;
    width = Math.max(1, canvas.clientWidth);
    height = Math.max(1, canvas.clientHeight);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const next = layoutModeFor(width, height);
    if (next !== mode) mode = next;
    applyLayout();
    recomputeCameras(width, height);
    lastAnchors = null;
  };
  // 島ができてから付ける（applyLayout が島と海を使う）
  const ro = new ResizeObserver(resize);

  // ---- 吹き出し用の位置 ----
  let lastAnchors: IslandAnchor[] | null = null;
  const tmp = new THREE.Vector3();
  const sendAnchors = () => {
    const anchors: IslandAnchor[] = [];
    for (const n of nodeList) {
      // 付箋は島と一緒に浮く。付箋自体は傾けない（D-84）
      const top = new THREE.Vector3(n.place.x, summitY(n.id) + 0.4 + n.group.position.y, n.place.z);
      const distNow = camera.position.distanceTo(top);
      const ov = new THREE.Vector3(...overview.position).distanceTo(new THREE.Vector3(n.place.x, summitY(n.id) + 0.4, n.place.z));
      tmp.copy(top).project(camera);
      anchors.push({
        id: n.id,
        x: ((tmp.x + 1) / 2) * width,
        y: ((1 - tmp.y) / 2) * height,
        scale: ov / distNow,
      });
    }
    const prev = lastAnchors;
    const changed =
      !prev ||
      anchors.some((a, i) => {
        const b = prev[i];
        return !b || Math.abs(a.x - b.x) > 0.05 || Math.abs(a.y - b.y) > 0.05 || Math.abs(a.scale - b.scale) > 0.0005;
      });
    if (changed) {
      lastAnchors = anchors;
      onAnchors(anchors);
    }
  };

  // ---- ポインター ----
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  /** 押した物。今映している場所の島か、別の場所か */
  const pick = (e: PointerEvent): { id?: SubjectId; area?: MapArea } | null => {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -(((e.clientY - rect.top) / rect.height) * 2 - 1));
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(hitGroup.children, false)[0];
    if (!hit) return null;
    const id = hit.object.userData.id as SubjectId | undefined;
    const there: MapArea = id ? areaOf(id) : "highland";
    if (there !== area) return { area: there };
    return id ? { id } : null;
  };
  let hover: SubjectId | null = null;
  let highlight: SubjectId | null = null;
  let downAt: { x: number; y: number } | null = null;
  const zooming = () => motion?.kind === "zoom" || motion?.kind === "area";

  const onDown = (e: PointerEvent) => {
    if (zooming()) return;
    downAt = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: PointerEvent) => {
    const d = downAt;
    downAt = null;
    if (!d || zooming()) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > PRESS_SLOP_PX) return;
    const target = pick(e);
    if (target?.area) onAreaPress(target.area);
    else if (target?.id) onIslandPress(target.id);
  };
  const setHover = (id: SubjectId | null) => {
    if (id === hover) return;
    hover = id;
    onIslandHover?.(id);
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    const target = pick(e);
    canvas.style.cursor = target ? "pointer" : "";
    setHover(target?.id ?? null);
  };
  const onLeave = () => {
    canvas.style.cursor = "";
    setHover(null);
  };

  // ---- 毎フレーム ----
  let raf = 0;
  let running = false;
  let lastT = 0;
  let fpsWindowStart = 0;
  let fpsFrames = 0;
  let slowSeconds = 0;
  let degraded = false;
  let clock0 = 0;

  const degrade = () => {
    degraded = true;
    sun.castShadow = false;
    renderer.shadowMap.enabled = false;
    tropical.degrade();
    materials.forEach((m) => (m.needsUpdate = true));
    pixelRatio = 1;
    resize();
  };

  /** 1 コマ分の更新。描画はしない */
  const update = (t: number, dt: number) => {
    // カメラ
    if (motion) {
      const m = motion;
      const raw = (performance.now() - m.start) / m.duration;
      if (raw >= 1) {
        applyPose(poseOf(m.to));
        motion = null;
        m.onDone?.();
      } else {
        applyPose(lerpPose(m.from, poseOf(m.to), m.ease(Math.max(0, raw))));
      }
    }

    // MOT-012：海の紙だけが上下する
    const phase = (t / 1000 / WAVE_PERIOD_S) * Math.PI * 2;
    seas.forEach((s, i) => (s.position.y = Math.sin(phase + i * 1.3) * WAVE_AMP));
    roadGroup.position.y = seas[2].position.y;

    // MOT-013：浮かせる
    for (const n of nodeList) {
      n.liftTarget = n.id === hover || n.id === highlight ? 1 : 0;
      const step = dt / dur.fast;
      n.lift += Math.max(-step, Math.min(step, n.liftTarget - n.lift));
      const s = n.lift * n.lift * (3 - 2 * n.lift);
      n.group.position.y = s * LIFT_HEIGHT;
      // MOT-021：高原の丘は草地の下に畳んであり、高原へ移る間に起き上がる
      if (isHighland(n.id)) {
        n.rise = stepToward(n.rise, hillRiseTarget(area), dt / dur.zoom);
        n.group.scale.y = n.rise * n.rise * (3 - 2 * n.rise);
        n.group.visible = n.rise > 0;
      }
    }

    // 南国の飾り：時刻は frame(t) と同じ t から取る。教科の飾りは島の形に入っているので一緒に浮く
    if (!clock0) clock0 = t;
    tropical.update((t - clock0) / 1000, seas[2].position.y);
  };

  const frame = (t: number) => {
    if (disposed || lost) return;
    raf = requestAnimationFrame(frame);
    const dt = lastT ? Math.min(t - lastT, 100) : 16;
    lastT = t;

    // 性能の見張り：平均 24fps を下回る状態が 3 秒続いたら 1 回だけ軽くする
    if (!fpsWindowStart) fpsWindowStart = t;
    fpsFrames++;
    if (t - fpsWindowStart >= 1000) {
      const fps = (fpsFrames * 1000) / (t - fpsWindowStart);
      slowSeconds = fps < 24 ? slowSeconds + 1 : 0;
      fpsWindowStart = t;
      fpsFrames = 0;
      if (slowSeconds >= 3 && !degraded) degrade();
    }

    update(t, dt);
    renderer.render(scene, camera);
    sendAnchors();
  };

  const start = () => {
    if (running || disposed || lost) return;
    running = true;
    lastT = 0;
    fpsWindowStart = 0;
    fpsFrames = 0;
    raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
  };
  const onVisibility = () => {
    if (document.visibilityState === "hidden") stop();
    else start();
  };

  let rejectReady: (e: unknown) => void = () => {};
  const onLost = () => {
    if (disposed || lost) return;
    lost = true;
    stop();
    settleZoom();
    // 組み立て中なら ready を失敗にする。組み上がった後は ready は解決済みで、何も起きない
    rejectReady(new Error("webgl context lost"));
    onContextLost();
  };
  // 組み立ての間の喪失も拾うので、最初に付ける
  canvas.addEventListener("webglcontextlost", onLost);

  // ---- 組み立て（重い所は区切って、1回の処理を持ち時間に収める） ----
  const build = async () => {
    await step();

    // 材質とテクスチャ
    const paperNoise = noiseTexture(createRng(5));
    textures.push(paperNoise);
    await step();
    const paperMat = trackMat(new THREE.MeshLambertMaterial({ vertexColors: true, map: paperNoise }));
    const deskMat = trackMat(new THREE.MeshLambertMaterial({ color: tokenColor("--color-desk") }));
    const edgeMat = trackMat(new THREE.MeshLambertMaterial({ color: edgeColor }));
    const gridTex = gridTexture(css("--color-bg"), css("--color-grid"), Math.min(8, renderer.capabilities.getMaxAnisotropy()));
    textures.push(gridTex);
    await step();
    const notebookMat = trackMat(new THREE.MeshLambertMaterial({ map: gridTex }));
    const lineMat = trackMat(new THREE.LineBasicMaterial({ color: tokenColor("--color-border") }));
    dotMat = trackMat(new THREE.MeshLambertMaterial({ color: tokenColor("--color-border") }));
    const hitMat = trackMat(new THREE.MeshBasicMaterial({ visible: false }));

    // 机とノート
    const desk = new THREE.Mesh(track(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2)), deskMat);
    desk.receiveShadow = true;
    const notebookBody = new THREE.Mesh(track(new THREE.BoxGeometry(NOTEBOOK_W, NOTEBOOK_TOP, NOTEBOOK_D)), edgeMat);
    notebookBody.position.y = NOTEBOOK_TOP / 2;
    notebookBody.receiveShadow = true;
    const notebookTop = new THREE.Mesh(track(new THREE.PlaneGeometry(NOTEBOOK_W, NOTEBOOK_D).rotateX(-Math.PI / 2)), notebookMat);
    notebookTop.position.y = NOTEBOOK_TOP + 0.002;
    notebookTop.receiveShadow = true;
    scene.add(desk, notebookBody, notebookTop);
    await step();

    // 鉛筆
    pencil = new THREE.Mesh(
      track(buildPencil(tokenColor("--color-now"), tokenColor("--color-bg"), tokenColor("--color-fg-strong"))),
      paperMat,
    );
    pencil.castShadow = true;
    pencil.receiveShadow = true;
    scene.add(pencil);
    await step();

    // 海（島の組ごとに縁の形が違う）
    const seaColors = [tokenColor("--color-sea-deep"), tokenColor("--color-sea-mid"), tokenColor("--color-sea-shallow")];
    for (const m of ["wide", "narrow"] as const) {
      const places = getIslandLayout(m);
      const geos: THREE.BufferGeometry[] = [];
      for (let i = 0; i < seaColors.length; i++) {
        const { rx, rz } = seaExtents(places, i, m);
        geos.push(
          track(
            paperSlab(
              wobblyOutline(70 + i, rx, rz, { points: SEA_POINTS, rough: 0.015, exponent: SEA_EXPONENT }),
              NOTEBOOK_TOP + i * SEA_THICKNESS,
              SEA_THICKNESS,
              seaColors[i],
              edgeColor,
            ),
          ),
        );
        await step();
      }
      seaGeos.push(geos);
    }
    seaColors.forEach((_, i) => {
      const mesh = new THREE.Mesh(seaGeos[0][i], paperMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      seas.push(mesh);
    });

    // 右奥の高原（画面の組ごとに置き場所が違うので、両方作って出し分ける）
    const landColors = [tokenColor("--color-sand"), tokenColor("--color-meadow-low"), tokenColor("--color-meadow")];
    for (const m of ["wide", "narrow"] as const) {
      const group = new THREE.Group();
      const land = new THREE.Mesh(track(buildLand(m, landColors, edgeColor)), paperMat);
      await step();
      const trees = new THREE.Mesh(track(buildTrees(m, tokenColor("--color-palm-leaf"), tokenColor("--color-palm-trunk"))), paperMat);
      land.castShadow = land.receiveShadow = trees.castShadow = true;
      group.add(land, trees);
      scene.add(group);
      lands.push(group);
      await step();
    }

    // 道（浅い海の紙と一緒に上下する）
    roadDots = new THREE.InstancedMesh(dotGeo, dotMat, MAX_ROAD_DOTS);
    roadDots.receiveShadow = true;
    roadDots.frustumCulled = false;
    roadGroup.add(roadDots);
    await step();

    // 南国の飾り（チリ紙の波、魚の影、鳥、風の線）
    const fish = parseColor(css("--color-fish-shadow"));
    const wind = parseColor(css("--color-wind-line"));
    tropical = createTropical(scene, {
      tissue: tokenColor("--color-tissue"),
      foam: tokenColor("--color-foam"),
      fish,
      bird: tokenColor("--color-bird"),
      wind,
    }, shown);
    await step();

    // 島
    const sand = tokenColor("--color-sand");
    const meadow = tokenColor("--color-meadow");
    const landmarkColors: LandmarkColors = {
      paper: tokenColor("--color-bg"),
      ink: tokenColor("--color-fg"),
      inkStrong: tokenColor("--color-fg-strong"),
      stone: tokenColor("--color-muted-fg"),
      red: tokenColor("--color-primary"),
      yellow: tokenColor("--color-now"),
      teal: tokenColor("--color-done"),
      purple: tokenColor("--color-subject-eigo"),
      sand,
      wood: tokenColor("--color-palm-trunk"),
      leaf: tokenColor("--color-palm-leaf"),
      glass: tokenColor("--color-tissue"),
      sea: tokenColor("--color-sea-mid"),
    };
    for (const def of islands) {
      const place = placeOf(def.id);
      // 絵は広い画面の半径で作り、狭い画面では縮めて置く
      const wideRadius = getIslandLayout("wide").find((p) => p.id === def.id)?.radius ?? place.radius;
      const { geometry, topOutline } = buildIslandGeometry(def.id, wideRadius, sand, meadow, tokenColor(`--color-subject-${def.id}`), edgeColor, landmarkColors);
      track(geometry);
      const group = new THREE.Group();
      const body = new THREE.Mesh(geometry, paperMat);
      body.castShadow = true;
      body.receiveShadow = true;
      const loopPts = topOutline.map(([x, z]) => new THREE.Vector3(x, summitY(def.id) + 0.012, z));
      const loop = new THREE.LineLoop(track(new THREE.BufferGeometry().setFromPoints(loopPts)), lineMat);
      group.add(body, loop);
      scene.add(group);

      const hit = new THREE.Mesh(track(new THREE.CylinderGeometry(1, 1, 3, 20)), hitMat);
      hit.visible = false;
      hit.userData.id = def.id;
      hitGroup.add(hit);

      const node: IslandNode = { id: def.id, open: def.open, place, group, hit, lift: 0, liftTarget: 0, rise: isHighland(def.id) ? 0 : 1 };
      nodes.set(def.id, node);
      nodeList.push(node);
      await step();
    }

    // 陸地のどこを押しても高原へ移れるように、草地全体にも当たり判定を置く
    landHit = new THREE.Mesh(track(new THREE.CylinderGeometry(1, 1, 0.7, 24)), hitMat);
    landHit.visible = false;
    hitGroup.add(landHit);

    // 置き場所とカメラ。setSize（描画面の確保）は分けられないので、前後で必ず返して単独の処理にする
    await step(true);
    resize();
    if (options.startArea === "highland") {
      // 高原の島から戻った時は、高原の全景から始める。丘は最初から立てておく（D-91）。引く動き（MOT-011）はやめた（D-103）
      area = "highland";
      overview = overviewFor(area, width / height);
      for (const n of nodeList) if (isHighland(n.id)) n.rise = hillRiseTarget(area);
      applyPose(overview);
    }
    await step(true);

    // シェーダーの準備はブラウザに任せて待つ（KHR_parallel_shader_compile）。待つ間も波や入力は止まらない
    await renderer.compileAsync(scene, camera);
    await step();
    // 大きなテクスチャは最初の描画と別に GPU へ送る
    renderer.initTexture(paperNoise);
    await step();
    renderer.initTexture(gridTex);
    await step(true);

    // 最初の 1 枚。ここで島などの頂点も GPU へ送られる
    update(performance.now(), 16);
    renderer.render(scene, camera);
    sendAnchors();

    // ここから操作を受け付け、毎フレームの描画を始める
    ro.observe(canvas);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", onVisibility);
    built = true;
    if (document.visibilityState !== "hidden") start();
  };

  const ready = new Promise<void>((resolve, reject) => {
    rejectReady = reject;
    build().then(resolve, (e) => {
      if (e === ABORT) {
        // dispose された（後始末は dispose がした）か、WebGL を失った（onLost が reject 済み）
        resolve();
        return;
      }
      // 組み立ての失敗。呼び出し側は平面の地図へ戻す。途中までの物はここで片付ける
      teardown();
      reject(e);
    });
  });

  // ---- 後始末 ----
  const teardown = () => {
    if (disposed) return;
    disposed = true;
    stop();
    document.removeEventListener("visibilitychange", onVisibility);
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerleave", onLeave);
    canvas.removeEventListener("webglcontextlost", onLost);
    canvas.style.cursor = "";
    ro.disconnect();
    motion = null;
    settleZoom();
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
    roadDots?.dispose();
    tropical?.dispose();
    renderer.dispose();
  };

  // ---- 外へ出す操作 ----
  return {
    ready,
    zoomTo: (id) => {
      if (disposed || lost || !built || !nodes.has(id)) return Promise.resolve();
      settleZoom();
      return new Promise<void>((resolve) => {
        pendingZoom = resolve;
        rest = { kind: "closeup", id };
        startMotion({
          kind: "zoom",
          to: rest,
          duration: dur.zoom,
          ease: ease.zoom,
          onDone: settleZoom,
        });
      });
    },
    showArea: (next) => {
      if (disposed || lost || !built) return Promise.resolve();
      settleZoom();
      area = next;
      overview = overviewFor(next, width / height);
      rest = { kind: "overview" };
      return new Promise<void>((resolve) => {
        pendingZoom = resolve;
        startMotion({ kind: "area", to: rest, duration: dur.zoom, ease: ease.zoom, onDone: settleZoom });
      });
    },
    peek: (id) => {
      if (disposed || lost || !built || !nodes.has(id)) return;
      if (rest.kind !== "overview" || zooming()) return;
      startMotion({
        kind: "peek-out",
        to: { kind: "peek", id },
        duration: dur.peek,
        ease: ease.out,
        onDone: () => startMotion({ kind: "peek-back", to: { kind: "overview" }, duration: dur.peekBack, ease: ease.inOut }),
      });
    },
    // 組み立て中でも値は覚えておく
    setHighlight: (id) => {
      if (disposed) return;
      highlight = id;
    },
    dispose: teardown,
  };
};
