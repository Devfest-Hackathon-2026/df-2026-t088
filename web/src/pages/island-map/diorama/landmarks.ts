// 島と丘の上に立てる教科の飾り（D-79）。海の島はヤシの代わりに、高原の丘は丸い木に加えて、教科の物を 3 つ置く。
// 動かない紙の工作なので、島の形と 1 つに結合して描く（描画の回数を増やさない）。
// three を使うので scene.ts からだけ読み込む。置き場所の計算は layout.ts の landmarkSpots にある
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { SubjectId } from "../../../data";
import { isHighland, landmarkSpots } from "./layout";

/** 飾りに使う色。どれもトークンから読む（scene.ts が渡す） */
export interface LandmarkColors {
  paper: THREE.Color;
  ink: THREE.Color;
  inkStrong: THREE.Color;
  stone: THREE.Color;
  red: THREE.Color;
  yellow: THREE.Color;
  teal: THREE.Color;
  purple: THREE.Color;
  sand: THREE.Color;
  wood: THREE.Color;
  leaf: THREE.Color;
  glass: THREE.Color;
  sea: THREE.Color;
}

/** 飾りの大きさ。形は高さ 0.6〜0.9 で作り、全景で見分けられるよう少し大きくして立てる */
const LANDMARK_SCALE = 1.3;
/** 高原の丘は海の島より小さいので、飾りも控えめにする */
const HILL_LANDMARK_SCALE = 0.85;

type Part = THREE.BufferGeometry;
type Build = (c: LandmarkColors) => Part[];

/** 一つの色で塗る。島の形と結合できるよう、位置・法線・uv・色をそろえ、添字を外す */
function paint(g: THREE.BufferGeometry, c: THREE.Color): Part {
  const geo = g.index ? g.toNonIndexed() : g;
  if (geo !== g) g.dispose();
  const n = geo.getAttribute("position").count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  if (!geo.getAttribute("uv")) geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  geo.clearGroups();
  return geo;
}

const v2 = (points: [number, number][]) => points.map(([x, y]) => new THREE.Vector2(x, y));
const polygon = (points: [number, number][]) => new THREE.Shape(v2(points));
const hole = (points: [number, number][]) => new THREE.Path(v2(points));
const rectHole = (x0: number, y0: number, x1: number, y1: number) => hole([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);

/** 立てた板：xy 平面の形を厚み d で押し出し、z の中央へ寄せる。正面が +z を向く */
function slab(shape: THREE.Shape, d: number, segments = 4) {
  return new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false, curveSegments: segments }).translate(0, 0, -d / 2);
}

/** 箱。y は底の高さ */
function box(w: number, h: number, d: number, x: number, y: number, z: number) {
  return new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z);
}

/** 四角錐。底の一辺が w（45° 回して辺を正面へ向ける）。y は底の高さ */
function pyramid(w: number, h: number, y: number) {
  return new THREE.ConeGeometry(w / Math.SQRT2, h, 4, 1).rotateY(Math.PI / 4).translate(0, y + h / 2, 0);
}

// ---- 算数：三角定規、分度器、＋ ----
const sansu: Build[] = [
  (c) => {
    const s = polygon([[-0.4, 0], [0.4, 0], [-0.4, 0.6]]);
    s.holes.push(hole([[-0.29, 0.08], [0.13, 0.08], [-0.29, 0.39]]));
    return [paint(slab(s, 0.05), c.yellow)];
  },
  (c) => {
    const s = new THREE.Shape();
    s.absarc(0, 0, 0.42, 0, Math.PI, false);
    s.lineTo(-0.25, 0);
    s.absarc(0, 0, 0.25, Math.PI, 0, true);
    s.lineTo(0.42, 0);
    // 目盛り：外の弧の内側に短い線
    const ticks = [1, 2, 3, 4, 5].map((i) =>
      paint(
        new THREE.BoxGeometry(0.018, 0.08, 0.012).translate(0, 0.37, 0.03).rotateZ((i / 6) * Math.PI - Math.PI / 2),
        c.ink,
      ),
    );
    return [paint(slab(s, 0.05, 8), c.paper), ...ticks];
  },
  (c) => {
    const t = 0.09;
    const l = 0.26;
    const s = polygon([
      [-t, -l], [t, -l], [t, -t], [l, -t], [l, t], [t, t], [t, l], [-t, l], [-t, t], [-l, t], [-l, -t], [-t, -t],
    ]);
    return [paint(slab(s, 0.12).translate(0, l, 0), c.red)];
  },
];

// ---- 国語：開いた本、筆と硯、掛け軸 ----
const kokugo: Build[] = [
  (c) => {
    const cover = box(0.8, 0.04, 0.52, 0, 0, 0);
    const left = box(0.38, 0.05, 0.46, 0, 0, 0).rotateZ(0.16).translate(-0.19, 0.04, 0);
    const right = box(0.38, 0.05, 0.46, 0, 0, 0).rotateZ(-0.16).translate(0.19, 0.04, 0);
    // 縦書きの行：右のページに短い線を 3 本
    const lines = [0.1, 0.19, 0.28].map((x) =>
      paint(new THREE.BoxGeometry(0.022, 0.01, 0.32).rotateZ(-0.16).translate(x, 0.125 - x * 0.16, 0), c.ink),
    );
    return [paint(cover, c.ink), paint(left, c.paper), paint(right, c.paper), ...lines];
  },
  (c) => {
    const stone = box(0.32, 0.1, 0.48, 0, 0, 0);
    const pool = box(0.22, 0.02, 0.14, 0, 0.1, -0.13);
    // 筆は右上から左下へ、硯に立てかける。穂先は左下を向く
    const tilt = Math.PI / 2 + 0.35;
    const handle = new THREE.CylinderGeometry(0.035, 0.035, 0.56, 6).rotateZ(tilt).translate(0.05, 0.25, 0.1);
    const tip = new THREE.ConeGeometry(0.055, 0.18, 6).rotateZ(tilt).translate(-0.295, 0.124, 0.1);
    return [paint(stone, c.inkStrong), paint(pool, c.ink), paint(handle, c.wood), paint(tip, c.inkStrong)];
  },
  (c) => {
    const sheet = box(0.4, 0.7, 0.02, 0, 0.04, 0);
    const rod = (y: number) => new THREE.CylinderGeometry(0.035, 0.035, 0.5, 6).rotateZ(Math.PI / 2).translate(0, y, 0);
    const lines = [0.08, -0.04].map((x) => paint(box(0.028, 0.44, 0.012, x, 0.18, 0.016), c.ink));
    const seal = paint(box(0.06, 0.06, 0.012, -0.12, 0.13, 0.016), c.red);
    return [paint(sheet, c.paper), paint(rod(0.04), c.wood), paint(rod(0.76), c.wood), ...lines, seal];
  },
];

// ---- 理科：フラスコ、虫眼鏡、双葉 ----
const rika: Build[] = [
  (c) => {
    const bulb = new THREE.LatheGeometry(v2([[0.001, 0], [0.22, 0.02], [0.28, 0.14], [0.24, 0.3], [0.1, 0.4]]), 8);
    const neck = new THREE.LatheGeometry(v2([[0.1, 0.4], [0.075, 0.48], [0.075, 0.72], [0.1, 0.76]]), 8);
    return [paint(bulb, c.purple), paint(neck, c.glass)];
  },
  (c) => {
    const y = 0.48;
    const ring = new THREE.TorusGeometry(0.22, 0.045, 4, 10).translate(0, y, 0);
    const lens = new THREE.CylinderGeometry(0.2, 0.2, 0.02, 10).rotateX(Math.PI / 2).translate(0, y, 0);
    const handle = new THREE.CylinderGeometry(0.045, 0.05, 0.32, 6).rotateZ(0.5).translate(0.2, 0.19, 0);
    return [paint(ring, c.ink), paint(lens, c.glass), paint(handle, c.wood)];
  },
  (c) => {
    const pot = new THREE.CylinderGeometry(0.19, 0.14, 0.24, 8).translate(0, 0.12, 0);
    const soil = new THREE.CylinderGeometry(0.17, 0.17, 0.02, 8).translate(0, 0.23, 0);
    const stem = new THREE.CylinderGeometry(0.025, 0.03, 0.3, 5).translate(0, 0.38, 0);
    const leaf = (side: number) =>
      new THREE.IcosahedronGeometry(0.12, 0).scale(1.4, 0.35, 0.8).rotateZ(side * 0.4).translate(side * 0.14, 0.55, 0);
    return [paint(pot, c.red), paint(soil, c.wood), paint(stem, c.leaf), paint(leaf(1), c.leaf), paint(leaf(-1), c.leaf)];
  },
];

// ---- 社会：ピラミッド、日本の城、地球儀 ----
const shakai: Build[] = [
  (c) => [paint(pyramid(0.74, 0.58, 0), c.sand)],
  (c) => {
    // 石垣は裾の広い台。上に白い壁と瓦の屋根を 2 段重ねる。棟の両端に金のしゃちほこ
    const base = new THREE.CylinderGeometry(0.32, 0.42, 0.2, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 0.8).translate(0, 0.1, 0);
    const wall1 = box(0.38, 0.2, 0.28, 0, 0.2, 0);
    const roof1 = pyramid(0.54, 0.16, 0.4).scale(1, 1, 0.78);
    const wall2 = box(0.24, 0.16, 0.18, 0, 0.5, 0);
    const roof2 = pyramid(0.36, 0.2, 0.66).scale(1, 1, 0.78);
    const windows = [-0.09, 0.09].map((x) => paint(box(0.06, 0.07, 0.01, x, 0.28, 0.142), c.ink));
    const fins = [-0.05, 0.05].map((x) => paint(box(0.03, 0.06, 0.03, x, 0.83, 0), c.yellow));
    return [
      paint(base, c.sand),
      paint(wall1, c.paper),
      paint(roof1, c.stone),
      paint(wall2, c.paper),
      paint(roof2, c.stone),
      ...windows,
      ...fins,
    ];
  },
  (c) => {
    const y = 0.46;
    const globe = paint(new THREE.IcosahedronGeometry(0.22, 1).translate(0, y, 0), c.sea);
    // 面ごとに海と陸を塗り分ける
    const col = globe.getAttribute("color");
    const pos = globe.getAttribute("position");
    for (let f = 0; f < pos.count; f += 3) {
      const cx = pos.getX(f) + pos.getX(f + 1) + pos.getX(f + 2);
      const cy = pos.getY(f) + pos.getY(f + 1) + pos.getY(f + 2) - 3 * y;
      const cz = pos.getZ(f) + pos.getZ(f + 1) + pos.getZ(f + 2);
      if (Math.sin(cx * 9 + cz * 4) + Math.cos(cy * 11 - cx * 3) > 0.7) {
        for (let k = 0; k < 3; k++) col.setXYZ(f + k, c.leaf.r, c.leaf.g, c.leaf.b);
      }
    }
    const arc = new THREE.TorusGeometry(0.28, 0.02, 3, 10, Math.PI).rotateZ(-Math.PI / 2).translate(0, y, 0);
    const post = new THREE.CylinderGeometry(0.03, 0.03, 0.18, 5).translate(0, 0.1, 0);
    const foot = new THREE.CylinderGeometry(0.15, 0.17, 0.04, 8).translate(0, 0.02, 0);
    return [globe, paint(arc, c.wood), paint(post, c.wood), paint(foot, c.wood)];
  },
];

// ---- 音楽：音符、鍵盤、太鼓 ----
const ongaku: Build[] = [
  (c) => {
    // 八分音符：たまは傾いた楕円、棒と旗を付ける
    const head = new THREE.CylinderGeometry(0.11, 0.11, 0.07, 8)
      .rotateX(Math.PI / 2)
      .scale(1.3, 0.9, 1)
      .rotateZ(0.4)
      .translate(0, 0.15, 0);
    const stem = box(0.04, 0.5, 0.06, 0.12, 0.17, 0);
    const flag = slab(polygon([[0.14, 0.67], [0.14, 0.55], [0.3, 0.41], [0.26, 0.55]]), 0.06);
    return [paint(head, c.inkStrong), paint(stem, c.inkStrong), paint(flag, c.inkStrong)];
  },
  (c) => {
    const body = box(0.62, 0.12, 0.28, 0, 0, 0);
    const keys = box(0.56, 0.03, 0.16, 0, 0.12, 0.05);
    const black = [-0.2, -0.12, 0.04, 0.12, 0.2].map((x) => paint(box(0.04, 0.03, 0.09, x, 0.15, 0.02), c.inkStrong));
    return [paint(body, c.ink), paint(keys, c.paper), ...black];
  },
  (c) => {
    const drum = new THREE.CylinderGeometry(0.22, 0.22, 0.3, 8).translate(0, 0.15, 0);
    const skin = new THREE.CylinderGeometry(0.23, 0.23, 0.02, 8).translate(0, 0.3, 0);
    const stick = (side: number) =>
      new THREE.CylinderGeometry(0.02, 0.02, 0.36, 5).rotateZ(side * 0.9).translate(side * 0.1, 0.42, 0.08);
    return [paint(drum, c.red), paint(skin, c.paper), paint(stick(1), c.wood), paint(stick(-1), c.wood)];
  },
];

// ---- 体育：ボール、跳び箱、コーン ----
const taiiku: Build[] = [
  (c) => {
    const r = 0.2;
    const ball = paint(new THREE.IcosahedronGeometry(r, 1).translate(0, r, 0), c.paper);
    // 五角形の所（元の 12 頂点）に触れる面を黒く塗る
    const col = ball.getAttribute("color");
    const pos = ball.getAttribute("position");
    const ico = new THREE.IcosahedronGeometry(r, 0);
    const corners = ico.getAttribute("position");
    const isCorner = (x: number, y: number, z: number) => {
      for (let q = 0; q < corners.count; q++) {
        if (Math.hypot(x - corners.getX(q), y - corners.getY(q), z - corners.getZ(q)) < 1e-4) return true;
      }
      return false;
    };
    for (let f = 0; f < pos.count; f += 3) {
      let dark = false;
      for (let k = 0; k < 3; k++) dark ||= isCorner(pos.getX(f + k), pos.getY(f + k) - r, pos.getZ(f + k));
      if (dark) for (let m = 0; m < 3; m++) col.setXYZ(f + m, c.inkStrong.r, c.inkStrong.g, c.inkStrong.b);
    }
    ico.dispose();
    return [ball];
  },
  (c) => {
    const tiers = [0, 1, 2].map((i) => paint(box(0.5 - i * 0.05, 0.12, 0.3 - i * 0.02, 0, i * 0.12, 0), c.wood));
    const top = box(0.36, 0.06, 0.24, 0, 0.36, 0);
    return [...tiers, paint(top, c.paper)];
  },
  (c) => {
    const foot = box(0.34, 0.03, 0.34, 0, 0, 0);
    const cone = new THREE.ConeGeometry(0.13, 0.46, 8).translate(0, 0.26, 0);
    const stripe = new THREE.CylinderGeometry(0.075, 0.095, 0.08, 8).translate(0, 0.27, 0);
    return [paint(foot, c.red), paint(cone, c.red), paint(stripe, c.paper)];
  },
];

// ---- 図工：パレット、絵筆、イーゼル ----
const zuko: Build[] = [
  (c) => {
    const s = new THREE.Shape();
    s.absellipse(0, 0, 0.3, 0.22, 0, Math.PI * 2, false, 0);
    s.holes.push(new THREE.Path().absarc(0.16, -0.06, 0.05, 0, Math.PI * 2, true));
    const plate = slab(s, 0.03, 8).rotateX(-Math.PI / 2).translate(0, 0.02, 0);
    const dabs: [THREE.Color, number, number][] = [
      [c.red, -0.15, -0.05],
      [c.yellow, -0.05, -0.13],
      [c.teal, 0.07, -0.14],
      [c.purple, -0.12, 0.08],
      [c.leaf, 0.02, 0.1],
    ];
    return [
      paint(plate, c.paper),
      ...dabs.map(([col, x, z]) => paint(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 6).translate(x, 0.04, z), col)),
    ];
  },
  (c) => {
    const cup = new THREE.CylinderGeometry(0.12, 0.1, 0.22, 8).translate(0, 0.11, 0);
    const brush = (x: number, tilt: number, tip: THREE.Color) => [
      paint(new THREE.CylinderGeometry(0.02, 0.02, 0.42, 5).translate(0, 0.21, 0).rotateZ(tilt).translate(x, 0.12, 0), c.wood),
      paint(new THREE.ConeGeometry(0.03, 0.08, 5).translate(0, 0.46, 0).rotateZ(tilt).translate(x, 0.12, 0), tip),
    ];
    return [paint(cup, c.glass), ...brush(-0.03, 0.25, c.red), ...brush(0.03, -0.2, c.teal)];
  },
  (c) => {
    const leg = (x: number, tilt: number) => new THREE.CylinderGeometry(0.02, 0.02, 0.7, 4).rotateZ(tilt).translate(x, 0.37, 0);
    const back = new THREE.CylinderGeometry(0.02, 0.02, 0.66, 4).rotateX(-0.35).translate(0, 0.35, -0.12);
    const canvas = box(0.36, 0.32, 0.02, 0, 0.3, 0.05).rotateX(-0.12);
    const sun = box(0.1, 0.1, 0.01, 0.07, 0.48, 0.065).rotateX(-0.12);
    const hill = box(0.3, 0.08, 0.01, 0, 0.33, 0.065).rotateX(-0.12);
    return [
      paint(leg(-0.14, -0.12), c.wood),
      paint(leg(0.14, 0.12), c.wood),
      paint(back, c.wood),
      paint(canvas, c.paper),
      paint(sun, c.yellow),
      paint(hill, c.leaf),
    ];
  },
];

// ---- 家庭：鍋、糸巻き、フライパン ----
const katei: Build[] = [
  (c) => {
    const pot = new THREE.CylinderGeometry(0.22, 0.2, 0.24, 8).translate(0, 0.12, 0);
    const lid = new THREE.CylinderGeometry(0.06, 0.23, 0.06, 8).translate(0, 0.27, 0);
    const knob = new THREE.CylinderGeometry(0.03, 0.03, 0.04, 6).translate(0, 0.32, 0);
    const ear = (side: number) => box(0.08, 0.03, 0.06, side * 0.25, 0.18, 0);
    return [paint(pot, c.stone), paint(lid, c.stone), paint(knob, c.inkStrong), paint(ear(1), c.inkStrong), paint(ear(-1), c.inkStrong)];
  },
  (c) => {
    const end = (y: number) => new THREE.CylinderGeometry(0.14, 0.14, 0.04, 8).translate(0, y, 0);
    const thread = new THREE.CylinderGeometry(0.1, 0.1, 0.22, 8).translate(0, 0.15, 0);
    const needle = new THREE.CylinderGeometry(0.008, 0.008, 0.3, 4).rotateZ(0.5).translate(0.16, 0.2, 0.06);
    return [paint(end(0.02), c.wood), paint(thread, c.red), paint(end(0.28), c.wood), paint(needle, c.stone)];
  },
  (c) => {
    const pan = new THREE.CylinderGeometry(0.22, 0.18, 0.06, 8).translate(0, 0.03, 0);
    const handle = box(0.28, 0.035, 0.05, 0.34, 0.03, 0);
    const white = new THREE.CylinderGeometry(0.13, 0.13, 0.015, 8).scale(1, 1, 0.85).translate(-0.02, 0.065, 0.01);
    const yolk = new THREE.IcosahedronGeometry(0.05, 0).scale(1, 0.6, 1).translate(-0.02, 0.08, 0.01);
    return [paint(pan, c.inkStrong), paint(handle, c.wood), paint(white, c.paper), paint(yolk, c.yellow)];
  },
];

// ---- 英語：時計塔、電話ボックス、ABC ----
/** 文字の板。高さ 0.4 の A・B・C を、左下を原点にして作る */
function letter(ch: "A" | "B" | "C") {
  if (ch === "A") {
    const s = polygon([[0, 0], [0.11, 0], [0.15, 0.11], [0.25, 0.11], [0.29, 0], [0.4, 0], [0.26, 0.4], [0.14, 0.4]]);
    s.holes.push(hole([[0.17, 0.19], [0.23, 0.19], [0.2, 0.29]]));
    return s;
  }
  if (ch === "B") {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(0.18, 0);
    s.absarc(0.18, 0.105, 0.105, -Math.PI / 2, Math.PI / 2, false);
    s.absarc(0.17, 0.305, 0.095, -Math.PI / 2, Math.PI / 2, false);
    s.lineTo(0, 0.4);
    s.lineTo(0, 0);
    s.holes.push(rectHole(0.09, 0.07, 0.17, 0.14), rectHole(0.09, 0.27, 0.16, 0.34));
    return s;
  }
  const s = new THREE.Shape();
  s.absarc(0.2, 0.2, 0.2, 0.7, Math.PI * 2 - 0.7, false);
  s.absarc(0.2, 0.2, 0.1, Math.PI * 2 - 0.7, 0.7, true);
  return s;
}

const eigo: Build[] = [
  (c) => {
    const tower = box(0.26, 0.84, 0.26, 0, 0, 0);
    const band = box(0.3, 0.06, 0.3, 0, 0.6, 0);
    const roof = pyramid(0.32, 0.34, 0.84);
    const face = new THREE.CylinderGeometry(0.095, 0.095, 0.02, 8).rotateX(Math.PI / 2).translate(0, 0.73, 0.14);
    const hourHand = box(0.018, 0.055, 0.01, 0, 0.73, 0.155);
    const minuteHand = box(0.075, 0.016, 0.01, 0.034, 0.73, 0.155);
    return [
      paint(tower, c.sand),
      paint(band, c.sand),
      paint(roof, c.ink),
      paint(face, c.paper),
      paint(hourHand, c.inkStrong),
      paint(minuteHand, c.inkStrong),
    ];
  },
  (c) => {
    const body = box(0.28, 0.6, 0.28, 0, 0, 0);
    const cap = box(0.32, 0.06, 0.32, 0, 0.6, 0);
    const panes = [0.28, 0.42].flatMap((y) => [-0.06, 0.06].map((x) => paint(box(0.09, 0.1, 0.01, x, y, 0.142), c.glass)));
    return [paint(body, c.red), paint(cap, c.red), ...panes];
  },
  (c) => {
    const colors = [c.yellow, c.teal, c.red];
    // 3 文字を少しずつ前後にずらして並べる。全体の幅は約 0.8
    return (["A", "B", "C"] as const).map((ch, i) =>
      paint(slab(letter(ch), 0.08, 5).scale(0.7, 0.7, 1).translate(-0.4 + i * 0.27, 0, (i - 1) * -0.05), colors[i]),
    );
  },
];

// ---- 生活：おうち、ひまわり、ポスト ----
const seikatsu: Build[] = [
  (c) => {
    const wall = box(0.6, 0.34, 0.44, 0, 0, 0);
    const roof = pyramid(0.72, 0.3, 0.34);
    const door = box(0.12, 0.2, 0.01, 0.12, 0, 0.222);
    const window = box(0.14, 0.12, 0.01, -0.16, 0.12, 0.222);
    return [paint(wall, c.paper), paint(roof, c.red), paint(door, c.wood), paint(window, c.glass)];
  },
  (c) => {
    const stem = new THREE.CylinderGeometry(0.025, 0.03, 0.5, 5).translate(0, 0.25, 0);
    const leaf = new THREE.IcosahedronGeometry(0.1, 0).scale(1.4, 0.35, 0.8).rotateZ(0.5).translate(0.1, 0.22, 0);
    const petals = new THREE.CylinderGeometry(0.2, 0.2, 0.03, 10).rotateX(Math.PI / 2).translate(0, 0.62, 0.02);
    const core = new THREE.CylinderGeometry(0.11, 0.11, 0.05, 10).rotateX(Math.PI / 2).translate(0, 0.62, 0.04);
    return [paint(stem, c.leaf), paint(leaf, c.leaf), paint(petals, c.yellow), paint(core, c.wood)];
  },
  (c) => {
    const body = new THREE.CylinderGeometry(0.15, 0.15, 0.42, 10).translate(0, 0.21, 0);
    const top = new THREE.SphereGeometry(0.15, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.42, 0);
    const slot = box(0.17, 0.025, 0.01, 0, 0.3, 0.15);
    const foot = box(0.34, 0.04, 0.34, 0, 0, 0);
    return [paint(body, c.red), paint(top, c.red), paint(slot, c.inkStrong), paint(foot, c.stone)];
  },
];

const BUILDS: Record<SubjectId, Build[]> = { sansu, kokugo, rika, shakai, eigo, ongaku, taiiku, zuko, katei, seikatsu };

/** 島の教科の飾りを 1 つの形にする。原点は島の中心、座標は広い画面の半径で作る絵と同じ。飾りが無い島は null */
export function buildLandmarks(id: SubjectId, colors: LandmarkColors): THREE.BufferGeometry | null {
  const builds = BUILDS[id];
  const spots = landmarkSpots(id);
  if (spots.length === 0) return null;
  const k = isHighland(id) ? HILL_LANDMARK_SCALE : LANDMARK_SCALE;
  const parts: Part[] = [];
  spots.forEach((s, i) => {
    for (const p of builds[i % builds.length](colors)) {
      p.scale(k, k, k);
      p.rotateY(s.rot);
      p.translate(s.x, s.y, s.z);
      parts.push(p);
    }
  });
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}
