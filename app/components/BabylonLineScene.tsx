"use client";

import { useEffect, useRef, useState } from "react";

type SceneMode = "gamuda" | "platform";

interface BabylonLineSceneProps {
  mode: SceneMode;
}

interface LineMaterial {
  dashOffset: number;
}

export function BabylonLineScene({ mode }: BabylonLineSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const actionRef = useRef<() => void>(() => {});
  const [status, setStatus] = useState(
    mode === "gamuda"
      ? "Drag to orbit · Select a floor"
      : "Explore the connected property map",
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let disposeScene = () => {};

    void (async () => {
      const [B, builder, materials] = await Promise.all([
        import("@babylonjs/core"),
        import("@babylonjs/core/Meshes/Builders/greasedLineBuilder.js"),
        import("@babylonjs/core/Materials/GreasedLine/greasedLineMaterialInterfaces.js"),
      ]);

      if (disposed) return;

      const engine = new B.Engine(canvas, true, {
        antialias: true,
        preserveDrawingBuffer: false,
        stencil: false,
        powerPreference: "high-performance",
      });
      const scene = new B.Scene(engine);
      scene.clearColor = new B.Color4(0, 0, 0, 0);
      scene.skipPointerMovePicking = true;

      const camera = new B.ArcRotateCamera(
        `camera-${mode}`,
        mode === "platform" ? -Math.PI / 2.35 : -Math.PI / 2.55,
        1.05,
        16,
        new B.Vector3(0, 1.7, 0),
        scene,
      );
      camera.lowerRadiusLimit = 10;
      camera.upperRadiusLimit = 23;
      camera.wheelDeltaPercentage = 0.02;
      camera.panningSensibility = 0;
      camera.attachControl(canvas, true);

      const violet = B.Color3.FromHexString("#b69cff");
      const jade = B.Color3.FromHexString("#8ee3c0");
      const peach = B.Color3.FromHexString("#ffb893");
      const ink = B.Color3.FromHexString("#f5f0ff");
      const root = new B.TransformNode(`root-${mode}`, scene);
      const lineMaterials: LineMaterial[] = [];
      const selectable: InstanceType<typeof B.Mesh>[] = [];

      const makeWireMaterial = (name: string, color: InstanceType<typeof B.Color3>, alpha = 0.62) => {
        const material = new B.StandardMaterial(name, scene);
        material.wireframe = true;
        material.disableLighting = true;
        material.emissiveColor = color;
        material.alpha = alpha;
        return material;
      };

      const violetWire = makeWireMaterial(`violet-${mode}`, violet, 0.72);
      const jadeWire = makeWireMaterial(`jade-${mode}`, jade, 0.68);
      const quietWire = makeWireMaterial(`quiet-${mode}`, ink, 0.24);

      const makeRoute = (
        name: string,
        points: InstanceType<typeof B.Vector3>[],
        color: InstanceType<typeof B.Color3>,
        dashed = true,
        width = 0.07,
      ) => {
        const line = builder.CreateGreasedLine(
          name,
          { points },
          {
            materialType: materials.GreasedLineMeshMaterialType.MATERIAL_TYPE_SIMPLE,
            color,
            width,
            useDash: dashed,
            dashCount: 24,
            dashRatio: 0.36,
            sizeAttenuation: false,
          },
          scene,
        );
        line.parent = root;
        const material = line.material as unknown as LineMaterial | null;
        if (material) lineMaterials.push(material);
        return line;
      };

      const createBuilding = (
        x: number,
        z: number,
        floors: number,
        width: number,
        depth: number,
        material: InstanceType<typeof B.StandardMaterial>,
        label: string,
      ) => {
        for (let floor = 0; floor < floors; floor += 1) {
          const mesh = B.MeshBuilder.CreateBox(
            `${label}-${floor + 1}`,
            { width, depth, height: 0.42 },
            scene,
          );
          mesh.position.set(x, floor * 0.47 + 0.28, z);
          mesh.material = material;
          mesh.parent = root;
          mesh.metadata = { label: `${label} · Level ${String(floor + 8).padStart(2, "0")}` };
          if (mode === "gamuda") selectable.push(mesh);
        }
      };

      const gridSize = mode === "platform" ? 8 : 7;
      for (let line = -gridSize; line <= gridSize; line += 1) {
        makeRoute(
          `grid-x-${line}`,
          [new B.Vector3(-gridSize, 0, line), new B.Vector3(gridSize, 0, line)],
          ink,
          false,
          0.012,
        );
        makeRoute(
          `grid-z-${line}`,
          [new B.Vector3(line, 0, -gridSize), new B.Vector3(line, 0, gridSize)],
          ink,
          false,
          0.012,
        );
      }

      if (mode === "gamuda") {
        createBuilding(-2.35, 0.1, 13, 2.7, 2.0, quietWire, "Tower A");
        createBuilding(0, -0.35, 18, 2.45, 2.05, violetWire, "Tower B");
        createBuilding(2.2, 0.25, 15, 2.55, 2.0, jadeWire, "Tower C");
        makeRoute(
          "gamuda-transit",
          [
            new B.Vector3(-7, 0.08, 4),
            new B.Vector3(-4, 0.08, 1.5),
            new B.Vector3(-1, 0.08, 3.2),
            new B.Vector3(2.2, 0.08, 1.2),
            new B.Vector3(7, 0.08, 3.5),
          ],
          jade,
          true,
          0.09,
        );
      }

      if (mode === "platform") {
        const city = [
          [-4.3, -2.2, 5, 1.4, 1.2],
          [-2.2, 1.5, 8, 1.7, 1.5],
          [0, -1.5, 12, 2.0, 1.8],
          [2.4, 1.2, 7, 1.4, 1.5],
          [4.1, -2, 10, 1.6, 1.4],
          [4.5, 3.2, 5, 1.3, 1.3],
          [-4.8, 3.3, 6, 1.5, 1.2],
        ] as const;
        city.forEach(([x, z, floors, width, depth], index) => {
          createBuilding(x, z, floors, width, depth, index % 2 ? violetWire : quietWire, `Project ${index + 1}`);
        });
        makeRoute(
          "platform-route-a",
          [
            new B.Vector3(-7, 0.1, -4),
            new B.Vector3(-4.3, 0.1, -2.2),
            new B.Vector3(-2.2, 0.1, 1.5),
            new B.Vector3(0, 0.1, -1.5),
            new B.Vector3(4.1, 0.1, -2),
            new B.Vector3(7, 0.1, 0.2),
          ],
          jade,
          true,
          0.09,
        );
        makeRoute(
          "platform-route-b",
          [
            new B.Vector3(-6, 0.12, 4.5),
            new B.Vector3(-2.2, 0.12, 1.5),
            new B.Vector3(2.4, 0.12, 1.2),
            new B.Vector3(4.5, 0.12, 3.2),
            new B.Vector3(7, 0.12, 4),
          ],
          violet,
          true,
          0.075,
        );

        const beaconMaterial = new B.StandardMaterial("beacon-material", scene);
        beaconMaterial.disableLighting = true;
        beaconMaterial.emissiveColor = peach;
        const beacons = [
          new B.Vector3(-2.2, 4.3, 1.5),
          new B.Vector3(0, 6.3, -1.5),
          new B.Vector3(4.1, 5.2, -2),
        ].map((position, index) => {
          const beacon = B.MeshBuilder.CreateSphere(`recommendation-${index}`, { diameter: 0.32 }, scene);
          beacon.position = position;
          beacon.material = beaconMaterial;
          beacon.parent = root;
          beacon.setEnabled(false);
          return beacon;
        });

        actionRef.current = () => {
          beacons.forEach((beacon) => beacon.setEnabled(true));
          setStatus("AI preview · 3 matching developments surfaced");
          window.setTimeout(() => {
            if (!disposed) setStatus("Explore the connected property map");
          }, 3800);
        };
      }

      if (mode === "gamuda") {
        let selected: InstanceType<typeof B.Mesh> | null = null;
        scene.onPointerObservable.add((pointerInfo) => {
          if (pointerInfo.type !== B.PointerEventTypes.POINTERPICK) return;
          const mesh = pointerInfo.pickInfo?.pickedMesh as InstanceType<typeof B.Mesh> | null;
          if (!mesh || !selectable.includes(mesh)) return;
          if (selected?.material) selected.material = selected.name.includes("Tower B") ? violetWire : selected.name.includes("Tower C") ? jadeWire : quietWire;
          selected = mesh;
          const highlight = makeWireMaterial(`selected-${mesh.name}`, peach, 1);
          mesh.material = highlight;
          setStatus(mesh.metadata?.label ?? "Floor selected");
        });
      }

      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let visible = true;
      const observer = new IntersectionObserver(
        ([entry]) => { visible = entry.isIntersecting; },
        { rootMargin: "160px" },
      );
      observer.observe(canvas);

      scene.onBeforeRenderObservable.add(() => {
        if (!reducedMotion) {
          lineMaterials.forEach((material) => { material.dashOffset -= 0.003; });
          if (mode === "platform") root.rotation.y += 0.00035;
        }
      });

      engine.runRenderLoop(() => {
        if (visible) scene.render();
      });

      const resize = new ResizeObserver(() => engine.resize());
      resize.observe(canvas);

      disposeScene = () => {
        observer.disconnect();
        resize.disconnect();
        scene.dispose();
        engine.dispose();
      };
    });

    return () => {
      disposed = true;
      disposeScene();
    };
  }, [mode]);

  return (
    <div className={`babylon-stage babylon-${mode}`}>
      <canvas ref={canvasRef} aria-label={`${mode} interactive line-art preview`} />
      <div className="scene-status" aria-live="polite">{status}</div>
      {mode === "platform" ? (
        <button className="scene-action" type="button" onClick={() => actionRef.current()}>
          Run AI discovery preview
        </button>
      ) : null}
    </div>
  );
}
