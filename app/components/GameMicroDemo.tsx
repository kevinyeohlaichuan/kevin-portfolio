"use client";

import { useEffect, useRef, useState } from "react";
import type PhaserTypes from "phaser";

type GameMode = "system" | "nasi" | "infinity";

const gameCopy: Record<GameMode, { index: string; title: string; status: string; instruction: string; description: string; href?: string }> = {
  system: {
    index: "01",
    title: "I Got a System",
    status: "Current WIP · Godot",
    instruction: "Click to guide the host",
    description: "A cultivation game where you are the System: a floating companion that teaches an autonomous host.",
  },
  nasi: {
    index: "02",
    title: "Nasi Lemak Survivors",
    status: "Released · Google Play",
    instruction: "Move the pointer to survive",
    description: "A Malaysian survivor roguelite built end to end in Godot, including gameplay, pixel art, animation and release.",
    href: "https://play.google.com/store/apps/details?id=com.eternalamaris.nasilemak.survivors",
  },
  infinity: {
    index: "03",
    title: "To Infinity and Beyond",
    status: "Released · Itch.io",
    instruction: "Click or press Space to jump",
    description: "A solo-developed precision platformer designed, programmed, illustrated, animated and published in Godot.",
    href: "https://kevin-d-eternal.itch.io/to-infinity-and-beyond",
  },
};

export function GameMicroDemo() {
  const [mode, setMode] = useState<GameMode>("system");
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let game: { destroy: (removeCanvas?: boolean) => void } | null = null;

    void (async () => {
      const imported = await import("phaser");
      if (disposed) return;
      const Phaser = imported.default;

      const width = 860;
      const height = 430;
      const state = {
        pointerX: width * 0.7,
        pointerY: height * 0.55,
        hostX: width * 0.45,
        hostY: height * 0.55,
        velocityY: 0,
        grounded: true,
        time: 0,
        enemies: Array.from({ length: 11 }, (_, index) => ({
          angle: (index / 11) * Math.PI * 2,
          distance: 150 + (index % 4) * 36,
        })),
      };

      const scene = {
        create(this: PhaserTypes.Scene) {
          const graphics = this.add.graphics();
          this.input.on("pointermove", (pointer: { x: number; y: number }) => {
            state.pointerX = pointer.x;
            state.pointerY = pointer.y;
          });
          this.input.on("pointerdown", (pointer: { x: number; y: number }) => {
            state.pointerX = pointer.x;
            state.pointerY = pointer.y;
            if (mode === "infinity" && state.grounded) {
              state.velocityY = -8.8;
              state.grounded = false;
            }
          });
          this.input.keyboard?.on("keydown-SPACE", () => {
            if (mode === "infinity" && state.grounded) {
              state.velocityY = -8.8;
              state.grounded = false;
            }
          });
          this.data.set("graphics", graphics);
        },
        update(this: PhaserTypes.Scene, _time: number, delta: number) {
          const graphics = this.data.get("graphics") as PhaserTypes.GameObjects.Graphics;
          const dt = Math.min(delta / 16.667, 2);
          state.time += delta;
          graphics.clear();

          graphics.lineStyle(1, 0x322f41, 0.72);
          for (let x = 0; x <= width; x += 43) graphics.lineBetween(x, 0, x, height);
          for (let y = 0; y <= height; y += 43) graphics.lineBetween(0, y, width, y);

          if (mode === "system") {
            state.hostX += (state.pointerX - state.hostX) * 0.018 * dt;
            state.hostY += (state.pointerY - state.hostY) * 0.018 * dt;
            const orbX = state.hostX - 30 + Math.cos(state.time * 0.003) * 8;
            const orbY = state.hostY - 32 + Math.sin(state.time * 0.004) * 6;

            graphics.lineStyle(2, 0x8ee3c0, 0.42);
            graphics.lineBetween(orbX, orbY, state.pointerX, state.pointerY);
            graphics.strokeCircle(state.pointerX, state.pointerY, 18 + Math.sin(state.time * 0.006) * 3);
            graphics.lineStyle(2, 0xf5f0ff, 0.9);
            graphics.strokeCircle(state.hostX, state.hostY - 15, 9);
            graphics.lineBetween(state.hostX, state.hostY - 6, state.hostX, state.hostY + 22);
            graphics.lineBetween(state.hostX, state.hostY + 1, state.hostX - 16, state.hostY + 13);
            graphics.lineBetween(state.hostX, state.hostY + 1, state.hostX + 17, state.hostY + 11);
            graphics.lineBetween(state.hostX, state.hostY + 22, state.hostX - 12, state.hostY + 42);
            graphics.lineBetween(state.hostX, state.hostY + 22, state.hostX + 13, state.hostY + 42);
            graphics.lineStyle(2, 0x8ee3c0, 1);
            graphics.strokeCircle(orbX, orbY, 7);
            graphics.fillStyle(0x8ee3c0, 1);
            graphics.fillCircle(orbX, orbY, 2.5);
          }

          if (mode === "nasi") {
            state.hostX += (state.pointerX - state.hostX) * 0.08 * dt;
            state.hostY += (state.pointerY - state.hostY) * 0.08 * dt;
            graphics.lineStyle(2, 0xffb893, 0.7);
            graphics.strokeCircle(state.hostX, state.hostY, 22 + Math.sin(state.time * 0.012) * 5);
            graphics.strokeCircle(state.hostX, state.hostY, 54 + Math.sin(state.time * 0.008) * 8);
            graphics.lineStyle(2, 0xf5f0ff, 1);
            graphics.strokeCircle(state.hostX, state.hostY, 10);

            state.enemies.forEach((enemy, index) => {
              enemy.distance -= 0.24 * dt;
              if (enemy.distance < 48) enemy.distance = 190 + (index % 4) * 24;
              const angle = enemy.angle + state.time * 0.00012 * (index % 2 ? 1 : -1);
              const x = state.hostX + Math.cos(angle) * enemy.distance;
              const y = state.hostY + Math.sin(angle) * enemy.distance;
              graphics.lineStyle(1.5, 0xb69cff, 0.84);
              graphics.strokeRect(x - 7, y - 7, 14, 14);
              graphics.lineBetween(x, y, state.hostX, state.hostY);
            });
          }

          if (mode === "infinity") {
            const ground = height - 74;
            state.velocityY += 0.45 * dt;
            state.hostY += state.velocityY * dt;
            if (state.hostY >= ground) {
              state.hostY = ground;
              state.velocityY = 0;
              state.grounded = true;
            }
            graphics.lineStyle(2, 0x8ee3c0, 0.75);
            graphics.lineBetween(0, ground + 18, width, ground + 18);
            graphics.lineStyle(2, 0xb69cff, 0.9);
            graphics.strokeRect(355, ground - 36, 120, 12);
            graphics.strokeRect(555, ground - 92, 140, 12);
            graphics.lineStyle(2, 0xf5f0ff, 1);
            graphics.strokeCircle(240, state.hostY, 13);
            graphics.lineBetween(240, state.hostY + 13, 240, state.hostY + 30);
            graphics.lineStyle(1, 0xffb893, 0.75);
            graphics.lineBetween(220, state.hostY + 3, 190, state.hostY + 3);
            graphics.lineBetween(220, state.hostY + 10, 176, state.hostY + 10);
          }
        },
      };

      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: mount,
        width,
        height,
        transparent: true,
        antialias: true,
        input: { keyboard: true, mouse: true, touch: true },
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        scene,
      });
    });

    return () => {
      disposed = true;
      game?.destroy(true);
      mount.replaceChildren();
    };
  }, [mode]);

  const active = gameCopy[mode];

  return (
    <div className="game-showcase">
      <div className="game-stage-shell">
        <div className="game-stage-topline">
          <span>EAU interactive vignette</span>
          <span>{active.instruction}</span>
        </div>
        <div ref={mountRef} className="game-canvas" aria-label={`${active.title} interactive line-art vignette`} />
      </div>
      <div className="game-selector" role="tablist" aria-label="Game projects">
        {(Object.keys(gameCopy) as GameMode[]).map((key) => {
          const item = gameCopy[key];
          return (
            <button
              type="button"
              role="tab"
              aria-selected={mode === key}
              className={mode === key ? "active" : ""}
              onClick={() => setMode(key)}
              key={key}
            >
              <span>{item.index}</span>
              <small>{item.status}</small>
              <strong>{item.title}</strong>
            </button>
          );
        })}
      </div>
      <div className="game-active-copy">
        <p>{active.description}</p>
        {active.href ? <a href={active.href} target="_blank" rel="noreferrer">Open full project ↗</a> : <span>Private development</span>}
      </div>
    </div>
  );
}
