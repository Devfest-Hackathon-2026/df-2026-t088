// ジオラマ（CMP-011）の描画と React の境目。このファイルは three を読み込まない。
// 実物は scene.ts にあり、3D を使う時だけ後から読み込む（07_responsive_a11y.md）
import type { SubjectId } from "../../../data";
import type { MapArea } from "./layout";

export interface IslandDef {
  id: SubjectId;
  /** 遊べる島か。false の島は霧をまとう */
  open: boolean;
}

/** 島の頂上を画面へ写した点。付箋とアバターを HTML で重ねるために使う */
export interface IslandAnchor {
  id: SubjectId;
  /** canvas の左上からの CSS px */
  x: number;
  y: number;
  /** 全景の時を 1 とした見かけの大きさ */
  scale: number;
}

export interface DioramaOptions {
  canvas: HTMLCanvasElement;
  islands: IslandDef[];
  /** 最初に映す場所。高原の島から戻った時は高原（D-91）。無ければ海 */
  startArea?: MapArea;
  /** 位置が変わった時だけ呼ぶ。動きの間は毎フレーム呼ばれる */
  onAnchors: (anchors: IslandAnchor[]) => void;
  /** ポインターで島を押した */
  onIslandPress: (id: SubjectId) => void;
  /** ポインターで、今映していない場所を押した */
  onAreaPress: (area: MapArea) => void;
  /** ポインターが乗っている島が変わった */
  onIslandHover?: (id: SubjectId | null) => void;
  /** WebGL が失われた。呼び出し側は平面の地図へ戻す */
  onContextLost: () => void;
}

export interface DioramaHandle {
  /** 最初の1枚を描き終えた時に解決。失敗なら reject（WebGL を失った時も）。組み立て中に dispose されたら解決する。無ければ作った時点で描き終えている */
  ready?: Promise<void>;
  /** MOT-008。止まった時に解決する。途中で破棄や WebGL の喪失があっても解決する */
  zoomTo: (id: SubjectId) => Promise<void>;
  /** MOT-021。カメラが別の場所の全景へ移る。止まった時に解決する */
  showArea: (area: MapArea) => Promise<void>;
  /** MOT-010。途中で別の島を押されたら、動きを打ち切ってそちらを実行する */
  peek: (id: SubjectId) => void;
  /** MOT-013。付箋の hover と focus-visible から呼ぶ */
  setHighlight: (id: SubjectId | null) => void;
  dispose: () => void;
}

export type CreateDiorama = (options: DioramaOptions) => DioramaHandle;
