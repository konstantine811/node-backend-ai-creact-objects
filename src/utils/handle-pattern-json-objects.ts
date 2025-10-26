// utils

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return { r, g, b };
}

function rgbToHex(r: number, g: number, b: number) {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const toHex = (v: number) => clamp(v).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function makeGradientColors(
  count: number,
  fromHex: string,
  toHex: string,
  fallback: string
) {
  if (!fromHex || !toHex) {
    // no gradient -> same color for all
    return Array.from({ length: count }, () => fallback || "#ffffff");
  }
  const from = hexToRgb(fromHex);
  const to = hexToRgb(toHex);

  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0 : i / (count - 1);
    const r = lerp(from.r, to.r, t);
    const g = lerp(from.g, to.g, t);
    const b = lerp(from.b, to.b, t);
    return rgbToHex(r, g, b);
  });
}

function makeCirclePositions(count: number, circleRadius: number) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2; // radians
    const x = circleRadius * Math.cos(angle);
    const z = circleRadius * Math.sin(angle);
    return [Number(x.toFixed(2)), 0, Number(z.toFixed(2))] as [
      number,
      number,
      number
    ];
  });
}

function makeLinePositions(count: number, start: number[], step: number[]) {
  const s = Array.isArray(start) && start.length === 3 ? start : [0, 0, 0];
  const d = Array.isArray(step) && step.length === 3 ? step : [2, 0, 0];

  return Array.from({ length: count }, (_, i) => {
    return [s[0] + d[0] * i, s[1] + d[1] * i, s[2] + d[2] * i] as [
      number,
      number,
      number
    ];
  });
}

// NEW: 3D grid
function makeGrid3DPositions(
  count: number,
  gridSize?: number[],
  spacing?: number[]
) {
  // gridSize: [nx,ny,nz]
  // spacing: [sx,sy,sz]
  const [nx, ny, nz] =
    Array.isArray(gridSize) && gridSize.length === 3
      ? gridSize
      : guessGrid(count); // fallback

  const [sx, sy, sz] =
    Array.isArray(spacing) && spacing.length === 3 ? spacing : [2, 2, 2];

  const out: [number, number, number][] = [];
  let i = 0;

  // центровано навколо (0,0,0) для краси
  const ox = -((nx - 1) * sx) / 2;
  const oy = -((ny - 1) * sy) / 2;
  const oz = -((nz - 1) * sz) / 2;

  for (let ix = 0; ix < nx; ix++) {
    for (let iy = 0; iy < ny; iy++) {
      for (let iz = 0; iz < nz; iz++) {
        if (i >= count) break;
        out.push([ox + ix * sx, oy + iy * sy, oz + iz * sz]);
        i++;
      }
    }
  }

  return out;
}

function guessGrid(count: number): [number, number, number] {
  // наївно — корінь кубічний
  const n = Math.ceil(Math.cbrt(count));
  return [n, n, n];
}

// NEW: distribute points on sphere surface (Fibonacci sphere)
function makeSphereShellPositions(count: number, sphereRadius: number) {
  const out: [number, number, number][] = [];
  const golden = Math.PI * (3 - Math.sqrt(5)); // ~2.399963...

  for (let i = 0; i < count; i++) {
    const t = i + 0.5;
    const y = 1 - (t / count) * 2; // from 1 to -1
    const r = Math.sqrt(1 - y * y);
    const phi = golden * i;

    const x = Math.cos(phi) * r;
    const z = Math.sin(phi) * r;

    out.push([x * sphereRadius, y * sphereRadius, z * sphereRadius]);
  }
  return out;
}

// NEW: DNA helix (single or double strand)
function makeDnaHelixPositions(
  count: number,
  turns: number,
  radiusHelix: number,
  stepHeight: number,
  doubleStrand: boolean
) {
  // helixTurns = кількість обертів (2π за оберт)
  // helixStep = вертикальна відстань між сусідніми точками вздовж осі Y
  // helixRadius = радіус по XZ
  const out: [number, number, number][] = [];

  for (let i = 0; i < count; i++) {
    const t = (i / count) * (turns * 2 * Math.PI); // кут
    const y = i * stepHeight;

    // перша спіраль
    const x1 = radiusHelix * Math.cos(t);
    const z1 = radiusHelix * Math.sin(t);
    out.push([x1, y, z1]);

    if (doubleStrand) {
      // друга спіраль зміщена по фазі на π
      const x2 = radiusHelix * Math.cos(t + Math.PI);
      const z2 = radiusHelix * Math.sin(t + Math.PI);
      out.push([x2, y, z2]);
    }
  }

  // якщо doubleStrand=true, ми створили 2*count точок
  return out.slice(0, count);
  // (можеш прибрати slice і тоді реально буде подвійно більше об'єктів)
}

function expandPattern(pattern: any) {
  const shape = pattern.shape === "cube" ? "cube" : "sphere";

  const count =
    typeof pattern.count === "number" && pattern.count > 0 ? pattern.count : 1;

  const radius = typeof pattern.radius === "number" ? pattern.radius : 1;

  const size =
    Array.isArray(pattern.size) && pattern.size.length === 3
      ? pattern.size
      : shape === "cube"
      ? [1, 1, 1]
      : [0, 0, 0];

  const arrangement = pattern.arrangement;

  let positions: [number, number, number][];

  if (arrangement === "line") {
    positions = makeLinePositions(count, pattern.start, pattern.step);
  } else if (arrangement === "circle") {
    const circleRadius =
      typeof pattern.circleRadius === "number" ? pattern.circleRadius : 5;
    positions = makeCirclePositions(count, circleRadius);
  } else if (arrangement === "grid3d") {
    positions = makeGrid3DPositions(count, pattern.gridSize, pattern.spacing);
  } else if (arrangement === "sphereShell") {
    const sphereRadius =
      typeof pattern.sphereRadius === "number" ? pattern.sphereRadius : 5;
    positions = makeSphereShellPositions(count, sphereRadius);
  } else if (arrangement === "dnaHelix") {
    const turns =
      typeof pattern.helixTurns === "number" ? pattern.helixTurns : 3;
    const rad =
      typeof pattern.helixRadius === "number" ? pattern.helixRadius : 2;
    const step = typeof pattern.helixStep === "number" ? pattern.helixStep : 1;
    const dbl = !!pattern.doubleStrand;
    positions = makeDnaHelixPositions(count, turns, rad, step, dbl);
  } else {
    // fallback: just stack at origin
    positions = Array.from(
      { length: count },
      () => [0, 0, 0] as [number, number, number]
    );
  }

  // кольори
  const baseColor = pattern.baseColor || "#ffffff";
  const gradFrom = pattern?.gradient?.from;
  const gradTo = pattern?.gradient?.to;
  const colors = makeGradientColors(count, gradFrom, gradTo, baseColor);

  // будуємо фінальний масив об'єктів для рендера
  return positions.map((pos, i) => {
    if (shape === "sphere") {
      return {
        type: "sphere",
        color: colors[i % colors.length],
        radius: radius,
        size: [0, 0, 0],
        position: pos,
      };
    } else {
      // cube
      return {
        type: "cube",
        color: colors[i % colors.length],
        radius: 0,
        size: size,
        position: pos,
      };
    }
  });
}

export function toObjectsForFrontend(parsed: any) {
  // якщо модель повернула FORM A
  if (Array.isArray(parsed?.objects)) {
    return parsed.objects
      .filter((o: any) => o && (o.type === "cube" || o.type === "sphere"))
      .map((o: any) => {
        const type = o.type === "cube" ? "cube" : "sphere";
        const color = typeof o.color === "string" ? o.color : "#ffffff";

        const radius =
          type === "sphere" ? (typeof o.radius === "number" ? o.radius : 1) : 0;

        const size =
          type === "cube"
            ? Array.isArray(o.size) && o.size.length === 3
              ? o.size
              : [1, 1, 1]
            : [0, 0, 0];

        const position =
          Array.isArray(o.position) && o.position.length === 3
            ? o.position
            : [0, 0, 0];

        return { type, color, radius, size, position };
      });
  }

  // якщо модель повернула FORM B
  if (parsed?.pattern && typeof parsed.pattern === "object") {
    return expandPattern(parsed.pattern);
  }

  return [];
}
