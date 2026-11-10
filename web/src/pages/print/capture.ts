// 写真の切り抜き。囲みの外は送らない（D-165）。canvas に描き直すので、位置情報（EXIF）は残らない
import type { Point, Rect } from "./types";

export const MAX_SIDE = 1600;
export const JPEG_QUALITY = 0.85;
/** 囲みが写真の面積のこれ未満なら小さすぎる */
const MIN_AREA_RATIO = 0.05;

/** 点の列の外接の四角。点が無ければ 0 の四角 */
export function lassoBounds(path: Point[]): Rect {
  if (path.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const xs = path.map((p) => p.x);
  const ys = path.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** 囲みの外接の四角が、写真の面積の 5% 未満なら true */
export function isTooSmall(bounds: Rect, imageWidth: number, imageHeight: number): boolean {
  const total = imageWidth * imageHeight;
  if (total <= 0) return true;
  return (bounds.width * bounds.height) / total < MIN_AREA_RATIO;
}

/** 四角の囲みを、左上から時計回りの点の列にする */
export function rectPath(rect: Rect): Point[] {
  const { x, y, width, height } = rect;
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
}

/** 長い辺が max 以下になるように縮めた大きさ。小さい時は拡大しない */
export function scaledSize(width: number, height: number, max: number = MAX_SIDE): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** 外接の四角で切り、囲みの外を白で塗って、JPEG にする */
export async function cropToLasso(image: CanvasImageSource & { width: number; height: number }, path: Point[]): Promise<Blob> {
  // 写真の外にはみ出した分は切り落とす
  const raw = lassoBounds(path);
  const x = Math.max(0, Math.floor(raw.x));
  const y = Math.max(0, Math.floor(raw.y));
  const right = Math.min(image.width, Math.ceil(raw.x + raw.width));
  const bottom = Math.min(image.height, Math.ceil(raw.y + raw.height));
  const bounds: Rect = { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) };
  // 点が 3 つ未満だと閉じた形にならない。四角で代える
  const shape = path.length >= 3 ? path : rectPath(bounds);

  const size = scaledSize(bounds.width, bounds.height);
  const scale = size.width / bounds.width;
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas が使えません");

  context.fillStyle = "white";
  context.fillRect(0, 0, size.width, size.height);
  context.save();
  context.scale(scale, scale);
  context.translate(-bounds.x, -bounds.y);
  context.beginPath();
  shape.forEach((p, i) => (i === 0 ? context.moveTo(p.x, p.y) : context.lineTo(p.x, p.y)));
  context.closePath();
  context.clip();
  context.drawImage(image, 0, 0, image.width, image.height);
  context.restore();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("写真を JPEG にできませんでした"))), "image/jpeg", JPEG_QUALITY);
  });
}
