export interface TreemapItem {
  id: string;
  value: number;
}

export interface TreemapRect {
  id: string;
  value: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function worstRatio(row: number[], side: number): number {
  const sum = row.reduce((a, b) => a + b, 0);
  const max = Math.max(...row);
  const min = Math.min(...row);
  const s2 = side * side;
  const sum2 = sum * sum;
  return Math.max((s2 * max) / sum2, sum2 / (s2 * min));
}

/** Lays out a finished row along the shorter side of `box`, returns the remaining box. */
function placeRow(items: TreemapItem[], areas: number[], box: Box, out: TreemapRect[]): Box {
  const sum = areas.reduce((a, b) => a + b, 0);
  if (box.w >= box.h) {
    // column on the left
    const colW = sum / box.h;
    let y = box.y;
    items.forEach((it, i) => {
      const h = areas[i] / colW;
      out.push({ id: it.id, value: it.value, x: box.x, y, w: colW, h });
      y += h;
    });
    return { x: box.x + colW, y: box.y, w: box.w - colW, h: box.h };
  }
  const rowH = sum / box.w;
  let x = box.x;
  items.forEach((it, i) => {
    const w = areas[i] / rowH;
    out.push({ id: it.id, value: it.value, x, y: box.y, w, h: rowH });
    x += w;
  });
  return { x: box.x, y: box.y + rowH, w: box.w, h: box.h - rowH };
}

/**
 * Squarified treemap (Bruls et al.) in a `width`×`height` box. Items with a
 * non-positive value are dropped. Output rects are in input-sorted (desc) order.
 */
export function squarify(input: TreemapItem[], width: number, height: number): TreemapRect[] {
  const items = input.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const total = items.reduce((s, i) => s + i.value, 0);
  if (!items.length || width <= 0 || height <= 0 || total <= 0) return [];
  const scale = (width * height) / total;
  const areas = items.map((i) => i.value * scale);

  const out: TreemapRect[] = [];
  let box: Box = { x: 0, y: 0, w: width, h: height };
  let rowItems: TreemapItem[] = [];
  let rowAreas: number[] = [];

  for (let i = 0; i < items.length; i++) {
    const side = Math.min(box.w, box.h);
    const candidate = [...rowAreas, areas[i]];
    if (rowAreas.length === 0 || worstRatio(candidate, side) <= worstRatio(rowAreas, side)) {
      rowItems.push(items[i]);
      rowAreas = candidate;
    } else {
      box = placeRow(rowItems, rowAreas, box, out);
      rowItems = [items[i]];
      rowAreas = [areas[i]];
    }
  }
  if (rowItems.length) placeRow(rowItems, rowAreas, box, out);
  return out;
}
