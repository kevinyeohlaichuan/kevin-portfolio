import Phaser from "phaser";
import type PhaserTypes from "phaser";
import { useEffect, useRef } from "react";

export type ArcadeMode = "nasi" | "infinity";

export interface ArcadeScore {
  mode: ArcadeMode;
  primary: number;
  secondary: number;
  label: string;
}

interface GameCanvasRuntimeProps {
  mode: ArcadeMode;
  title: string;
  onRunEnd?: (score: ArcadeScore) => void;
}

type ControlKeys = {
  left: PhaserTypes.Input.Keyboard.Key;
  right: PhaserTypes.Input.Keyboard.Key;
  a: PhaserTypes.Input.Keyboard.Key;
  d: PhaserTypes.Input.Keyboard.Key;
  jump: PhaserTypes.Input.Keyboard.Key;
};

interface Customer {
  body: PhaserTypes.Physics.Arcade.Image;
  satisfaction: number;
  maxSatisfaction: number;
  leaving: boolean;
  angle: number;
}

interface FoodProjectile {
  kind: "biasa" | "berapi" | "rendang";
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  damage: number;
  hits: Set<Customer>;
}

interface TowerProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  homing: boolean;
  life: number;
}

export function GameCanvasRuntime({ mode, title, onRunEnd }: GameCanvasRuntimeProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef(onRunEnd);
  useEffect(() => { resultRef.current = onRunEnd; }, [onRunEnd]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const width = 860;
    const height = 430;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let graphics: PhaserTypes.GameObjects.Graphics | null = null;
    let statusText: PhaserTypes.GameObjects.Text | null = null;
    let hudText: PhaserTypes.GameObjects.Text | null = null;
    let player: PhaserTypes.Physics.Arcade.Image | null = null;
    let controls: ControlKeys | null = null;
    let customers: Customer[] = [];
    let food: FoodProjectile[] = [];
    let towerShots: TowerProjectile[] = [];
    const platforms: Array<{ body: PhaserTypes.Physics.Arcade.Image; x: number; y: number; width: number }> = [];
    const spikes = [{ x: 515, y: 322 }, { x: 720, y: 220 }, { x: 245, y: 138 }];
    const shooters = [{ x: 760, y: 296, homing: false }, { x: 105, y: 190, homing: true }];

    const state = {
      time: 0,
      over: false,
      pointerDirection: 0,
      pointerUntil: 0,
      invulnerableUntil: 0,
      nextShotAt: { biasa: 480, berapi: Number.POSITIVE_INFINITY, rendang: Number.POSITIVE_INFINITY },
      weaponLevels: { biasa: 1, berapi: 0, rendang: 0 },
      passives: { sambal: 0, leaf: 0, rice: 1 },
      evolved: new Set<"biasa" | "berapi" | "rendang">(),
      stallHp: 100,
      served: 0,
      exp: 0,
      level: 1,
      wave: 1,
      nextEnemyShot: 1000,
      secondsLeft: 60,
      height: 0,
      hits: 0,
    };

    const spawnPoints = [[28, 48], [210, 24], [430, 24], [660, 26], [832, 82], [834, 332], [665, 410], [340, 408], [28, 330]] as const;
    const resetCustomer = (customer: Customer, index: number) => {
      const point = spawnPoints[(index + state.wave) % spawnPoints.length];
      customer.body.setPosition(point[0], point[1]);
      (customer.body.body as PhaserTypes.Physics.Arcade.Body).reset(point[0], point[1]);
      customer.maxSatisfaction = 16 + state.wave * 3 + (index % 3) * 5;
      customer.satisfaction = customer.maxSatisfaction;
      customer.leaving = false;
      customer.angle = Math.atan2(point[1] - height / 2, point[0] - width / 2);
    };

    const nearestCustomer = () => customers.filter((customer) => !customer.leaving && customer.body.x > 0 && customer.body.y > 0).sort((a, b) => Phaser.Math.Distance.Between(a.body.x, a.body.y, width / 2, height / 2) - Phaser.Math.Distance.Between(b.body.x, b.body.y, width / 2, height / 2))[0];
    const fireFood = (kind: FoodProjectile["kind"]) => {
      const target = nearestCustomer();
      if (!target) return;
      const angle = Math.atan2(target.body.y - height / 2, target.body.x - width / 2);
      const speed = (kind === "berapi" ? 160 : kind === "rendang" ? 260 : 220) + state.passives.leaf * 8;
      const damage = ((kind === "biasa" ? 7 : kind === "berapi" ? 5 : 6) + state.passives.rice + state.weaponLevels[kind] * 2) * (state.evolved.has(kind) ? 1.6 : 1);
      food.push({ kind, x: width / 2, y: height / 2 - 5, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: kind === "rendang" ? 1800 : 1250, damage, hits: new Set() });
    };

    const satisfy = (customer: Customer, amount: number) => {
      if (customer.leaving) return;
      customer.satisfaction -= amount;
      if (customer.satisfaction > 0) return;
      customer.leaving = true;
      state.served += 1;
      state.exp += 1;
      if (state.served % 10 === 0) state.wave += 1;
      const needed = 8 + state.level * 3;
      if (state.exp >= needed) {
        state.exp -= needed;
        state.level += 1;
        if (state.weaponLevels.berapi === 0) {
          state.weaponLevels.berapi = 1;
          state.passives.sambal = Math.max(1, state.passives.sambal);
          state.nextShotAt.berapi = state.time + 320;
          statusText?.setText(`LEVEL ${state.level} · NASI LEMAK BERAPI UNLOCKED`);
        } else if (state.weaponLevels.rendang === 0) {
          state.weaponLevels.rendang = 1;
          state.passives.leaf = Math.max(1, state.passives.leaf);
          state.nextShotAt.rendang = state.time + 420;
          statusText?.setText(`LEVEL ${state.level} · NASI LEMAK RENDANG UNLOCKED`);
        } else {
          const order = ["biasa", "berapi", "rendang"] as const;
          const upgraded = order[(state.level - 1) % order.length];
          state.weaponLevels[upgraded] += 1;
          const passive = upgraded === "berapi" ? "sambal" : upgraded === "rendang" ? "leaf" : "rice";
          state.passives[passive] += 1;
          if (state.weaponLevels[upgraded] >= 5 && state.passives[passive] >= 5) state.evolved.add(upgraded);
          statusText?.setText(state.evolved.has(upgraded) ? `EVOLVED · ${upgraded.toUpperCase()} + ${passive.toUpperCase()}` : `LEVEL ${state.level} · ${upgraded.toUpperCase()} UPGRADED`);
        }
      }
    };

    const hitAunty = (scene: PhaserTypes.Scene, damage: number) => {
      if (scene.time.now < state.invulnerableUntil || state.over) return;
      state.stallHp = Math.max(0, state.stallHp - damage);
      state.invulnerableUntil = scene.time.now + 360;
      if (!reducedMotion) scene.cameras.main.flash(90, 182, 156, 255, false);
      if (state.stallHp <= 0) {
        state.over = true;
        customers.forEach((customer) => customer.body.setVelocity(0, 0));
        statusText?.setText("STALL CLOSED · SCORE READY");
        resultRef.current?.({ mode: "nasi", primary: state.wave, secondary: Math.floor(state.time / 1000), label: `${state.served} customers satisfied` });
      }
    };

    const tryJump = () => {
      if (!player || mode !== "infinity" || state.over) return;
      const body = player.body as PhaserTypes.Physics.Arcade.Body;
      if (body.blocked.down || body.touching.down) player.setVelocityY(-430);
    };

    const scene = {
      create(this: PhaserTypes.Scene) {
        graphics = this.add.graphics();
        statusText = this.add.text(20, height - 24, mode === "nasi" ? "BASIC NASI LEMAK · LEVEL UP TO UNLOCK MORE" : "60 SECONDS · CLIMB · HITS KNOCK YOU BACK", { color: "#aaa4b7", fontFamily: "monospace", fontSize: "10px", letterSpacing: 1.2 }).setDepth(8);
        hudText = this.add.text(20, 20, "", { color: "#f5f0ff", fontFamily: "monospace", fontSize: "11px", letterSpacing: 1.1 }).setDepth(8);
        if (mode === "nasi") {
          player = this.physics.add.image(width / 2, height / 2, "__WHITE").setVisible(false);
          customers = spawnPoints.map(([x, y], index) => {
            const body = this.physics.add.image(x, y, "__WHITE").setVisible(false).setCircle(10);
            const customer: Customer = { body, satisfaction: 20, maxSatisfaction: 20, leaving: false, angle: 0 };
            resetCustomer(customer, index);
            return customer;
          });
          customers.slice(3).forEach((customer) => {
            customer.body.setPosition(-80, -80);
            (customer.body.body as PhaserTypes.Physics.Arcade.Body).reset(-80, -80);
          });
        } else {
          this.physics.world.setBounds(0, 0, width, height - 30);
          player = this.physics.add.image(140, height - 64, "__WHITE").setVisible(false).setCircle(12).setCollideWorldBounds(true);
          const platformData = [[110, 378, 190], [350, 326, 155], [610, 270, 180], [760, 220, 130], [505, 174, 155], [245, 124, 145], [95, 76, 120]];
          platformData.forEach(([x, y, platformWidth]) => {
            const body = this.physics.add.staticImage(x, y, "__WHITE").setVisible(false);
            (body.body as PhaserTypes.Physics.Arcade.StaticBody).setSize(platformWidth, 10);
            platforms.push({ body, x, y, width: platformWidth });
            this.physics.add.collider(player as PhaserTypes.Physics.Arcade.Image, body);
          });
          controls = this.input.keyboard?.addKeys({ left: Phaser.Input.Keyboard.KeyCodes.LEFT, right: Phaser.Input.Keyboard.KeyCodes.RIGHT, a: Phaser.Input.Keyboard.KeyCodes.A, d: Phaser.Input.Keyboard.KeyCodes.D, jump: Phaser.Input.Keyboard.KeyCodes.SPACE }) as ControlKeys;
          this.input.keyboard?.on("keydown-SPACE", tryJump);
          this.input.on("pointerdown", (pointer: PhaserTypes.Input.Pointer) => {
            if (pointer.x < width * 0.34) state.pointerDirection = -1;
            else if (pointer.x > width * 0.66) state.pointerDirection = 1;
            else tryJump();
            state.pointerUntil = this.time.now + 700;
          });
          this.input.on("pointerup", () => { state.pointerDirection = 0; });
        }
      },

      update(this: PhaserTypes.Scene, _time: number, delta: number) {
        if (!graphics || !player) return;
        const activePlayer = player;
        state.time += delta;
        graphics.clear();
        graphics.lineStyle(1, 0x322f41, 0.72);
        for (let x = 0; x <= width; x += 43) graphics.lineBetween(x, 0, x, height);
        for (let y = 0; y <= height; y += 43) graphics.lineBetween(0, y, width, y);

        if (mode === "nasi") {
          if (!state.over) {
            (["biasa", "berapi", "rendang"] as const).forEach((kind) => {
              if (state.weaponLevels[kind] < 1 || state.time < state.nextShotAt[kind]) return;
              fireFood(kind);
              const cooldown = kind === "biasa"
                ? Math.max(340, 960 - state.weaponLevels.biasa * 40)
                : kind === "berapi"
                  ? Math.max(860, 2700 - state.weaponLevels.berapi * 80)
                  : Math.max(680, 2200 - state.weaponLevels.rendang * 64);
              state.nextShotAt[kind] = state.time + cooldown;
            });
          }
          const liveCount = Math.min(customers.length, 2 + state.wave);
          customers.forEach((customer, index) => {
            if (index >= liveCount) {
              customer.body.setVelocity(0, 0);
              customer.body.setPosition(-80, -80);
              (customer.body.body as PhaserTypes.Physics.Arcade.Body).reset(-80, -80);
              customer.leaving = false;
              return;
            }
            if (customer.body.x < 0) resetCustomer(customer, index);
            if (customer.leaving) {
              customer.body.setVelocity(Math.cos(customer.angle) * 170, Math.sin(customer.angle) * 170);
              if (customer.body.x < 5 || customer.body.x > width - 5 || customer.body.y < 5 || customer.body.y > height - 5) resetCustomer(customer, index);
            } else if (!state.over) {
              this.physics.moveTo(customer.body, width / 2, height / 2, 18 + state.wave * 2.5);
              if (Phaser.Math.Distance.Between(customer.body.x, customer.body.y, width / 2, height / 2) < 55) {
                hitAunty(this, 3 + Math.floor(state.wave / 3));
                resetCustomer(customer, index);
              }
            }
            graphics?.lineStyle(1.5, customer.leaving ? 0x8ee3c0 : 0xb69cff, 0.9);
            graphics?.strokeCircle(customer.body.x, customer.body.y, 11);
            graphics?.lineBetween(customer.body.x - 12, customer.body.y - 17, customer.body.x + 12, customer.body.y - 17);
            graphics?.lineStyle(2, 0x8ee3c0, 0.9);
            graphics?.lineBetween(customer.body.x - 12, customer.body.y - 17, customer.body.x - 12 + 24 * Math.max(0, customer.satisfaction / customer.maxSatisfaction), customer.body.y - 17);
          });
          food = food.filter((shot) => {
            shot.x += shot.vx * delta / 1000;
            shot.y += shot.vy * delta / 1000;
            shot.life -= delta;
            customers.forEach((customer) => {
              if (customer.leaving || customer.body.x < 0 || shot.hits.has(customer) || Phaser.Math.Distance.Between(shot.x, shot.y, customer.body.x, customer.body.y) >= 15) return;
              shot.hits.add(customer);
              satisfy(customer, shot.damage);
              if (shot.kind === "berapi") customers.forEach((nearby) => { if (!nearby.leaving && nearby.body.x > 0 && Phaser.Math.Distance.Between(customer.body.x, customer.body.y, nearby.body.x, nearby.body.y) < 62 + state.passives.sambal * 3) satisfy(nearby, shot.damage * 0.72); });
              if (shot.kind === "biasa") shot.life = 0;
              if (shot.kind === "rendang" && shot.hits.size >= 3 + Math.floor(state.weaponLevels.rendang / 4)) shot.life = 0;
            });
            const color = shot.kind === "biasa" ? 0xf5f0ff : shot.kind === "berapi" ? 0xffb893 : 0x8ee3c0;
            graphics?.lineStyle(2, color, 0.95);
            if (shot.kind === "berapi") graphics?.strokeCircle(shot.x, shot.y, 8 + state.passives.sambal);
            else if (shot.kind === "rendang") graphics?.lineBetween(shot.x - shot.vx * 0.06, shot.y - shot.vy * 0.06, shot.x, shot.y);
            else graphics?.strokeCircle(shot.x, shot.y, 4);
            return shot.life > 0 && shot.x > -30 && shot.x < width + 30 && shot.y > -30 && shot.y < height + 30;
          });
          graphics.lineStyle(2, 0xf5f0ff, 1);
          graphics.strokeCircle(width / 2, height / 2 - 20, 9);
          graphics.lineBetween(width / 2, height / 2 - 11, width / 2, height / 2 + 15);
          graphics.lineStyle(2, 0xffb893, 0.85);
          graphics.strokeRect(width / 2 - 42, height / 2 + 12, 84, 28);
          graphics.lineBetween(width / 2 - 46, height / 2 + 10, width / 2 + 46, height / 2 + 10);
          graphics.lineStyle(2, 0x8ee3c0, 0.9);
          graphics.lineBetween(18, 18, 18 + 190 * state.stallHp / 100, 18);
          graphics.lineStyle(1, 0x777181, 0.7);
          graphics.strokeRect(18, 14, 190, 8);
          mount.dataset.wave = String(state.wave);
          mount.dataset.survivalSeconds = String(Math.floor(state.time / 1000));
          mount.dataset.level = String(state.level);
          mount.dataset.stallHp = String(state.stallHp);
          hudText?.setText(`WAVE ${state.wave}   LV.${state.level}   STALL ${state.stallHp}%   ${Math.floor(state.time / 1000)}s`);
        } else {
          if (!state.over) {
            state.secondsLeft = Math.max(0, 60 - Math.floor(state.time / 1000));
            if (state.secondsLeft <= 0) {
              state.over = true;
              player.setVelocity(0, 0);
              statusText?.setText("TIME · HEIGHT RECORDED");
              resultRef.current?.({ mode: "infinity", primary: state.height, secondary: state.hits, label: `${state.height} m climbed` });
            }
          }
          const keyboardDirection = controls ? Number(controls.right.isDown || controls.d.isDown) - Number(controls.left.isDown || controls.a.isDown) : 0;
          const direction = keyboardDirection || (this.time.now < state.pointerUntil ? state.pointerDirection : 0);
          if (!state.over) player.setVelocityX(direction * 220);
          if (player.y < 46) {
            player.setPosition(player.x, 220);
            (player.body as PhaserTypes.Physics.Arcade.Body).reset(player.x, 220);
            state.height += 35;
            platforms.forEach((platform, index) => {
              platform.x = 90 + ((index * 193 + state.height * 7) % 680);
              platform.body.setPosition(platform.x, platform.y);
              platform.body.refreshBody();
            });
          }
          spikes.forEach((spike) => {
            graphics?.lineStyle(1.5, 0xffb893, 0.9);
            graphics?.lineBetween(spike.x - 10, spike.y, spike.x, spike.y - 16);
            graphics?.lineBetween(spike.x, spike.y - 16, spike.x + 10, spike.y);
            if (!state.over && this.time.now >= state.invulnerableUntil && Phaser.Math.Distance.Between(activePlayer.x, activePlayer.y, spike.x, spike.y - 8) < 22) {
              activePlayer.setVelocity(activePlayer.x < spike.x ? -300 : 300, -260);
              state.hits += 1;
              state.invulnerableUntil = this.time.now + 650;
            }
          });
          shooters.forEach((shooter) => {
            graphics?.lineStyle(1.5, shooter.homing ? 0xb69cff : 0x8ee3c0, 0.95);
            graphics?.strokeRect(shooter.x - 10, shooter.y - 10, 20, 20);
          });
          if (!state.over && state.time >= state.nextEnemyShot) {
            const shooter = shooters[Math.floor(state.time / 1800) % shooters.length];
            const angle = Math.atan2(player.y - shooter.y, player.x - shooter.x);
            towerShots.push({ x: shooter.x, y: shooter.y, vx: Math.cos(angle) * (shooter.homing ? 80 : 185), vy: Math.sin(angle) * (shooter.homing ? 80 : 185), homing: shooter.homing, life: 5200 });
            state.nextEnemyShot = state.time + 1250;
          }
          towerShots = towerShots.filter((shot) => {
            if (shot.homing && !state.over) {
              const angle = Math.atan2(activePlayer.y - shot.y, activePlayer.x - shot.x);
              shot.vx = Phaser.Math.Linear(shot.vx, Math.cos(angle) * 92, 0.025);
              shot.vy = Phaser.Math.Linear(shot.vy, Math.sin(angle) * 92, 0.025);
            }
            shot.x += shot.vx * delta / 1000;
            shot.y += shot.vy * delta / 1000;
            shot.life -= delta;
            if (!state.over && this.time.now >= state.invulnerableUntil && Phaser.Math.Distance.Between(activePlayer.x, activePlayer.y, shot.x, shot.y) < 19) {
              const directionAway = shot.vx > 0 ? 1 : -1;
              activePlayer.setVelocity(directionAway * 320, -250);
              state.hits += 1;
              state.invulnerableUntil = this.time.now + 650;
              shot.life = 0;
              if (!reducedMotion) this.cameras.main.shake(80, 0.006);
            }
            graphics?.lineStyle(1.8, shot.homing ? 0xb69cff : 0x8ee3c0, 0.95);
            graphics?.strokeCircle(shot.x, shot.y, shot.homing ? 7 : 4);
            return shot.life > 0 && shot.x > -25 && shot.x < width + 25 && shot.y > -25 && shot.y < height + 25;
          });
          graphics.lineStyle(2, 0xb69cff, 0.9);
          platforms.forEach((platform) => graphics?.strokeRect(platform.x - platform.width / 2, platform.y - 5, platform.width, 10));
          graphics.lineStyle(2, this.time.now < state.invulnerableUntil ? 0xffb893 : 0xf5f0ff, 1);
          graphics.strokeCircle(player.x, player.y - 7, 11);
          graphics.lineBetween(player.x, player.y + 4, player.x, player.y + 21);
          graphics.lineBetween(player.x, player.y + 9, player.x - 10, player.y + 21);
          graphics.lineBetween(player.x, player.y + 9, player.x + 11, player.y + 21);
          mount.dataset.secondsLeft = String(state.secondsLeft);
          mount.dataset.height = String(state.height);
          mount.dataset.hits = String(state.hits);
          hudText?.setText(`${String(state.secondsLeft).padStart(2, "0")}s   HEIGHT ${state.height}m   HITS ${state.hits}`);
        }
      },
    };

    mount.dataset.gameMode = mode;
    const game = new Phaser.Game({
      type: Phaser.AUTO, parent: mount, width, height, transparent: true, antialias: true,
      input: { keyboard: true, mouse: true, touch: true },
      physics: { default: "arcade", arcade: { gravity: { x: 0, y: mode === "infinity" ? 900 : 0 }, debug: false } },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, scene,
    });
    return () => { game.destroy(true); mount.replaceChildren(); };
  }, [mode]);

  return <><GameCanvasFallback mode={mode} /><div ref={mountRef} className="game-canvas" aria-label={`${title} interactive line-art game demo`} /></>;
}

export function GameCanvasFallback({ mode }: { mode: ArcadeMode }) {
  return <div className={`game-fallback game-fallback-${mode}`} aria-hidden="true"><span className="game-fallback-grid" /><span className="game-fallback-host" /><span className="game-fallback-orb" /><span className="game-fallback-route" /><span className="game-fallback-target" /></div>;
}
