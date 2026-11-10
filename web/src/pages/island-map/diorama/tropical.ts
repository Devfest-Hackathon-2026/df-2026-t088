// 島の地図の南国の飾り（CMP-011）。チリ紙の波、魚の影、紙の鳥、白い風の線。
// 島の上の教科の飾りは動かないので、landmarks.ts で島の形と一緒に作る（D-79）
// three を使うので scene.ts からだけ読み込む。置き場所と動きの計算は layout.ts にある
import type { SubjectId } from "../../../data";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  birdAt,
  BIRD_COUNT,
  fishAt,
  fishRoutes,
  getIslandLayout,
  ISLAND_SEED,
  isHighland,
  layerCount,
  SEA_TOP,
  seaExtents,
  type FishRoute,
  type LayoutMode,
} from "./layout";
import { createRng, islandLayerOutline } from "./terrain";

const WIND_LINES = 3;
const BAND_ALPHA = 0.62;
const RING_ALPHA = 0.82;
const RING_COUNT = 3;
const RING_Y = SEA_TOP + 0.08;
// 帯はうねり（±0.055）で海の紙に沈まない高さに置く
const BAND_Y = SEA_TOP + 0.07;
const FISH_Y = SEA_TOP + 0.03;

export interface TropicalColor {
  color: THREE.Color;
  alpha: number;
}
export interface TropicalColors {
  tissue: THREE.Color;
  foam: THREE.Color;
  fish: TropicalColor;
  bird: THREE.Color;
  wind: TropicalColor;
}

export interface Tropical {
  /** 画面の組が変わったとき、輪・帯・魚・鳥・風の線を組に合わせる */
  setMode(mode: LayoutMode): void;
  /** time は秒。seaY は一番上の海の紙の上下（世界の長さ） */
  update(time: number, seaY: number): void;
  /** 性能が足りないとき、帯のチリ紙を消す */
  degrade(): void;
  dispose(): void;
}

/** チリ紙のしわ。R=しわの明暗、G=ふわっとしたむら。繰り返して貼れる */
function tissueTexture() {
  const s = 512;
  const cv = document.createElement("canvas");
  cv.width = cv.height = s;
  const x = cv.getContext("2d");
  const r = createRng(9);
  if (x) {
    x.fillStyle = "rgb(128,128,0)";
    x.fillRect(0, 0, s, s);
    x.globalCompositeOperation = "lighter";
    for (let i = 0; i < 90; i++) {
      const px = r() * s;
      const py = r() * s;
      const rad = 30 + r() * 90;
      const g = x.createRadialGradient(px, py, 0, px, py, rad);
      g.addColorStop(0, `rgba(0,${40 + r() * 60},0,0.5)`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      x.fillStyle = g;
      for (const dx of [-s, 0, s]) {
        for (const dy of [-s, 0, s]) {
          x.setTransform(1, 0, 0, 1, dx, dy);
          x.fillRect(px - rad, py - rad, rad * 2, rad * 2);
        }
      }
    }
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalCompositeOperation = "source-over";
    for (let i = 0; i < 520; i++) {
      let px = r() * s;
      let py = r() * s;
      let a = r() * Math.PI * 2;
      const n = 2 + Math.floor(r() * 4);
      const up = r() > 0.5;
      x.strokeStyle = up ? `rgba(255,128,0,${0.12 + r() * 0.28})` : `rgba(40,128,0,${0.1 + r() * 0.22})`;
      x.lineWidth = 0.6 + r() * 1.4;
      x.beginPath();
      x.moveTo(px, py);
      for (let k = 0; k < n; k++) {
        a += (r() - 0.5) * 1.3;
        const l = 14 + r() * 46;
        px += Math.cos(a) * l;
        py += Math.sin(a) * l;
        x.lineTo(px, py);
      }
      x.stroke();
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** 島のふちに寄せては返すチリ紙の輪（島ごと・輪ごと）を 1 つに結合する */
function ringGeometry(mode: LayoutMode, shown: ReadonlySet<SubjectId>) {
  const wide = getIslandLayout("wide");
  const parts: THREE.BufferGeometry[] = [];
  // 高原の丘は海に触れないので、波の輪を付けない
  // 学年で出さない島には付けない
  for (const p of getIslandLayout(mode).filter((q) => !isHighland(q.id) && shown.has(q.id))) {
    const wideR = wide.find((q) => q.id === p.id)?.radius ?? p.radius;
    const k = p.radius / wideR;
    const outline = islandLayerOutline(ISLAND_SEED[p.id], wideR, 0, layerCount(p.id)).filter((_, i) => i % 2 === 0);
    const N = outline.length;
    for (let r = 0; r < RING_COUNT; r++) {
      const inset = 0.98 + r * 0.07;
      const w = 0.42 + r * 0.05;
      const ph = r * 2.1 + ISLAND_SEED[p.id];
      const RAD = 2;
      const pos: number[] = [];
      const dir: number[] = [];
      const data: number[] = [];
      const idx: number[] = [];
      for (let i = 0; i <= N; i++) {
        const [x, z] = outline[i % N];
        const [xa, za] = outline[(i + 1) % N];
        const [xb, zb] = outline[(i + N - 1) % N];
        let nx = za - zb;
        let nz = -(xa - xb);
        const len = Math.hypot(nx, nz) || 1;
        nx /= len;
        nz /= len;
        if (nx * x + nz * z < 0) {
          nx = -nx;
          nz = -nz;
        }
        for (let j = 0; j <= RAD; j++) {
          pos.push(p.x + x * k * inset, RING_Y + r * 0.01, p.z + z * k * inset);
          dir.push(nx, 0, nz);
          data.push(j / RAD, w, ph, (i / N) * Math.PI * 2);
        }
      }
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < RAD; j++) {
          const a = i * (RAD + 1) + j;
          const b = a + RAD + 1;
          idx.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("aDir", new THREE.Float32BufferAttribute(dir, 3));
      g.setAttribute("aD", new THREE.Float32BufferAttribute(data, 4));
      g.setIndex(idx);
      parts.push(g);
    }
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

/** 白い風の線。海の左から右へ、少しうねって走る */
function windGeometry(rx: number, rz: number) {
  const parts: THREE.BufferGeometry[] = [];
  const r = createRng(33);
  for (let i = 0; i < WIND_LINES; i++) {
    const z0 = -rz * 0.75 + (i / (WIND_LINES - 1 || 1)) * rz * 1.5 + r() * 0.8;
    const y0 = 2.5 + r() * 1.3;
    const x0 = -rx - 5;
    const len = rx * 2 + 10;
    const ph = r();
    const pos: number[] = [];
    const d: number[] = [];
    const idx: number[] = [];
    const N = 60;
    const curlAt = 0.5 + r() * 0.3;
    const cR = 0.5 + r() * 0.35;
    const amp = 0.6 + r() * 0.5;
    const f = 1.1 + r() * 0.9;
    for (let k = 0; k <= N; k++) {
      const t = k / N;
      let x = x0 + len * t;
      let z = z0 + Math.sin(t * 6.283 * f + ph * 6) * amp;
      const ct = (t - curlAt) / 0.09;
      if (ct > 0 && ct < 1) {
        const a = ct * Math.PI * 2;
        x += Math.sin(a) * cR - ct * 0.2;
        z += (1 - Math.cos(a)) * cR;
      }
      const y = y0 + Math.sin(t * 9) * 0.15;
      pos.push(x, y, z - 0.03, x, y, z + 0.03);
      d.push(t, ph, t, ph);
      if (k < N) {
        const a = k * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("aD", new THREE.Float32BufferAttribute(d, 2));
    g.setIndex(idx);
    parts.push(g);
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

const BAND_VERT = `uniform float uT,uSp,uDir; varying vec2 vW; void main(){ vec3 p=position; vW=p.xz;
  p.y+=0.035*sin(p.z*1.1+p.x*0.35+uT*0.9*uSp)+0.02*sin(p.x*1.7-uT*0.7);
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.); }`;

const BAND_FRAG = `uniform float uT,uA,uSp,uDir; uniform vec2 uR; uniform sampler2D uTex; uniform vec3 uColor; varying vec2 vW;
float band(vec2 w,float f,float s,float off,float rough,vec4 tx){
  float wob=sin(w.x*.33+off)*1.1+sin(w.x*.9+off*2.)*.42+sin(w.x*.15-off)*1.4;
  float ph=(w.y*uDir+wob)*f+s; float e=fract(ph/6.2831);
  float d=e-.36+(tx.g-.5)*rough;
  return smoothstep(-.012,.02,d)*(1.-smoothstep(.0,.62,d)); }
void main(){
  vec4 t1=texture2D(uTex,vW*.085+vec2(uT*.006*uSp,0.));
  vec4 t2=texture2D(uTex,vW*.31+vec2(0.,uT*.01));
  float edge=pow(pow(abs(vW.x)/uR.x,3.)+pow(abs(vW.y)/uR.y,3.),1./3.);
  float mask=1.-smoothstep(.93,.985,edge);
  float T=uT*uSp; float cre0=(t2.r-.5);
  float a=band(vW,.62,T*.34,0.,.5,t2)*.9;
  float b=band(vW+7.,.46,T*.25,2.4,.42,t2)*.7;
  float cc=band(vW-13.,.8,T*.42,5.,.55,t1)*.55;
  float al=1.-(1.-a)*(1.-b)*(1.-cc); al=clamp(al+abs(cre0)*al*.5,0.,1.);
  float cre=(t1.r-.5)*1.1+(t2.r-.5)*.8;
  vec3 col=mix(uColor,vec3(1.),.42)*(1.+cre*.55);
  float grain=.72+t2.g*.5;
  float A=clamp(al*uA*grain*mask,0.,1.);
  gl_FragColor=vec4(col,A);
#include <colorspace_fragment>
}`;

const RING_VERT = `uniform float uT; attribute vec3 aDir; attribute vec4 aD; varying vec2 vW; varying float vV;
void main(){ float v=aD.x, w=aD.y, ph=aD.z, ang=aD.w;
  float s=sin(uT*.75+ph)+.35*sin(uT*.31+ph*1.7);
  float frill=.09*sin(ang*7.+uT*.6+ph)+.05*sin(ang*13.-uT*.8);
  vec3 p=position+aDir*(v*w*(1.+.1*s)+s*.20+frill*(.4+v));
  p.y+=(.015+.03*v)*sin(ang*9.+uT*1.3+ph);
  vW=p.xz; vV=v;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.); }`;

const RING_FRAG = `uniform float uA; uniform sampler2D uTex; uniform vec3 uColor; varying vec2 vW; varying float vV;
void main(){ vec4 t=texture2D(uTex,vW*.27); vec4 t2=texture2D(uTex,vW*.09+.3);
  float d=vV+(t.g-.5)*.34;
  float a=smoothstep(.0,.16,vV)*(1.-smoothstep(.78,.98,d));
  float cre=(t.r-.5)*1.3+(t2.r-.5)*.8;
  vec3 col=uColor*(.93+cre*.42);
  gl_FragColor=vec4(col,a*uA*(.8+t2.g*.3));
#include <colorspace_fragment>
}`;

const WIND_VERT = `attribute vec2 aD; varying vec2 vD; void main(){ vD=aD; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`;

const WIND_FRAG = `uniform float uT,uA; uniform vec3 uColor; varying vec2 vD; void main(){ float h=fract(uT*.085+vD.y*1.0); float head=h*1.5-.25; float x=head-vD.x;
  float a=smoothstep(0.,.03,x)*(1.-smoothstep(.03,.3,x));
  gl_FragColor=vec4(uColor,a*uA);
#include <colorspace_fragment>
}`;

interface ModeData {
  band: THREE.BufferGeometry;
  bandR: THREE.Vector2;
  ring: THREE.BufferGeometry;
  wind: THREE.BufferGeometry;
  fish: FishRoute[];
  birdR: { rx: number; rz: number };
}

export function createTropical(scene: THREE.Scene, colors: TropicalColors, shown: ReadonlySet<SubjectId>): Tropical {
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const track = <T extends THREE.BufferGeometry>(g: T) => (geometries.push(g), g);
  const trackMat = <T extends THREE.Material>(m: T) => (materials.push(m), m);
  const instanced: THREE.InstancedMesh[] = [];
  const meshes: THREE.Object3D[] = [];

  const tissue = tissueTexture();
  const time = { value: 0 };
  const common = { uT: time, uTex: { value: tissue } };

  // ---- チリ紙の帯（海全体） ----
  const bandMat = trackMat(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        ...common,
        uColor: { value: colors.tissue },
        uA: { value: BAND_ALPHA },
        uSp: { value: 1 },
        uDir: { value: 1 },
        uR: { value: new THREE.Vector2(1, 1) },
      },
      vertexShader: BAND_VERT,
      fragmentShader: BAND_FRAG,
    }),
  );
  const band = new THREE.Mesh(new THREE.BufferGeometry(), bandMat);
  band.position.y = BAND_Y;
  band.renderOrder = 1;
  band.frustumCulled = false;

  // ---- チリ紙の輪（島のふち） ----
  const ringMat = trackMat(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { ...common, uColor: { value: colors.foam }, uA: { value: RING_ALPHA } },
      vertexShader: RING_VERT,
      fragmentShader: RING_FRAG,
    }),
  );
  const ring = new THREE.Mesh(new THREE.BufferGeometry(), ringMat);
  ring.renderOrder = 2;
  ring.frustumCulled = false;

  // ---- 風の線 ----
  const windMat = trackMat(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      uniforms: { uT: time, uColor: { value: colors.wind.color }, uA: { value: colors.wind.alpha } },
      vertexShader: WIND_VERT,
      fragmentShader: WIND_FRAG,
    }),
  );
  const wind = new THREE.Mesh(new THREE.BufferGeometry(), windMat);
  wind.renderOrder = 5;
  wind.frustumCulled = false;

  // ---- 魚の影 ----
  const fishShape = new THREE.Shape();
  fishShape.moveTo(0.34, 0);
  fishShape.quadraticCurveTo(0.12, 0.14, -0.2, 0.03);
  fishShape.lineTo(-0.2, -0.03);
  fishShape.quadraticCurveTo(0.12, -0.14, 0.34, 0);
  const fishG = track(new THREE.ShapeGeometry(fishShape, 5).rotateX(-Math.PI / 2));
  const tailG = track(
    new THREE.ShapeGeometry(
      new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(-0.2, 0.12), new THREE.Vector2(-0.14, 0), new THREE.Vector2(-0.2, -0.12)]),
    ).rotateX(-Math.PI / 2),
  );
  const fishMat = trackMat(
    new THREE.MeshBasicMaterial({ color: colors.fish.color, transparent: true, opacity: colors.fish.alpha, depthWrite: false, side: THREE.DoubleSide }),
  );
  const fishCount = fishRoutes("wide").length;
  const fishB = new THREE.InstancedMesh(fishG, fishMat, fishCount);
  const fishT = new THREE.InstancedMesh(tailG, fishMat, fishCount);
  fishB.frustumCulled = fishT.frustumCulled = false;

  // ---- 鳥 ----
  const wingG = track(
    new THREE.ShapeGeometry(
      new THREE.Shape([new THREE.Vector2(0.16, 0), new THREE.Vector2(-0.14, 0), new THREE.Vector2(-0.32, 0.62), new THREE.Vector2(-0.06, 0.34)]),
    ).rotateX(-Math.PI / 2),
  );
  const bodyG = track(new THREE.ConeGeometry(0.075, 0.62, 4).rotateZ(-Math.PI / 2).scale(1, 0.75, 1));
  const birdMat = trackMat(new THREE.MeshLambertMaterial({ color: colors.bird, side: THREE.DoubleSide }));
  const wings = new THREE.InstancedMesh(wingG, birdMat, BIRD_COUNT * 2);
  const bodies = new THREE.InstancedMesh(bodyG, birdMat, BIRD_COUNT);
  wings.castShadow = bodies.castShadow = true;
  wings.frustumCulled = bodies.frustumCulled = false;

  instanced.push(fishB, fishT, wings, bodies);
  meshes.push(band, ring, wind, ...instanced);
  scene.add(...meshes);

  // ---- 組ごとの形（初めて使うときに作って覚える） ----
  const modes = new Map<LayoutMode, ModeData>();
  const dataFor = (mode: LayoutMode): ModeData => {
    const cached = modes.get(mode);
    if (cached) return cached;
    const places = getIslandLayout(mode);
    const sea = seaExtents(places, 2, mode);
    const sea0 = seaExtents(places, 0, mode);
    const d: ModeData = {
      band: track(new THREE.PlaneGeometry(sea.rx * 2.1, sea.rz * 2.1, 20, 16).rotateX(-Math.PI / 2)),
      bandR: new THREE.Vector2(sea.rx, sea.rz),
      ring: track(ringGeometry(mode, shown)),
      wind: track(windGeometry(sea.rx, sea.rz)),
      fish: fishRoutes(mode),
      birdR: sea0,
    };
    modes.set(mode, d);
    return d;
  };
  let cur = dataFor("wide");
  const setMode = (mode: LayoutMode) => {
    cur = dataFor(mode);
    band.geometry = cur.band;
    ring.geometry = cur.ring;
    wind.geometry = cur.wind;
    (bandMat.uniforms.uR.value as THREE.Vector2).copy(cur.bandR);
  };
  setMode("wide");

  // ---- 毎フレーム ----
  const M = new THREE.Matrix4();
  const M2 = new THREE.Matrix4();
  const M3 = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const E = new THREE.Euler();
  const P = new THREE.Vector3();
  const S = new THREE.Vector3();
  const compose = (out: THREE.Matrix4, x: number, y: number, z: number, rx: number, ry: number, rz: number, s: number) => {
    E.set(rx, ry, rz, "YXZ");
    Q.setFromEuler(E);
    P.set(x, y, z);
    S.setScalar(s);
    return out.compose(P, Q, S);
  };
  const flip = new THREE.Matrix4().makeScale(1, 1, -1);

  const update = (t: number, seaY: number) => {
    time.value = t;

    // チリ紙は海の紙と一緒に上下する
    band.position.y = BAND_Y + seaY;
    ring.position.y = seaY;

    // 魚の影：海の紙と一緒に上下する
    cur.fish.forEach((f, i) => {
      const { x, z, yaw } = fishAt(f, t);
      const wag = Math.sin(t * 7 + i) * 0.14;
      compose(M, x, FISH_Y + seaY, z, 0, yaw + wag * 0.4, 0, f.s);
      fishB.setMatrixAt(i, M);
      M2.copy(M).multiply(compose(M3, -0.19, 0, 0, 0, Math.sin(t * 7 + i - 0.8) * 0.55, 0, 1));
      fishT.setMatrixAt(i, M2);
    });
    fishB.instanceMatrix.needsUpdate = fishT.instanceMatrix.needsUpdate = true;

    // 鳥：大きな輪を描いて島の上を渡る
    for (let i = 0; i < BIRD_COUNT; i++) {
      const b = birdAt(i, t, cur.birdR.rx, cur.birdR.rz);
      const y = 3.6 + i * 0.35 + Math.sin(t * 0.6 + i) * 0.25;
      const glide = Math.sin(t * 0.45 + i * 1.7) > 0.25;
      const flap = glide ? 0.16 : Math.sin(t * 6.5 + i * 0.9) * 0.62 + 0.1;
      compose(M, b.x, y, b.z, 0, Math.atan2(-b.tz, b.tx), 0, 0.82 + (i % 3) * 0.1);
      bodies.setMatrixAt(i, M);
      compose(M3, 0, 0, 0, flap, 0, 0, 1);
      wings.setMatrixAt(i * 2, M2.copy(M).multiply(M3));
      wings.setMatrixAt(i * 2 + 1, M2.copy(M).multiply(flip).multiply(M3));
    }
    wings.instanceMatrix.needsUpdate = bodies.instanceMatrix.needsUpdate = true;
  };

  return {
    setMode,
    update,
    degrade: () => {
      band.visible = false;
      materials.forEach((m) => (m.needsUpdate = true));
    },
    dispose: () => {
      scene.remove(...meshes);
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      instanced.forEach((m) => m.dispose());
      tissue.dispose();
    },
  };
}
