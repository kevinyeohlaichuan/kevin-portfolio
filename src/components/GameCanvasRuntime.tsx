import Phaser from "phaser";
import type PhaserTypes from "phaser";
import { useEffect, useRef } from "react";

export type GameMode = "system" | "nasi" | "infinity";
export type SystemAction = "搜" | "打" | "割";

export interface SystemDirective {
  action: SystemAction;
  version: number;
}

interface GameCanvasRuntimeProps {
  mode: GameMode;
  title: string;
  systemDirective?: SystemDirective;
  onSystemResult?: (result: string) => void;
}

type ControlKeys = {
  left: PhaserTypes.Input.Keyboard.Key;
  right: PhaserTypes.Input.Keyboard.Key;
  a: PhaserTypes.Input.Keyboard.Key;
  d: PhaserTypes.Input.Keyboard.Key;
  jump: PhaserTypes.Input.Keyboard.Key;
};

const SYSTEM_TARGETS: Record<SystemAction, { x: number; y: number; result: string }> = {
  搜: { x: 155, y: 145, result: "搜 complete · A spirit trace was found near the north ridge." },
  打: { x: 705, y: 175, result: "打 complete · The roaming threat was cleared without injury." },
  割: { x: 650, y: 335, result: "割 complete · Three spirit herbs were gathered for review." },
};

export function GameCanvasRuntime({
  mode,
  title,
  systemDirective,
  onSystemResult,
}: GameCanvasRuntimeProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const directiveRef = useRef(systemDirective);
  const resultRef = useRef(onSystemResult);

  useEffect(() => {
    directiveRef.current = systemDirective;
  }, [systemDirective]);

  useEffect(() => {
    resultRef.current = onSystemResult;
  }, [onSystemResult]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = 860;
    const height = 430;
    const groundY = height - 62;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const systemSequence: SystemAction[] = ["搜", "打", "割"];
    const survivalSpawns = [
      [36, 58], [215, 30], [430, 35], [655, 35],
      [824, 95], [825, 332], [620, 404], [310, 400], [38, 318],
    ] as const;

    let graphics: PhaserTypes.GameObjects.Graphics | null = null;
    let statusText: PhaserTypes.GameObjects.Text | null = null;
    let player: PhaserTypes.Physics.Arcade.Image | null = null;
    let enemies: PhaserTypes.Physics.Arcade.Image[] = [];
    const platformGeometry: Array<{ x: number; y: number; width: number; height: number }> = [];
    let controls: ControlKeys | null = null;
    let systemAction: SystemAction | null = null;
    let systemTarget = SYSTEM_TARGETS["搜"];

    const state = {
      pointerX: width * 0.5,
      pointerY: height * 0.5,
      pointerActive: false,
      touchTargetX: null as number | null,
      time: 0,
      resets: 0,
      invulnerableUntil: 0,
      lastDirectiveVersion: directiveRef.current?.version ?? 0,
      systemNextAt: 0,
      systemImpactUntil: 0,
      completedActions: 0,
      systemCursor: 1,
    };

    const setPlayerPosition = (x: number, y: number) => {
      if (!player) return;
      player.setPosition(x, y);
      const body = player.body as PhaserTypes.Physics.Arcade.Body;
      body.reset(x, y);
    };

    const startSystemAction = (scene: PhaserTypes.Scene, action: SystemAction, commanded: boolean) => {
      systemAction = action;
      systemTarget = SYSTEM_TARGETS[action];
      statusText?.setText(`${commanded ? "DIRECTIVE" : "HOST ROUTINE"} · ${action} IN PROGRESS`);
      mount.dataset.hostAction = action;
      if (player) scene.physics.moveTo(player, systemTarget.x, systemTarget.y, action === "打" ? 150 : 112);
    };

    const completeSystemAction = () => {
      if (!systemAction || !player) return;
      player.setVelocity(0, 0);
      state.completedActions += 1;
      state.systemImpactUntil = state.time + (reducedMotion ? 120 : 620);
      state.systemNextAt = state.time + 760;
      const result = SYSTEM_TARGETS[systemAction].result;
      statusText?.setText(result.toUpperCase());
      mount.dataset.lastResult = result;
      mount.dataset.completedActions = String(state.completedActions);
      resultRef.current?.(result);
      systemAction = null;
      mount.dataset.hostAction = "review";
    };

    const tryJump = () => {
      if (!player || mode !== "infinity") return;
      const body = player.body as PhaserTypes.Physics.Arcade.Body;
      if (body.blocked.down || body.touching.down) player.setVelocityY(-430);
    };

    const resetSurvivalEnemies = () => {
      enemies.forEach((enemy, index) => {
        const spawn = survivalSpawns[index % survivalSpawns.length];
        enemy.setPosition(spawn[0], spawn[1]);
        const body = enemy.body as PhaserTypes.Physics.Arcade.Body;
        body.reset(spawn[0], spawn[1]);
      });
    };

    const scene = {
      create(this: PhaserTypes.Scene) {
        graphics = this.add.graphics();
        statusText = this.add.text(22, height - 28, "", {
          color: "#aaa4b7",
          fontFamily: "monospace",
          fontSize: "11px",
          letterSpacing: 1.4,
        }).setDepth(4);

        if (mode === "system") {
          player = this.physics.add.image(width * 0.48, height * 0.58, "__WHITE");
          player.setVisible(false).setCollideWorldBounds(true);
          (player.body as PhaserTypes.Physics.Arcade.Body).setSize(24, 46);
          Object.entries(SYSTEM_TARGETS).forEach(([action, target]) => {
            this.add.text(target.x - 24, target.y - 38, `${action}  ${action === "搜" ? "SEEK" : action === "打" ? "ENGAGE" : "HARVEST"}`, {
              color: action === "打" ? "#ffb893" : action === "割" ? "#8ee3c0" : "#b69cff",
              fontFamily: "monospace",
              fontSize: "10px",
            }).setDepth(3);
          });
          startSystemAction(this, "搜", false);
          resultRef.current?.("Autonomous loop started · The host is seeking on its own.");
        }

        if (mode === "nasi") {
          player = this.physics.add.image(width * 0.5, height * 0.52, "__WHITE");
          player.setVisible(false).setCircle(12).setCollideWorldBounds(true);
          enemies = survivalSpawns.map(([x, y]) => {
            const enemy = this.physics.add.image(x, y, "__WHITE");
            enemy.setVisible(false).setCircle(9).setCollideWorldBounds(true);
            return enemy;
          });
          this.physics.add.overlap(player, enemies, () => {
            if (!player || this.time.now < state.invulnerableUntil) return;
            state.resets += 1;
            state.invulnerableUntil = this.time.now + 950;
            setPlayerPosition(width * 0.5, height * 0.52);
            resetSurvivalEnemies();
            statusText?.setText(`COLLISION · RUN RESET ${String(state.resets).padStart(2, "0")}`);
            mount.dataset.resets = String(state.resets);
            if (!reducedMotion) this.cameras.main.flash(160, 255, 184, 147, false);
          });
          statusText.setText("SURVIVE · CONTACT RESETS THE RUN");
        }

        if (mode === "infinity") {
          this.physics.world.setBounds(0, 0, width, groundY);
          player = this.physics.add.image(180, groundY - 16, "__WHITE");
          player.setVisible(false).setCircle(13).setCollideWorldBounds(true);

          const createPlatform = (x: number, y: number, platformWidth: number, platformHeight: number) => {
            const platform = this.physics.add.staticImage(x, y, "__WHITE");
            platform.setVisible(false);
            (platform.body as PhaserTypes.Physics.Arcade.StaticBody).setSize(platformWidth, platformHeight);
            platformGeometry.push({ x, y, width: platformWidth, height: platformHeight });
            this.physics.add.collider(player as PhaserTypes.Physics.Arcade.Image, platform);
          };
          createPlatform(410, groundY - 58, 120, 12);
          createPlatform(625, groundY - 115, 145, 12);

          controls = this.input.keyboard?.addKeys({
            left: Phaser.Input.Keyboard.KeyCodes.LEFT,
            right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
            a: Phaser.Input.Keyboard.KeyCodes.A,
            d: Phaser.Input.Keyboard.KeyCodes.D,
            jump: Phaser.Input.Keyboard.KeyCodes.SPACE,
          }) as ControlKeys;
          this.input.keyboard?.on("keydown-SPACE", tryJump);
          statusText.setText("MOVE ← → / A D · JUMP SPACE OR TAP");
        }

        this.input.on("pointermove", (pointer: PhaserTypes.Input.Pointer) => {
          state.pointerX = pointer.x;
          state.pointerY = pointer.y;
          state.pointerActive = true;
          if (mode === "infinity" && pointer.isDown) state.touchTargetX = pointer.x;
        });
        this.input.on("pointerdown", (pointer: PhaserTypes.Input.Pointer) => {
          state.pointerX = pointer.x;
          state.pointerY = pointer.y;
          state.pointerActive = true;
          if (mode === "infinity") {
            state.touchTargetX = pointer.x;
            tryJump();
          }
        });
      },

      update(this: PhaserTypes.Scene, _time: number, delta: number) {
        if (!graphics || !player) return;
        state.time += delta;
        graphics.clear();

        graphics.lineStyle(1, 0x322f41, 0.72);
        for (let x = 0; x <= width; x += 43) graphics.lineBetween(x, 0, x, height);
        for (let y = 0; y <= height; y += 43) graphics.lineBetween(0, y, width, y);

        if (mode === "system") {
          const directive = directiveRef.current;
          if (directive && directive.version > state.lastDirectiveVersion) {
            state.lastDirectiveVersion = directive.version;
            startSystemAction(this, directive.action, true);
          } else if (!systemAction && state.time >= state.systemNextAt) {
            const nextAction = systemSequence[state.systemCursor % systemSequence.length];
            state.systemCursor += 1;
            startSystemAction(this, nextAction, false);
          }

          if (systemAction) {
            const speed = systemAction === "打" ? 150 : 112;
            this.physics.moveTo(player, systemTarget.x, systemTarget.y, speed);
            if (Phaser.Math.Distance.Between(player.x, player.y, systemTarget.x, systemTarget.y) < 17) {
              completeSystemAction();
            }
          }

          Object.entries(SYSTEM_TARGETS).forEach(([action, target]) => {
            const color = action === "打" ? 0xffb893 : action === "割" ? 0x8ee3c0 : 0xb69cff;
            graphics?.lineStyle(1.5, color, systemAction === action ? 1 : 0.45);
            graphics?.strokeCircle(target.x, target.y, systemAction === action ? 20 : 13);
            graphics?.strokeCircle(target.x, target.y, 4);
          });

          if (systemAction) {
            graphics.lineStyle(1.5, 0x8ee3c0, 0.55);
            graphics.lineBetween(player.x, player.y, systemTarget.x, systemTarget.y);
          }
          if (state.time < state.systemImpactUntil) {
            const progress = 1 - (state.systemImpactUntil - state.time) / (reducedMotion ? 120 : 620);
            graphics.lineStyle(2, 0xffb893, Math.max(0, 1 - progress));
            graphics.strokeCircle(player.x, player.y, 24 + progress * 52);
          }

          const orbX = player.x - 30 + Math.cos(state.time * 0.003) * (reducedMotion ? 2 : 8);
          const orbY = player.y - 34 + Math.sin(state.time * 0.004) * (reducedMotion ? 2 : 6);
          graphics.lineStyle(2, 0xf5f0ff, 0.94);
          graphics.strokeCircle(player.x, player.y - 15, 9);
          graphics.lineBetween(player.x, player.y - 6, player.x, player.y + 22);
          graphics.lineBetween(player.x, player.y + 1, player.x - 16, player.y + 13);
          graphics.lineBetween(player.x, player.y + 1, player.x + 17, player.y + 11);
          graphics.lineBetween(player.x, player.y + 22, player.x - 12, player.y + 42);
          graphics.lineBetween(player.x, player.y + 22, player.x + 13, player.y + 42);
          graphics.lineStyle(2, 0x8ee3c0, 1);
          graphics.strokeCircle(orbX, orbY, 7);
          graphics.strokeCircle(orbX, orbY, 2.5);

          mount.dataset.hostX = player.x.toFixed(1);
          mount.dataset.hostY = player.y.toFixed(1);
        }

        if (mode === "nasi") {
          if (state.pointerActive) {
            const distance = Phaser.Math.Distance.Between(player.x, player.y, state.pointerX, state.pointerY);
            if (distance > 8) this.physics.moveTo(player, state.pointerX, state.pointerY, 270);
            else player.setVelocity(0, 0);
          }

          graphics.lineStyle(2, 0xffb893, 0.72);
          graphics.strokeCircle(player.x, player.y, 22 + Math.sin(state.time * 0.012) * (reducedMotion ? 1 : 5));
          graphics.strokeCircle(player.x, player.y, 52);
          graphics.lineStyle(2, 0xf5f0ff, 1);
          graphics.strokeCircle(player.x, player.y, 10);

          const playerX = player.x;
          const playerY = player.y;
          enemies.forEach((enemy, index) => {
            const wave = reducedMotion ? 0 : Math.sin(state.time * 0.0014 + index) * 34;
            const targetX = playerX + (index % 2 ? wave : -wave);
            const targetY = playerY + (index % 3 === 0 ? wave * 0.45 : -wave * 0.35);
            this.physics.moveTo(enemy, targetX, targetY, 62 + index * 8);
            const body = enemy.body as PhaserTypes.Physics.Arcade.Body;
            graphics?.lineStyle(1.5, 0xb69cff, 0.88);
            graphics?.strokeRect(enemy.x - 8, enemy.y - 8, 16, 16);
            graphics?.lineBetween(enemy.x, enemy.y, enemy.x - body.velocity.x * 0.08, enemy.y - body.velocity.y * 0.08);
          });

          mount.dataset.playerX = player.x.toFixed(1);
          mount.dataset.playerY = player.y.toFixed(1);
          mount.dataset.resets = String(state.resets);
          mount.dataset.enemyPositions = enemies.map((enemy) => `${enemy.x.toFixed(1)},${enemy.y.toFixed(1)}`).join("|");
        }

        if (mode === "infinity") {
          if (controls && Phaser.Input.Keyboard.JustDown(controls.jump)) tryJump();
          const keyboardDirection = controls
            ? Number(controls.right.isDown || controls.d.isDown) - Number(controls.left.isDown || controls.a.isDown)
            : 0;
          let direction = keyboardDirection;
          if (!direction && state.touchTargetX !== null) {
            const distance = state.touchTargetX - player.x;
            if (Math.abs(distance) > 10) direction = Math.sign(distance);
            else state.touchTargetX = null;
          }
          player.setVelocityX(direction * 215);

          graphics.lineStyle(2, 0x8ee3c0, 0.75);
          graphics.lineBetween(0, groundY, width, groundY);
          graphics.lineStyle(2, 0xb69cff, 0.92);
          platformGeometry.forEach((platform) => {
            graphics?.strokeRect(platform.x - platform.width / 2, platform.y - platform.height / 2, platform.width, platform.height);
          });
          graphics.lineStyle(2, 0xf5f0ff, 1);
          graphics.strokeCircle(player.x, player.y - 8, 12);
          graphics.lineBetween(player.x, player.y + 4, player.x, player.y + 22);
          graphics.lineBetween(player.x, player.y + 10, player.x - 11, player.y + 22);
          graphics.lineBetween(player.x, player.y + 10, player.x + 12, player.y + 22);
          if (direction !== 0) {
            graphics.lineStyle(1, 0xffb893, 0.75);
            graphics.lineBetween(player.x - direction * 20, player.y, player.x - direction * 52, player.y);
            graphics.lineBetween(player.x - direction * 20, player.y + 7, player.x - direction * 40, player.y + 7);
          }

          const body = player.body as PhaserTypes.Physics.Arcade.Body;
          mount.dataset.playerX = player.x.toFixed(1);
          mount.dataset.playerY = player.y.toFixed(1);
          mount.dataset.grounded = String(body.blocked.down || body.touching.down);
          mount.dataset.velocityY = body.velocity.y.toFixed(1);
        }
      },
    };

    delete mount.dataset.hostAction;
    delete mount.dataset.hostX;
    delete mount.dataset.hostY;
    delete mount.dataset.lastResult;
    delete mount.dataset.playerX;
    delete mount.dataset.playerY;
    delete mount.dataset.grounded;
    delete mount.dataset.velocityY;
    delete mount.dataset.enemyPositions;
    mount.dataset.gameMode = mode;
    mount.dataset.reducedMotion = String(reducedMotion);
    mount.dataset.resets = "0";
    mount.dataset.completedActions = "0";

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: mount,
      width,
      height,
      transparent: true,
      antialias: true,
      input: { keyboard: true, mouse: true, touch: true },
      physics: {
        default: "arcade",
        arcade: { gravity: { x: 0, y: mode === "infinity" ? 900 : 0 }, debug: false },
      },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene,
    });

    return () => {
      game.destroy(true);
      mount.replaceChildren();
    };
  }, [mode]);

  return (
    <>
      <GameCanvasFallback mode={mode} />
      <div ref={mountRef} className="game-canvas" aria-label={`${title} interactive line-art vignette`} />
    </>
  );
}

export function GameCanvasFallback({ mode = "system" }: { mode?: GameMode }) {
  return (
    <div className={`game-fallback game-fallback-${mode}`} aria-hidden="true">
      <span className="game-fallback-grid" />
      <span className="game-fallback-host" />
      <span className="game-fallback-orb" />
      <span className="game-fallback-route" />
      <span className="game-fallback-target" />
    </div>
  );
}
