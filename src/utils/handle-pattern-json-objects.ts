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

// convert pattern -> objects[]
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

  if (arrangement === "circle") {
    const circleRadius =
      typeof pattern.circleRadius === "number" ? pattern.circleRadius : 5;
    positions = makeCirclePositions(count, circleRadius);
  } else if (arrangement === "line") {
    positions = makeLinePositions(count, pattern.start, pattern.step);
  } else {
    // fallback: всі в (0,0,0)
    positions = Array.from(
      { length: count },
      () => [0, 0, 0] as [number, number, number]
    );
  }

  // colors
  let fromColor = pattern?.gradient?.from;
  let toColor = pattern?.gradient?.to;
  const baseColor = pattern?.baseColor || "#ffffff";

  const colors = makeGradientColors(count, fromColor, toColor, baseColor);

  return positions.map((pos, i) => {
    if (shape === "sphere") {
      return {
        type: "sphere",
        color: colors[i],
        radius: radius,
        size: [0, 0, 0],
        position: pos,
      };
    } else {
      return {
        type: "cube",
        color: colors[i],
        radius: 0,
        size: size,
        position: pos,
      };
    }
  });
}

// main post-processing AFTER parsed = JSON.parse(assistantText)

export function toObjectsForFrontend(parsed: any) {
  // case 1: model gave explicit objects
  if (Array.isArray(parsed?.objects)) {
    const cleaned = parsed.objects
      .filter((o: any) => o && (o.type === "cube" || o.type === "sphere"))
      .map((o: any) => {
        const type = (o.type === "cube" ? "cube" : "sphere") as
          | "cube"
          | "sphere";
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

    return cleaned;
  }

  // case 2: model gave pattern
  if (parsed?.pattern && typeof parsed.pattern === "object") {
    return expandPattern(parsed.pattern);
  }

  // fallback
  return [];
}
