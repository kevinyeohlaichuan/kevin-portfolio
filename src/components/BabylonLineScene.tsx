// Deep imports keep the Babylon preview small enough for mobile visitors.
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera.js";
import "@babylonjs/core/Culling/ray.js";
import { Engine } from "@babylonjs/core/Engines/engine.js";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents.js";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight.js";
import { GreasedLineMeshMaterialType } from "@babylonjs/core/Materials/GreasedLine/greasedLineMaterialInterfaces.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder.js";
import { CreateGreasedLine } from "@babylonjs/core/Meshes/Builders/greasedLineBuilder.js";
import type { Mesh } from "@babylonjs/core/Meshes/mesh.js";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
// Side-effect import: augments AbstractMesh with renderOutline, which is what
// makes a picked unit unmistakable inside a field of identical wireframes.
import "@babylonjs/core/Rendering/outlineRenderer.js";
import { Scene } from "@babylonjs/core/scene.js";
import { useEffect, useRef, useState } from "react";

type SceneMode = "gamuda" | "platform";
type TowerFilter = "Tower 1" | "Tower 2" | "Tower 3";
type UnitType = (typeof UNIT_LAYOUTS)[number]["type"];

interface BabylonLineSceneProps { mode: SceneMode; }
interface LineMaterial { dashOffset: number; }
interface UnitPick {
  id: string;
  tower: string;
  floor: number;
  stack: string;
  type: UnitType;
  rooms: string;
  size: string;
}
interface ProjectPick {
  id: string;
  name: string;
  note: string;
}
interface SceneControls {
  // activeTower isolates one tower in the viewport; null shows the whole masterplan.
  setFilters: (activeTower: TowerFilter | null, unitType: UnitType | null, selectedId: string) => void;
  setMaxFloor: (floor: number) => void;
  showMatches: (projects: string[]) => void;
  resetCamera: () => void;
}

const TOWERS = [
  { id: "Tower 1", floors: 13, start: 8, note: "Quieter edge · morning light" },
  { id: "Tower 2", floors: 18, start: 8, note: "Central facilities · city view" },
  { id: "Tower 3", floors: 15, start: 8, note: "Transit side · evening light" },
] as const;

const UNIT_LAYOUTS = [
  { stack: "01", type: "Type A", rooms: "2 bed · 2 bath", size: "750 sq ft" },
  { stack: "02", type: "Type B", rooms: "3 bed · 2 bath", size: "958 sq ft" },
  { stack: "03", type: "Type C", rooms: "3+1 bed · 2 bath", size: "1,152 sq ft" },
] as const;

const TYPE_COLORS: Record<UnitType, string> = {
  "Type A": "#b69cff",
  "Type B": "#8ee3c0",
  "Type C": "#ffb893",
};

const PLATFORM_PROJECTS = [
  { id: "Project 1", name: "Lavender Court", note: "Calm neighbourhood · clinics nearby" },
  { id: "Project 2", name: "Metro Grove", note: "Rail connection · compact layouts" },
  { id: "Project 3", name: "Central Vale", note: "City access · strong rental demand" },
  { id: "Project 4", name: "Park Residences", note: "Groceries · schools · green space" },
  { id: "Project 5", name: "Northline Suites", note: "Growth corridor · entry-level units" },
  { id: "Project 6", name: "Garden Link", note: "Healthcare · daily amenities" },
  { id: "Project 7", name: "Civic Heights", note: "Employment hubs · public transport" },
] as const;

const CHAT_PATHS = {
  retirement: {
    label: "Retirement living", followup: "What matters most for daily comfort?",
    choices: [
      { label: "Healthcare access", answer: "Quiet homes with clinics and daily needs nearby.", matches: ["Project 1", "Project 6"] },
      { label: "Peaceful surroundings", answer: "Lower-traffic homes close to green space.", matches: ["Project 1", "Project 4"] },
      { label: "Easy daily errands", answer: "Walkable groceries, food and essential services.", matches: ["Project 4", "Project 6"] },
    ],
  },
  working: {
    label: "Working adults", followup: "Which commute pattern fits you?",
    choices: [
      { label: "Near rail transit", answer: "Rail-connected homes with practical layouts.", matches: ["Project 2", "Project 7"] },
      { label: "Near city offices", answer: "Shorter access to central employment areas.", matches: ["Project 3", "Project 7"] },
      { label: "Hybrid work", answer: "More room for a desk without losing connectivity.", matches: ["Project 2", "Project 4"] },
    ],
  },
  amenities: {
    label: "Nearby amenities", followup: "Which amenity should lead the search?",
    choices: [
      { label: "Food & groceries", answer: "Everyday shopping and dining within easy reach.", matches: ["Project 4", "Project 6"] },
      { label: "Schools & parks", answer: "Family areas with education and green space nearby.", matches: ["Project 4", "Project 7"] },
      { label: "Medical care", answer: "Developments with clinics and hospitals close by.", matches: ["Project 1", "Project 6"] },
    ],
  },
  roi: {
    label: "ROI potential", followup: "What kind of investment are you considering?",
    choices: [
      { label: "Rental demand", answer: "Homes near jobs and transit with steady tenant demand.", matches: ["Project 2", "Project 3"] },
      { label: "Growth area", answer: "Projects positioned along developing corridors.", matches: ["Project 5", "Project 7"] },
      { label: "Lower entry price", answer: "Compact units with a more accessible starting point.", matches: ["Project 2", "Project 5"] },
    ],
  },
} as const;

type ChatTopic = keyof typeof CHAT_PATHS;
type ChatResult = { answer: string; matches: readonly string[] };

export function BabylonLineScene({ mode }: BabylonLineSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<SceneControls>({
    setFilters: () => {}, setMaxFloor: () => {}, showMatches: () => {}, resetCamera: () => {},
  });
  const [status, setStatus] = useState(mode === "gamuda" ? "Drag to orbit · tap a unit" : "Drag to explore · tap a development");
  const [panelOpen, setPanelOpen] = useState(true);
  const [activeTower, setActiveTower] = useState<TowerFilter | null>(null);
  const [selectedUnitType, setSelectedUnitType] = useState<UnitType | null>(null);
  const [maxFloor, setMaxFloor] = useState(25);
  const [selectedUnit, setSelectedUnit] = useState<UnitPick | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectPick | null>(null);
  const [chatTopic, setChatTopic] = useState<ChatTopic | null>(null);
  const [chatResult, setChatResult] = useState<ChatResult | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const viewport = viewportRef.current;
    if (!canvas || !viewport) return;
    let engine: Engine;
    try {
      engine = new Engine(canvas, true, { antialias: true, adaptToDeviceRatio: true, preserveDrawingBuffer: false, stencil: false, powerPreference: "high-performance" });
    } catch {
      setStatus("WebGL unavailable · static preview active");
      return;
    }
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0, 0, 0, 0);
    scene.skipPointerMovePicking = true;
    const light = new HemisphericLight(`fill-${mode}`, new Vector3(0.2, 1, 0.35), scene);
    light.intensity = 0.85;
    const startAlpha = mode === "platform" ? -Math.PI / 2.35 : -Math.PI / 2.55;
    const startBeta = 1.05;
    const startRadius = 16;
    const startTarget = new Vector3(0, 1.7, 0);
    const camera = new ArcRotateCamera(`camera-${mode}`, startAlpha, startBeta, startRadius, startTarget.clone(), scene);
    camera.lowerRadiusLimit = 10;
    camera.upperRadiusLimit = 23;
    camera.wheelDeltaPercentage = 0.02;
    camera.panningSensibility = 0;
    camera.attachControl(canvas, false);

    const violet = Color3.FromHexString("#b69cff");
    const jade = Color3.FromHexString("#8ee3c0");
    const peach = Color3.FromHexString("#ffb893");
    const ink = Color3.FromHexString("#f5f0ff");
    const root = new TransformNode(`root-${mode}`, scene);
    const lineMaterials: LineMaterial[] = [];
    const unitMeshes: Mesh[] = [];
    const projectMeshes = new Map<string, Mesh[]>();
    const view = {
      activeTower: null as TowerFilter | null,
      unitType: null as UnitType | null,
      maxFloor: 25,
      selectedId: "",
      hoveredId: "",
      matches: [] as string[],
    };
    const makeWireMaterial = (name: string, color: Color3, alpha = 0.72) => {
      const material = new StandardMaterial(name, scene);
      material.wireframe = true;
      material.disableLighting = true;
      material.emissiveColor = color;
      material.diffuseColor = color;
      material.specularColor = Color3.Black();
      material.alpha = alpha;
      material.backFaceCulling = false;
      material.forceDepthWrite = true;
      return material;
    };
    const colorless = makeWireMaterial(`colorless-${mode}`, ink, 0.72);
    // Once anything is selected or filtered, everything else has to drop far
    // enough back to read as context. At 0.72 a single bright unit among forty
    // identical ones is invisible, which is what made picking look broken.
    const recessive = makeWireMaterial(`recessive-${mode}`, ink, 0.11);
    const hoverWire = makeWireMaterial(`hover-${mode}`, ink, 1);
    const typeBright: Record<UnitType, StandardMaterial> = {
      "Type A": makeWireMaterial(`type-a-hot-${mode}`, violet, 1),
      "Type B": makeWireMaterial(`type-b-hot-${mode}`, jade, 1),
      "Type C": makeWireMaterial(`type-c-hot-${mode}`, peach, 1),
    };
    const typeColors: Record<UnitType, Color3> = { "Type A": violet, "Type B": jade, "Type C": peach };
    const matchWire = makeWireMaterial(`match-${mode}`, jade, 0.9);
    const pickWire = makeWireMaterial(`pick-${mode}`, violet, 1);
    const makeRoute = (name: string, points: Vector3[], color: Color3, dashed = true, width = 0.07) => {
      try {
        const line = CreateGreasedLine(name, { points }, {
          materialType: GreasedLineMeshMaterialType.MATERIAL_TYPE_SIMPLE,
          color, width, useDash: dashed, dashCount: 24, dashRatio: 0.36, sizeAttenuation: false,
        }, scene);
        line.parent = root;
        line.isPickable = false;
        const material = line.material as unknown as LineMaterial | null;
        if (material) lineMaterials.push(material);
        return line;
      } catch {
        return null;
      }
    };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Selecting a unit is exclusive: it clears any unit-type highlight and is the
    // only thing lit. Hover is the weaker signal that says "this is clickable".
    const paintGamuda = () => {
      unitMeshes.forEach((mesh) => {
        const meta = mesh.metadata as UnitPick;
        const towerHidden = view.activeTower !== null && view.activeTower !== meta.tower;
        const floorHidden = meta.floor > view.maxFloor;
        mesh.isVisible = !towerHidden && !floorHidden;
        mesh.renderOutline = false;
        if (!mesh.isVisible) return;
        if (view.selectedId) {
          const isSelected = view.selectedId === meta.id;
          mesh.material = isSelected ? typeBright[meta.type] : recessive;
          if (isSelected) {
            mesh.renderOutline = true;
            mesh.outlineColor = typeColors[meta.type];
            mesh.outlineWidth = 0.045;
          }
          return;
        }
        if (view.unitType) {
          mesh.material = view.unitType === meta.type ? typeBright[meta.type] : recessive;
          return;
        }
        mesh.material = view.hoveredId === meta.id ? hoverWire : colorless;
      });
    };
    const paintPlatform = () => {
      projectMeshes.forEach((meshes, label) => {
        const selected = view.selectedId === label;
        const matched = view.matches.includes(label);
        const hovered = view.hoveredId === label;
        meshes.forEach((mesh) => {
          mesh.renderOutline = false;
          if (selected) {
            mesh.material = pickWire;
            mesh.renderOutline = true;
            mesh.outlineColor = violet;
            mesh.outlineWidth = 0.045;
            return;
          }
          if (view.selectedId) { mesh.material = matched ? matchWire : recessive; return; }
          if (matched) { mesh.material = matchWire; return; }
          if (view.matches.length) { mesh.material = recessive; return; }
          mesh.material = hovered ? hoverWire : colorless;
        });
      });
    };
    const paint = () => { if (mode === "gamuda") paintGamuda(); else paintPlatform(); };

    if (mode === "gamuda") {
      // Real towers stack a layout over a run of floors rather than alternating
      // per floor, so each tower carries its own bottom-up band order.
      const footprints = [
        { id: "Tower 1", x: -2.35, z: 0.1, floors: 13, width: 2.7, depth: 2.0, stacking: ["Type A", "Type B", "Type C"] },
        { id: "Tower 2", x: 0, z: -0.35, floors: 18, width: 2.45, depth: 2.05, stacking: ["Type B", "Type A", "Type C"] },
        { id: "Tower 3", x: 2.2, z: 0.25, floors: 15, width: 2.55, depth: 2.0, stacking: ["Type A", "Type C", "Type B"] },
      ] as const;
      footprints.forEach((tower) => {
        const bandSize = Math.ceil(tower.floors / tower.stacking.length);
        for (let floorIndex = 0; floorIndex < tower.floors; floorIndex += 1) {
          const bandType = tower.stacking[Math.min(Math.floor(floorIndex / bandSize), tower.stacking.length - 1)];
          const layout = UNIT_LAYOUTS.find((item) => item.type === bandType) ?? UNIT_LAYOUTS[0];
          const mesh = CreateBox(`${tower.id}-${floorIndex + 1}`, {
            width: tower.width, depth: tower.depth, height: 0.42,
          }, scene);
          mesh.position.set(tower.x, floorIndex * 0.47 + 0.28, tower.z);
          mesh.material = colorless;
          mesh.parent = root;
          mesh.metadata = {
            id: `${tower.id}-${floorIndex + 8}-${layout.stack}`,
            tower: tower.id,
            floor: floorIndex + 8,
            stack: layout.stack,
            type: layout.type,
            rooms: layout.rooms,
            size: layout.size,
          } satisfies UnitPick;
          unitMeshes.push(mesh);
        }
      });
      makeRoute("gamuda-transit", [new Vector3(-7, 0.08, 4), new Vector3(-4, 0.08, 1.5), new Vector3(-1, 0.08, 3.2), new Vector3(2.2, 0.08, 1.2), new Vector3(7, 0.08, 3.5)], jade, true, 0.09);
      // Bottom-up type sequence per tower, so the banding is inspectable.
      viewport.dataset.unitBands = footprints
        .map((tower) => `${tower.id}=${unitMeshes.filter((mesh) => (mesh.metadata as UnitPick).tower === tower.id).map((mesh) => (mesh.metadata as UnitPick).type.replace("Type ", "")).join("")}`)
        .join(",");
    } else {
      const city = [
        [-4.3, -2.2, 5, 1.4, 1.2], [-2.2, 1.5, 8, 1.7, 1.5], [0, -1.5, 12, 2.0, 1.8],
        [2.4, 1.2, 7, 1.4, 1.5], [4.1, -2, 10, 1.6, 1.4], [4.5, 3.2, 5, 1.3, 1.3], [-4.8, 3.3, 6, 1.5, 1.2],
      ] as const;
      city.forEach(([x, z, floors, width, depth], index) => {
        const label = `Project ${index + 1}`;
        const meshes: Mesh[] = [];
        for (let floorIndex = 0; floorIndex < floors; floorIndex += 1) {
          const mesh = CreateBox(`${label}-${floorIndex + 1}`, { width, depth, height: 0.42 }, scene);
          mesh.position.set(x, floorIndex * 0.47 + 0.28, z);
          mesh.material = colorless;
          mesh.parent = root;
          mesh.metadata = { id: label };
          meshes.push(mesh);
        }
        projectMeshes.set(label, meshes);
      });
      makeRoute("platform-route-a", [new Vector3(-7, 0.1, -4), new Vector3(-4.3, 0.1, -2.2), new Vector3(-2.2, 0.1, 1.5), new Vector3(0, 0.1, -1.5), new Vector3(4.1, 0.1, -2), new Vector3(7, 0.1, 0.2)], ink, true, 0.065);
      makeRoute("platform-route-b", [new Vector3(-6, 0.12, 4.5), new Vector3(-2.2, 0.12, 1.5), new Vector3(2.4, 0.12, 1.2), new Vector3(4.5, 0.12, 3.2), new Vector3(7, 0.12, 4)], ink, true, 0.055);
    }

    const gridSize = mode === "platform" ? 8 : 7;
    for (let line = -gridSize; line <= gridSize; line += 1) {
      makeRoute(`grid-x-${line}`, [new Vector3(-gridSize, 0, line), new Vector3(gridSize, 0, line)], ink, false, 0.012);
      makeRoute(`grid-z-${line}`, [new Vector3(line, 0, -gridSize), new Vector3(line, 0, gridSize)], ink, false, 0.012);
    }

    controlsRef.current = {
      setFilters: (nextActiveTower, unitType, selectedId) => {
        view.activeTower = nextActiveTower;
        view.unitType = unitType;
        view.selectedId = selectedId;
        paint();
      },
      setMaxFloor: (floor) => {
        view.maxFloor = floor;
        paint();
      },
      showMatches: (projects) => {
        view.matches = projects;
        paint();
        setStatus(projects.length ? `${projects.length} matching developments highlighted` : "Drag to explore · tap a development");
      },
      resetCamera: () => {
        view.selectedId = "";
        paint();
        camera.alpha = startAlpha;
        camera.beta = startBeta;
        camera.radius = startRadius;
        camera.target.copyFrom(startTarget);
      },
    };

    let pointerStart = { x: 0, y: 0 };
    const pickAt = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      if (bounds.width < 2 || bounds.height < 2) return null;
      // scene.pick expects CSS pixels relative to the canvas. Babylon multiplies by
      // 1 / hardwareScalingLevel internally (ray.core.js CreatePickingRayToRef), so
      // converting to backing-store pixels here squares the device pixel ratio and
      // breaks picking on every HiDPI screen.
      return scene.pick(
        event.clientX - bounds.left,
        event.clientY - bounds.top,
        (candidate) => mode === "gamuda"
          ? candidate.isVisible && unitMeshes.includes(candidate as Mesh)
          : projectMeshes.get(String(candidate.metadata?.id ?? ""))?.includes(candidate as Mesh) === true,
      );
    };
    const pickFromEvent = (event: PointerEvent) => {
      const pick = pickAt(event);
      if (!pick) return;
      const mesh = pick.pickedMesh as Mesh | null;
      if (!pick.hit || !mesh?.metadata) return;
      if (mode === "gamuda") {
        if (!unitMeshes.includes(mesh)) return;
        const unit = mesh.metadata as UnitPick;
        view.selectedId = unit.id;
        view.unitType = null;
        paint();
        setSelectedUnit(unit);
        setSelectedUnitType(null);
        setPanelOpen(true);
        setStatus(`${unit.tower} · ${unit.type} · ${unit.id.replace("Tower ", "")}`);
        return;
      }
      const projectId = String(mesh.metadata.id ?? "");
      const project = PLATFORM_PROJECTS.find((item) => item.id === projectId);
      if (!project) return;
      view.selectedId = project.id;
      paint();
      setSelectedProject(project);
      setPanelOpen(true);
      setStatus(`${project.name} · tap another development or ask for a match`);
    };
    const handlePointerDown = (event: PointerEvent) => {
      pointerStart = { x: event.clientX, y: event.clientY };
    };
    // A tap drifts further than a mouse click, so allow more slack on touch.
    const handlePointerUp = (event: PointerEvent) => {
      const slack = event.pointerType === "touch" ? 14 : 6;
      if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > slack) return;
      pickFromEvent(event);
    };
    // Hover is throttled and only repaints when the target actually changes;
    // without it nothing in the viewport looks clickable.
    let lastHoverAt = 0;
    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const now = performance.now();
      if (now - lastHoverAt < 60) return;
      lastHoverAt = now;
      const pick = pickAt(event);
      const mesh = pick?.pickedMesh as Mesh | null;
      const meta = mesh?.metadata as { id?: string } | undefined;
      const nextHovered = pick?.hit && meta?.id ? String(meta.id) : "";
      canvas.style.cursor = nextHovered ? "pointer" : "";
      if (nextHovered === view.hoveredId) return;
      view.hoveredId = nextHovered;
      paint();
    };
    const handlePointerLeave = () => {
      canvas.style.cursor = "";
      if (!view.hoveredId) return;
      view.hoveredId = "";
      paint();
    };
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerleave", handlePointerLeave);
    scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type !== PointerEventTypes.POINTERPICK) return;
      const event = pointerInfo.event as PointerEvent | undefined;
      if (event) pickFromEvent(event);
    });

    let visible = true;
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { rootMargin: "240px" });
    observer.observe(viewport);
    scene.onBeforeRenderObservable.add(() => { if (!reducedMotion) lineMaterials.forEach((material) => { material.dashOffset -= 0.003; }); });
    const fitEngine = () => {
      if (viewport.clientWidth < 2 || viewport.clientHeight < 2) return;
      engine.resize();
    };
    fitEngine();
    const raf = window.requestAnimationFrame(() => {
      fitEngine();
      window.requestAnimationFrame(fitEngine);
    });
    engine.runRenderLoop(() => { if (!document.hidden && visible) scene.render(); });
    const onWinResize = () => fitEngine();
    window.addEventListener("resize", onWinResize);
    const resize = new ResizeObserver(fitEngine);
    resize.observe(viewport);
    return () => {
      controlsRef.current = { setFilters: () => {}, setMaxFloor: () => {}, showMatches: () => {}, resetCamera: () => {} };
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("resize", onWinResize);
      window.cancelAnimationFrame(raf);
      observer.disconnect();
      resize.disconnect();
      scene.dispose();
      engine.dispose();
    };
  }, [mode]);

  const floorMin = 8;
  const floorMax = 25;
  // Selecting a tower isolates it in the viewport; selecting it again restores the masterplan.
  const chooseTower = (tower: TowerFilter) => {
    const nextActiveTower = activeTower === tower ? null : tower;
    const hidesSelection = nextActiveTower !== null && selectedUnit !== null && selectedUnit.tower !== nextActiveTower;
    setActiveTower(nextActiveTower);
    if (hidesSelection) setSelectedUnit(null);
    controlsRef.current.setFilters(nextActiveTower, selectedUnitType, hidesSelection ? "" : selectedUnit?.id ?? "");
    setStatus(nextActiveTower ? `${nextActiveTower} isolated · tap it again for all towers` : "All towers visible · tap a unit");
  };
  const chooseUnitType = (unitType: UnitType) => {
    const nextType = selectedUnitType === unitType ? null : unitType;
    setSelectedUnitType(nextType);
    setSelectedUnit(null);
    controlsRef.current.setFilters(activeTower, nextType, "");
  };
  const chooseMaxFloor = (floor: number) => {
    setMaxFloor(floor);
    controlsRef.current.setMaxFloor(floor);
  };
  const chooseChatResult = (result: ChatResult) => {
    setChatResult(result);
    controlsRef.current.showMatches([...result.matches]);
  };
  const resetChat = () => {
    setChatTopic(null);
    setChatResult(null);
    setSelectedProject(null);
    controlsRef.current.showMatches([]);
    controlsRef.current.resetCamera();
  };
  const resetView = () => {
    setSelectedUnit(null);
    setSelectedProject(null);
    setActiveTower(null);
    setSelectedUnitType(null);
    setMaxFloor(25);
    controlsRef.current.setFilters(null, null, "");
    controlsRef.current.resetCamera();
    setStatus("Drag to orbit · tap a unit");
  };
  const selectedProjects = chatResult ? PLATFORM_PROJECTS.filter((project) => chatResult.matches.includes(project.id)) : [];
  const unitCode = selectedUnit ? `${selectedUnit.tower.slice(-1)}-${String(selectedUnit.floor).padStart(2, "0")}-${selectedUnit.stack}` : null;

  return (
    <div className={`babylon-stage babylon-${mode} ${panelOpen ? "is-open" : "is-collapsed"}`}>
      <div className="babylon-viewport" ref={viewportRef}>
        <div className={`scene-fallback scene-fallback-${mode}`} aria-hidden="true">
          <span className="scene-fallback-grid" /><span className="scene-fallback-building scene-fallback-building-a" />
          <span className="scene-fallback-building scene-fallback-building-b" /><span className="scene-fallback-building scene-fallback-building-c" />
          <span className="scene-fallback-route scene-fallback-route-a" /><span className="scene-fallback-route scene-fallback-route-b" />
        </div>
        <canvas ref={canvasRef} aria-label={`${mode} interactive line-art property preview`} />
        <div className="scene-status" aria-live="polite">{status}</div>
        <button
          className="property-dock-toggle"
          type="button"
          aria-expanded={panelOpen}
          aria-controls={`property-dock-${mode}`}
          aria-label={panelOpen ? "Collapse panel" : "Expand panel"}
          onClick={() => setPanelOpen((open) => !open)}
        >
          <span className="property-dock-icon-wide" aria-hidden="true">{panelOpen ? "›" : "‹"}</span>
          <span className="property-dock-icon-tall" aria-hidden="true">{panelOpen ? "⌃" : "⌄"}</span>
        </button>
      </div>

      <div className="property-dock" id={`property-dock-${mode}`} aria-hidden={!panelOpen}>
        {mode === "gamuda" ? (
          <>
            <section className="property-control" aria-label="Project controls">
              <div className="property-panel-head">
                <div><span>GO540 WEB</span><strong>HauS on 15</strong></div>
                <button type="button" onClick={resetView}>Reset view</button>
              </div>
              <div className="tower-browser">
                <p className="panel-kicker">Towers</p>
                <div className="tower-options">
                  {TOWERS.map((tower) => (
                    <button
                      type="button"
                      aria-label={activeTower === tower.id ? `Show all towers` : `Show only ${tower.id}`}
                      aria-pressed={activeTower === tower.id}
                      className={activeTower === tower.id ? "active" : ""}
                      onClick={() => chooseTower(tower.id)}
                      key={tower.id}
                    >
                      {tower.id.replace("Tower ", "")}
                    </button>
                  ))}
                </div>
                <p>
                  <strong>{activeTower ? `${activeTower} only` : "All towers visible"}</strong>
                  <span>{activeTower ? "Tap it again to bring the others back" : "Tap a number to show that tower on its own"}</span>
                </p>
                <label className="floor-slider">
                  <span>Floor visibility · {String(maxFloor).padStart(2, "0")}</span>
                  <input type="range" min={floorMin} max={floorMax} value={Math.min(Math.max(maxFloor, floorMin), floorMax)} onChange={(event) => chooseMaxFloor(Number(event.target.value))} />
                </label>
                <p className="panel-kicker unit-type-heading">Unit types</p>
                <div className="unit-type-options" aria-label="Floor plan types">
                  {UNIT_LAYOUTS.map((layout) => (
                    <button
                      type="button"
                      aria-pressed={selectedUnitType === layout.type}
                      className={selectedUnitType === layout.type ? "active" : ""}
                      onClick={() => chooseUnitType(layout.type)}
                      key={layout.type}
                    >
                      <i style={{ background: TYPE_COLORS[layout.type] }} aria-hidden="true" />
                      {layout.type.replace("Type ", "")}
                    </button>
                  ))}
                </div>
              </div>
            </section>
            <section className="property-details" aria-label="Unit details">
              <p className="panel-kicker">Details</p>
              {selectedUnit && unitCode ? (
                <dl className="unit-detail">
                  <div><dt>Unit</dt><dd>{unitCode}</dd></div>
                  <div><dt>Type</dt><dd>{selectedUnit.type}</dd></div>
                  <div><dt>Layout</dt><dd>{selectedUnit.rooms}</dd></div>
                  <div><dt>Size</dt><dd>{selectedUnit.size}</dd></div>
                </dl>
              ) : <p className="details-empty">Click a unit in the viewport.</p>}
            </section>
          </>
        ) : (
          <>
            <aside className="property-control property-chat" aria-label="Guided property discovery">
              <div className="chat-head"><span aria-hidden="true">✦</span><div><strong>Property guide</strong><small>Sample conversation</small></div></div>
              {!chatTopic ? (
                <div className="chat-step"><p>How may I assist you?</p><div className="chat-choices">{(Object.keys(CHAT_PATHS) as ChatTopic[]).map((topic) => <button type="button" onClick={() => setChatTopic(topic)} key={topic}>{CHAT_PATHS[topic].label}</button>)}</div></div>
              ) : !chatResult ? (
                <div className="chat-step"><button className="chat-back" type="button" onClick={() => setChatTopic(null)}>← Back</button><p>{CHAT_PATHS[chatTopic].followup}</p><div className="chat-choices">{CHAT_PATHS[chatTopic].choices.map((choice) => <button type="button" onClick={() => chooseChatResult(choice)} key={choice.label}>{choice.label}</button>)}</div></div>
              ) : (
                <div className="chat-step chat-result"><p>{chatResult.answer}</p><div className="match-list">{selectedProjects.map((project) => <article key={project.id}><span>{project.id.replace("Project ", "0")}</span><div><strong>{project.name}</strong><small>{project.note}</small></div></article>)}</div><button className="chat-reset" type="button" onClick={resetChat}>Start another search</button></div>
              )}
            </aside>
            <section className="property-details" aria-label="Development details">
              <p className="panel-kicker">Details</p>
              {selectedProject ? (
                <dl className="unit-detail">
                  <div><dt>Project</dt><dd>{selectedProject.name}</dd></div>
                  <div><dt>Note</dt><dd>{selectedProject.note}</dd></div>
                </dl>
              ) : <p className="details-empty">Click a development in the viewport.</p>}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
