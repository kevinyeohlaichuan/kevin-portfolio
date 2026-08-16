import { useEffect, useMemo, useRef, useState } from "react";

/**
 * An interactive version of the Gamuda SS15 result: 239.8 MB of source
 * geometry reduced to a 34.6 MB web runtime. The slider drives a real
 * lattice decimation on a canvas — triangles are actually removed, not
 * faded — so the tradeoff between fidelity and payload is visible rather
 * than asserted.
 *
 * Canvas 2D on purpose: ~4 KB, no WebGL context, no engine. The heavy
 * runtimes on this site stay behind an explicit click.
 */

const SOURCE_MB = 239.8;
const SHIPPED_MB = 34.6;
const SOURCE_TRIS = 2_400_000;

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** A tower: stacked rings of vertices, tapering slightly toward the top. */
function buildTower(segments: number, floors: number): { rings: Vec3[][] } {
  const rings: Vec3[][] = [];
  for (let f = 0; f <= floors; f += 1) {
    const t = f / floors;
    const y = t * 3.1 - 1.55;
    const taper = 1 - t * 0.26;
    const ring: Vec3[] = [];
    for (let s = 0; s < segments; s += 1) {
      const a = (s / segments) * Math.PI * 2;
      // Rounded-rectangle footprint reads as a building, not a cylinder.
      const c = Math.cos(a);
      const si = Math.sin(a);
      const k = 2.6;
      const r = 1 / Math.pow(Math.pow(Math.abs(c), k) + Math.pow(Math.abs(si), k), 1 / k);
      ring.push({ x: c * r * 0.82 * taper, y, z: si * r * 0.82 * taper });
    }
    rings.push(ring);
  }
  return { rings };
}

export function MeshBudget() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [quality, setQuality] = useState(0.14);
  const [paused, setPaused] = useState(false);
  const qualityRef = useRef(quality);
  const pausedRef = useRef(paused);

  qualityRef.current = quality;
  pausedRef.current = paused;

  // Quality 0..1 maps onto a real lattice resolution.
  const { segments, triangles, megabytes, reduction } = useMemo(() => {
    const seg = Math.max(4, Math.round(4 + quality * 44));
    const flr = Math.max(3, Math.round(3 + quality * 45));
    const tris = seg * flr * 2;
    const ratio = tris / (48 * 48 * 2);
    const mb = SHIPPED_MB + ratio * (SOURCE_MB - SHIPPED_MB);
    return {
      segments: seg,
      triangles: Math.round(ratio * SOURCE_TRIS),
      megabytes: mb,
      reduction: Math.round((1 - mb / SOURCE_MB) * 100),
    };
  }, [quality]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let angle = reduced ? 0.6 : 0;
    let width = 0;
    let height = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const project = (p: Vec3, sin: number, cos: number) => {
      const x = p.x * cos - p.z * sin;
      const z = p.x * sin + p.z * cos;
      const depth = 4.0 + z;
      const scale = (Math.min(width, height) * 0.95) / depth;
      return {
        sx: width / 2 + x * scale,
        sy: height / 2 - p.y * scale,
        depth,
      };
    };

    const draw = () => {
      const q = qualityRef.current;
      const seg = Math.max(4, Math.round(4 + q * 44));
      const flr = Math.max(3, Math.round(3 + q * 45));
      const { rings } = buildTower(seg, flr);

      if (!pausedRef.current && !reduced) angle += 0.0042;
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);

      ctx.clearRect(0, 0, width, height);

      // Ground grid for spatial anchoring.
      ctx.strokeStyle = "rgba(182,156,255,0.10)";
      ctx.lineWidth = 1;
      for (let i = -4; i <= 4; i += 1) {
        const a = project({ x: i * 0.4, y: -1.6, z: -1.6 }, sin, cos);
        const b = project({ x: i * 0.4, y: -1.6, z: 1.6 }, sin, cos);
        const c = project({ x: -1.6, y: -1.6, z: i * 0.4 }, sin, cos);
        const d = project({ x: 1.6, y: -1.6, z: i * 0.4 }, sin, cos);
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.moveTo(c.sx, c.sy);
        ctx.lineTo(d.sx, d.sy);
        ctx.stroke();
      }

      const projected = rings.map((ring) => ring.map((p) => project(p, sin, cos)));

      // Wireframe: horizontal floor rings.
      for (let f = 0; f < projected.length; f += 1) {
        const ring = projected[f];
        const t = f / (projected.length - 1);
        ctx.beginPath();
        for (let s = 0; s < ring.length; s += 1) {
          const point = ring[s];
          if (s === 0) ctx.moveTo(point.sx, point.sy);
          else ctx.lineTo(point.sx, point.sy);
        }
        ctx.closePath();
        ctx.strokeStyle = `rgba(182,156,255,${0.2 + (1 - t) * 0.34})`;
        ctx.lineWidth = f === 0 || f === projected.length - 1 ? 1.4 : 0.85;
        ctx.stroke();
      }

      // Vertical struts.
      ctx.strokeStyle = "rgba(142,227,192,0.34)";
      ctx.lineWidth = 0.8;
      for (let s = 0; s < segments; s += 1) {
        ctx.beginPath();
        for (let f = 0; f < projected.length; f += 1) {
          const point = projected[f][s % projected[f].length];
          if (f === 0) ctx.moveTo(point.sx, point.sy);
          else ctx.lineTo(point.sx, point.sy);
        }
        ctx.stroke();
      }

      // Vertex dots only when the mesh is coarse enough to read them.
      if (seg * flr < 700) {
        ctx.fillStyle = "rgba(255,184,147,0.72)";
        for (const ring of projected) {
          for (const point of ring) {
            ctx.beginPath();
            ctx.arc(point.sx, point.sy, 1.15, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      frame = window.requestAnimationFrame(draw);
    };

    frame = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
    // `segments` is read for strut count; the loop reads live values via refs.
  }, [segments]);

  const overBudget = megabytes > 60;

  return (
    <div className="mesh-budget">
      <div className="mesh-budget-stage">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Wireframe tower at ${triangles.toLocaleString()} triangles, roughly ${megabytes.toFixed(1)} megabytes`}
        />
        <div className="mesh-budget-topline">
          <span>ASSET BUDGET · LIVE</span>
          <button type="button" onClick={() => setPaused((v) => !v)} aria-pressed={paused}>
            {paused ? "Resume" : "Pause"}
          </button>
        </div>
      </div>

      <div className="mesh-budget-panel">
        <div className="mesh-readout">
          <div>
            <strong>{triangles.toLocaleString()}</strong>
            <span>triangles</span>
          </div>
          <div>
            <strong className={overBudget ? "over" : "under"}>
              {megabytes.toFixed(1)} MB
            </strong>
            <span>estimated payload</span>
          </div>
          <div>
            <strong>{reduction}%</strong>
            <span>reduction from source</span>
          </div>
        </div>

        <label className="mesh-slider">
          <span>Mesh density</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={quality}
            onChange={(event) => setQuality(Number(event.target.value))}
            aria-label="Mesh density"
          />
          <span className="mesh-slider-ends" aria-hidden="true">
            <em>web-ready</em>
            <em>raw source</em>
          </span>
        </label>

        <p className="mesh-note">
          {overBudget ? (
            <>
              At this density the model is <strong>{megabytes.toFixed(1)} MB</strong>.
              On a Malaysian 4G connection that is a buyer who leaves before the
              building appears.
            </>
          ) : (
            <>
              This is the shipping range. Gamuda SS15 went out at{" "}
              <strong>{SHIPPED_MB} MB</strong> from a <strong>{SOURCE_MB} MB</strong>{" "}
              source, and the silhouette still reads correctly.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
