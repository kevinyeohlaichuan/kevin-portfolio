import { useEffect, useRef, useState } from "react";

/**
 * Pixel art made the way it is actually made: hand-authored sprites on a
 * fixed 14-colour palette, a 128x80 logical buffer, integer upscaling with
 * smoothing off, and a 12 fps step timer rather than a smooth tween.
 *
 * Sprites are written as character rows so the silhouette is legible in the
 * source — the same way you would read them in Aseprite.
 *
 * Canvas 2D, no engine, roughly 6 KB.
 */

const W = 128;
const H = 80;

const PALETTE: Record<string, string> = {
  ".": "transparent",
  "0": "#080a0e", // void
  "1": "#100d1c", // outline
  "2": "#2a2348", // robe dark
  "3": "#463a76", // robe mid
  "4": "#6f5fb4", // robe light
  "5": "#ffcfa8", // skin
  "6": "#1a1730", // hair
  "7": "#b69cff", // violet
  "8": "#8ee3c0", // jade
  "9": "#ffb893", // peach
  a: "#f7f4ff", // ink
  b: "#221d3a", // rock dark
  c: "#39315e", // rock mid
  d: "#514785", // rock light
};

const ORDER = Object.keys(PALETTE);
const INDEX: Record<string, number> = Object.fromEntries(
  ORDER.map((key, i) => [key, i]),
);
const RGBA = ORDER.map((key) => {
  const hex = PALETTE[key];
  if (hex === "transparent") return [0, 0, 0, 0] as const;
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
    255,
  ] as const;
});

/** A standing cultivator. Silhouette first: hair, shoulders, robe flare. */
const FIGURE = [
  "....6666....",
  "...666666...",
  "..66666666..",
  "..66555566..",
  "..65555556..",
  "..65555556..",
  "..66555566..",
  "...655556...",
  "....5555....",
  "...1444441..",
  "..144444441.",
  ".14444444441",
  ".14443344441",
  ".14433334441",
  ".14333333441",
  "..1333333441",
  "..1333333341",
  "..133333331.",
  "..123333321.",
  "..12333332..",
  "..12233222..",
  "..122..2221.",
  ".1122..12211",
];

/** Sword planted point-down: tip, fuller, guard, grip, pommel. */
const SWORD = [
  "...7...",
  "..777..",
  ".77777.",
  "7.777.7",
  "..aaa..",
  "..a7a..",
  "..aaa..",
  "..aaa..",
  "..aaa..",
  "..aaa..",
  "..aaa..",
  "..aaa..",
  "..aaa..",
  "..aaa..",
  "..aaa..",
  "..aaa..",
  "..aaa..",
  "...a...",
  "...a...",
];

type Buffer = Uint8Array;
const at = (x: number, y: number) => y * W + x;

function plot(buf: Buffer, x: number, y: number, key: string) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= W || py >= H) return;
  const value = INDEX[key];
  if (value === undefined || key === ".") return;
  buf[at(px, py)] = value;
}

function blit(buf: Buffer, sprite: string[], ox: number, oy: number) {
  for (let y = 0; y < sprite.length; y += 1) {
    const row = sprite[y];
    for (let x = 0; x < row.length; x += 1) {
      const key = row[x];
      if (key === ".") continue;
      plot(buf, ox + x, oy + y, key);
    }
  }
}

function rect(buf: Buffer, x: number, y: number, w: number, h: number, key: string) {
  for (let j = 0; j < h; j += 1) for (let i = 0; i < w; i += 1) plot(buf, x + i, y + j, key);
}

function disc(buf: Buffer, cx: number, cy: number, r: number, key: string) {
  for (let y = -r; y <= r; y += 1) {
    for (let x = -r; x <= r; x += 1) {
      if (x * x + y * y <= r * r) plot(buf, cx + x, cy + y, key);
    }
  }
}

/** Deterministic field so stars do not shimmer between renders. */
const STARS = Array.from({ length: 60 }, (_, i) => {
  const a = Math.sin(i * 12.9898) * 43758.5453;
  const b = Math.sin(i * 78.233) * 12345.6789;
  return {
    x: Math.floor((a - Math.floor(a)) * W),
    y: Math.floor((b - Math.floor(b)) * 46),
    phase: i % 8,
  };
});

function render(buf: Buffer, frame: number) {
  buf.fill(INDEX["0"]);

  for (const star of STARS) {
    if ((Math.floor(frame / 10) + star.phase) % 8 === 0) continue;
    plot(buf, star.x, star.y, star.phase % 4 === 0 ? "a" : "d");
  }

  // Moon, with a crescent bitten out of it.
  disc(buf, 100, 17, 10, "c");
  disc(buf, 100, 17, 9, "d");
  disc(buf, 95, 13, 8, "0");

  // Floating island, bobbing on a 1px step.
  const bob = Math.round(Math.sin(frame / 30) * 1.4);
  const gy = 52 + bob;
  rect(buf, 34, gy, 60, 2, "d");
  rect(buf, 32, gy + 2, 64, 3, "c");
  rect(buf, 38, gy + 5, 52, 3, "c");
  rect(buf, 44, gy + 8, 40, 3, "b");
  rect(buf, 52, gy + 11, 24, 3, "b");
  rect(buf, 58, gy + 14, 12, 2, "b");
  rect(buf, 62, gy + 16, 5, 2, "b");
  // Dithered lip.
  for (let x = 33; x < 95; x += 2) plot(buf, x, gy - 1, "7");

  // Sword planted in the rock, to the figure's left.
  blit(buf, SWORD, 44, gy - 19 + bob * 0);

  // Figure, breathing on a 2-frame cycle.
  const breathe = Math.floor(frame / 24) % 2;
  blit(buf, FIGURE, 60, gy - 23 + breathe);

  // Qi gathering at the blade: a widening ellipse on a 4-step cycle, drawn as
  // a clean arc rather than scattered points so it reads at this resolution.
  const step = Math.floor(frame / 5) % 4;
  const rx = 5 + step * 2;
  const ry = 2 + step;
  for (let a = 0; a < 22; a += 1) {
    const ang = (a / 22) * Math.PI * 2;
    plot(buf, 47 + Math.cos(ang) * rx, gy - 3 + Math.sin(ang) * ry, step > 2 ? "8" : "7");
  }

  // Motes rising off the island.
  for (let i = 0; i < 9; i += 1) {
    const my = gy - 2 - ((frame * 0.6 + i * 8) % 34);
    const mx = 38 + i * 6 + Math.round(Math.sin((frame + i * 22) / 16) * 2);
    plot(buf, mx, my, i % 3 === 0 ? "8" : "7");
  }
}

export function PixelVigil() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(4);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const buf: Buffer = new Uint8Array(W * H);
    const image = ctx.createImageData(W, H);
    let frame = 0;
    let raf = 0;
    let last = 0;
    let visible = true;

    const observer = new IntersectionObserver(
      ([entry]) => { visible = entry.isIntersecting; },
      { rootMargin: "140px" },
    );
    observer.observe(canvas);

    const fit = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      // Integer scaling only. A fractional scale destroys pixel art.
      const next = Math.max(2, Math.min(7, Math.floor(parent.clientWidth / W)));
      setScale(next);
      canvas.width = W;
      canvas.height = H;
      canvas.style.width = `${W * next}px`;
      canvas.style.height = `${H * next}px`;
      ctx.imageSmoothingEnabled = false;
    };
    fit();
    const resize = new ResizeObserver(fit);
    if (canvas.parentElement) resize.observe(canvas.parentElement);

    const paint = () => {
      render(buf, frame);
      const data = image.data;
      for (let i = 0; i < buf.length; i += 1) {
        const [r, g, b, a] = RGBA[buf[i]];
        const o = i * 4;
        data[o] = r;
        data[o + 1] = g;
        data[o + 2] = b;
        data[o + 3] = a;
      }
      ctx.putImageData(image, 0, 0);
    };

    if (reduced) {
      frame = 48;
      paint();
      return () => {
        observer.disconnect();
        resize.disconnect();
      };
    }

    const loop = (now: number) => {
      raf = window.requestAnimationFrame(loop);
      // 12 fps on purpose: pixel animation reads better on a step timer.
      if (now - last < 1000 / 12) return;
      last = now;
      if (!visible) return;
      frame += 1;
      paint();
    };
    raf = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(raf);
      observer.disconnect();
      resize.disconnect();
    };
  }, []);

  return (
    <figure className="pixel-vigil">
      <div className="pixel-vigil-frame">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Pixel-art scene: a robed cultivator standing on a floating island beside a planted sword, beneath a crescent moon"
        />
      </div>
      <figcaption>
        <strong>128 × 80 · 14 colours · 12 fps</strong>
        <span>
          Hand-authored sprites on a low-resolution buffer, scaled {scale}× with
          smoothing off — the same constraints as the sprite work in the games.
        </span>
      </figcaption>
    </figure>
  );
}
