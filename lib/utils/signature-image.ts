/**
 * Turns a scanned or photographed signature into ink on a transparent
 * background, cropped to the strokes. Browser only (uses canvas).
 */

const MAX_SIDE = 1600;
/** Darkness (relative to the local paper) below which a pixel is paper. */
const PAPER_LEVEL = 0.14;
/** Darkness at which a pixel is fully opaque ink. */
const INK_LEVEL = 0.45;
const SOLID_ALPHA = 64;
const CROP_PAD = 6;

export type CleanSignature = {
  blob: Blob;
  width: number;
  height: number;
};

function luminance(r: number, g: number, b: number) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Paper brightness per block (90th percentile), dilated so blocks full of
 * ink borrow from their neighbours, then interpolated per pixel. This follows
 * shadows and uneven light in phone photos.
 */
function paperMap(lum: Float32Array, width: number, height: number) {
  const block = Math.max(16, Math.round(Math.max(width, height) / 24));
  const bw = Math.ceil(width / block);
  const bh = Math.ceil(height / block);
  const raw = new Float32Array(bw * bh);
  const hist = new Uint32Array(256);

  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      hist.fill(0);
      let count = 0;
      const y1 = Math.min(height, (by + 1) * block);
      const x1 = Math.min(width, (bx + 1) * block);
      for (let y = by * block; y < y1; y++) {
        for (let x = bx * block; x < x1; x++) {
          hist[Math.min(255, lum[y * width + x] | 0)]++;
          count++;
        }
      }
      let target = count * 0.9;
      let level = 255;
      for (let v = 0; v < 256; v++) {
        target -= hist[v];
        if (target <= 0) {
          level = v;
          break;
        }
      }
      raw[by * bw + bx] = level;
    }
  }

  const blocks = new Float32Array(bw * bh);
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      let best = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = bx + dx;
          const y = by + dy;
          if (x >= 0 && y >= 0 && x < bw && y < bh) best = Math.max(best, raw[y * bw + x]);
        }
      }
      blocks[by * bw + bx] = best;
    }
  }

  return (x: number, y: number) => {
    const fx = Math.min(bw - 1, Math.max(0, (x + 0.5) / block - 0.5));
    const fy = Math.min(bh - 1, Math.max(0, (y + 0.5) / block - 0.5));
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const x1 = Math.min(bw - 1, x0 + 1);
    const y1 = Math.min(bh - 1, y0 + 1);
    const tx = fx - x0;
    const ty = fy - y0;
    const top = blocks[y0 * bw + x0] * (1 - tx) + blocks[y0 * bw + x1] * tx;
    const bottom = blocks[y1 * bw + x0] * (1 - tx) + blocks[y1 * bw + x1] * tx;
    return top * (1 - ty) + bottom * ty;
  };
}

/**
 * Removes specks and dark photo edges (table, scanner lid) that touch the
 * border. Signature strokes are thin, so a component that is large, touches
 * the border and fills much of its box is not ink.
 */
function dropNoise(alpha: Uint8ClampedArray, width: number, height: number) {
  const total = width * height;
  const label = new Int32Array(total).fill(-1);
  const stack = new Int32Array(total);
  const minArea = Math.max(6, Math.round(total * 0.00004));

  for (let start = 0; start < total; start++) {
    if (alpha[start] < SOLID_ALPHA || label[start] !== -1) continue;
    let top = 0;
    stack[top++] = start;
    label[start] = start;
    const members: number[] = [];
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    while (top > 0) {
      const p = stack[--top];
      members.push(p);
      const x = p % width;
      const y = (p - x) / width;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          const q = ny * width + nx;
          if (label[q] === -1 && alpha[q] >= SOLID_ALPHA) {
            label[q] = start;
            stack[top++] = q;
          }
        }
      }
    }

    const boxW = maxX - minX + 1;
    const boxH = maxY - minY + 1;
    const touchesBorder = minX === 0 || minY === 0 || maxX === width - 1 || maxY === height - 1;
    const fill = members.length / (boxW * boxH);
    const edgeBlock =
      touchesBorder && (boxW > width * 0.5 || boxH > height * 0.5) && fill > 0.3;
    if (members.length < minArea || edgeBlock) {
      for (const p of members) alpha[p] = 0;
    }
  }

  // Faint pixels only count next to real strokes.
  for (let p = 0; p < total; p++) {
    if (alpha[p] === 0 || alpha[p] >= SOLID_ALPHA) continue;
    const x = p % width;
    const y = (p - x) / width;
    let near = false;
    for (let dy = -2; dy <= 2 && !near; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const q = ny * width + nx;
        if (alpha[q] >= SOLID_ALPHA && label[q] !== -1) {
          near = true;
          break;
        }
      }
    }
    if (!near) alpha[p] = 0;
  }
}

/** Returns null when no ink could be found in the image. */
export async function cleanSignatureImage(source: Blob): Promise<CleanSignature | null> {
  const bitmap = await createImageBitmap(source);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const image = ctx.getImageData(0, 0, width, height);
  const px = image.data;
  const lum = new Float32Array(width * height);
  for (let p = 0, i = 0; p < lum.length; p++, i += 4) {
    lum[p] = luminance(px[i], px[i + 1], px[i + 2]);
  }

  const paperAt = paperMap(lum, width, height);
  const alpha = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const paper = Math.max(1, paperAt(x, y));
      const darkness = (paper - lum[p]) / paper;
      const a = (darkness - PAPER_LEVEL) / (INK_LEVEL - PAPER_LEVEL);
      alpha[p] = a <= 0 ? 0 : a >= 1 ? 255 : Math.round(a * 255);
    }
  }

  dropNoise(alpha, width, height);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const a = alpha[p];
      const i = p * 4;
      if (a === 0) {
        px[i + 3] = 0;
        continue;
      }
      // Remove the paper that was blended into the edge of each stroke.
      const paper = Math.max(1, paperAt(x, y));
      const t = a / 255;
      for (let c = 0; c < 3; c++) {
        const ink = (px[i + c] - paper * (1 - t)) / t;
        px[i + c] = Math.max(0, Math.min(255, ink));
      }
      px[i + 3] = a;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;

  ctx.putImageData(image, 0, 0);
  minX = Math.max(0, minX - CROP_PAD);
  minY = Math.max(0, minY - CROP_PAD);
  maxX = Math.min(width - 1, maxX + CROP_PAD);
  maxY = Math.min(height - 1, maxY + CROP_PAD);
  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  const out = document.createElement("canvas");
  out.width = cropW;
  out.height = cropH;
  const outCtx = out.getContext("2d");
  if (!outCtx) return null;
  outCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/png"));
  return blob ? { blob, width: cropW, height: cropH } : null;
}
