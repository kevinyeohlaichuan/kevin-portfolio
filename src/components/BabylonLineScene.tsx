// Deep imports keep the Babylon preview small enough for mobile visitors.
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera.js";
import { Engine } from "@babylonjs/core/Engines/engine.js";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder.js";
import type { Mesh } from "@babylonjs/core/Meshes/mesh.js";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import { Scene } from "@babylonjs/core/scene.js";
import * as builder from "@babylonjs/core/Meshes/Builders/greasedLineBuilder.js";
import * as materials from "@babylonjs/core/Materials/GreasedLine/greasedLineMaterialInterfaces.js";
import { useEffect, useRef, useState } from "react";

type SceneMode = "gamuda" | "platform";
type ExplorerTab = "project" | "towers" | "facilities";

interface BabylonLineSceneProps { mode: SceneMode; }
interface LineMaterial { dashOffset: number; }
interface SceneControls {
  selectFloor: (tower: string, floor: number) => void;
  showMatches: (projects: string[]) => void;
}

const TOWERS = [
  { id: "Tower A", floors: 13, start: 8, note: "Quieter edge · morning light" },
  { id: "Tower B", floors: 18, start: 8, note: "Central facilities · city view" },
  { id: "Tower C", floors: 15, start: 8, note: "Transit side · evening light" },
] as const;

const UNIT_LAYOUTS = [
  { stack: "01", type: "Type A", rooms: "2 bed · 2 bath", size: "750 sq ft" },
  { stack: "02", type: "Type B", rooms: "3 bed · 2 bath", size: "958 sq ft" },
  { stack: "03", type: "Type C", rooms: "3+1 bed · 2 bath", size: "1,152 sq ft" },
] as const;

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
  const controlsRef = useRef<SceneControls>({ selectFloor: () => {}, showMatches: () => {} });
  const [status, setStatus] = useState(mode === "gamuda" ? "Drag to orbit · tap a floor" : "Drag to explore · ask for a match");
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<ExplorerTab>("project");
  const [selectedTower, setSelectedTower] = useState("Tower B");
  const [selectedFloor, setSelectedFloor] = useState(12);
  const [chatTopic, setChatTopic] = useState<ChatTopic | null>(null);
  const [chatResult, setChatResult] = useState<ChatResult | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new Engine(canvas, true, { antialias: true, preserveDrawingBuffer: false, stencil: false, powerPreference: "high-performance" });
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0, 0, 0, 0);
    scene.skipPointerMovePicking = true;
    const camera = new ArcRotateCamera(`camera-${mode}`, mode === "platform" ? -Math.PI / 2.35 : -Math.PI / 2.55, 1.05, 16, new Vector3(0, 1.7, 0), scene);
    camera.lowerRadiusLimit = 10;
    camera.upperRadiusLimit = 23;
    camera.wheelDeltaPercentage = 0.02;
    camera.panningSensibility = 0;
    camera.attachControl(canvas, true);

    const violet = Color3.FromHexString("#b69cff");
    const jade = Color3.FromHexString("#8ee3c0");
    const ink = Color3.FromHexString("#f5f0ff");
    const root = new TransformNode(`root-${mode}`, scene);
    const lineMaterials: LineMaterial[] = [];
    const selectable: Mesh[] = [];
    const groups = new Map<string, Mesh[]>();
    const makeWireMaterial = (name: string, color: Color3, alpha = 0.62) => {
      const material = new StandardMaterial(name, scene);
      material.wireframe = true;
      material.disableLighting = true;
      material.emissiveColor = color;
      material.alpha = alpha;
      return material;
    };
    const violetWire = makeWireMaterial(`violet-${mode}`, violet, 0.9);
    const jadeWire = makeWireMaterial(`jade-${mode}`, jade, 0.68);
    const quietWire = makeWireMaterial(`quiet-${mode}`, ink, mode === "platform" ? 0.28 : 0.34);
    const makeRoute = (name: string, points: Vector3[], color: Color3, dashed = true, width = 0.07) => {
      const line = builder.CreateGreasedLine(name, { points }, {
        materialType: materials.GreasedLineMeshMaterialType.MATERIAL_TYPE_SIMPLE,
        color, width, useDash: dashed, dashCount: 24, dashRatio: 0.36, sizeAttenuation: false,
      }, scene);
      line.parent = root;
      const material = line.material as unknown as LineMaterial | null;
      if (material) lineMaterials.push(material);
      return line;
    };
    const createBuilding = (x: number, z: number, floors: number, width: number, depth: number, material: StandardMaterial, label: string) => {
      const meshes: Mesh[] = [];
      for (let floorIndex = 0; floorIndex < floors; floorIndex += 1) {
        const mesh = CreateBox(`${label}-${floorIndex + 1}`, { width, depth, height: 0.42 }, scene);
        mesh.position.set(x, floorIndex * 0.47 + 0.28, z);
        mesh.material = material;
        mesh.parent = root;
        mesh.metadata = { tower: label, floor: floorIndex + 8 };
        meshes.push(mesh);
        if (mode === "gamuda") selectable.push(mesh);
      }
      groups.set(label, meshes);
    };

    const gridSize = mode === "platform" ? 8 : 7;
    for (let line = -gridSize; line <= gridSize; line += 1) {
      makeRoute(`grid-x-${line}`, [new Vector3(-gridSize, 0, line), new Vector3(gridSize, 0, line)], ink, false, 0.012);
      makeRoute(`grid-z-${line}`, [new Vector3(line, 0, -gridSize), new Vector3(line, 0, gridSize)], ink, false, 0.012);
    }
    if (mode === "gamuda") {
      createBuilding(-2.35, 0.1, 13, 2.7, 2.0, quietWire, "Tower A");
      createBuilding(0, -0.35, 18, 2.45, 2.05, violetWire, "Tower B");
      createBuilding(2.2, 0.25, 15, 2.55, 2.0, jadeWire, "Tower C");
      makeRoute("gamuda-transit", [new Vector3(-7, 0.08, 4), new Vector3(-4, 0.08, 1.5), new Vector3(-1, 0.08, 3.2), new Vector3(2.2, 0.08, 1.2), new Vector3(7, 0.08, 3.5)], jade, true, 0.09);
    } else {
      const city = [
        [-4.3, -2.2, 5, 1.4, 1.2], [-2.2, 1.5, 8, 1.7, 1.5], [0, -1.5, 12, 2.0, 1.8],
        [2.4, 1.2, 7, 1.4, 1.5], [4.1, -2, 10, 1.6, 1.4], [4.5, 3.2, 5, 1.3, 1.3], [-4.8, 3.3, 6, 1.5, 1.2],
      ] as const;
      city.forEach(([x, z, floors, width, depth], index) => createBuilding(x, z, floors, width, depth, quietWire, `Project ${index + 1}`));
      makeRoute("platform-route-a", [new Vector3(-7, 0.1, -4), new Vector3(-4.3, 0.1, -2.2), new Vector3(-2.2, 0.1, 1.5), new Vector3(0, 0.1, -1.5), new Vector3(4.1, 0.1, -2), new Vector3(7, 0.1, 0.2)], ink, true, 0.065);
      makeRoute("platform-route-b", [new Vector3(-6, 0.12, 4.5), new Vector3(-2.2, 0.12, 1.5), new Vector3(2.4, 0.12, 1.2), new Vector3(4.5, 0.12, 3.2), new Vector3(7, 0.12, 4)], ink, true, 0.055);
    }

    const baseMaterial = (tower: string) => tower === "Tower B" ? violetWire : tower === "Tower C" ? jadeWire : quietWire;
    const selectFloor = (tower: string, floor: number) => {
      groups.forEach((meshes, label) => meshes.forEach((mesh) => { mesh.material = baseMaterial(label); }));
      const mesh = groups.get(tower)?.find((candidate) => candidate.metadata?.floor === floor);
      if (mesh) mesh.material = violetWire;
      setStatus(`${tower} · Level ${String(floor).padStart(2, "0")} · units ready to inspect`);
    };
    const showMatches = (projects: string[]) => {
      groups.forEach((meshes, label) => meshes.forEach((mesh) => { mesh.material = projects.includes(label) ? violetWire : quietWire; }));
      setStatus(projects.length ? `${projects.length} matching developments highlighted` : "Drag to explore · ask for a match");
    };
    controlsRef.current = { selectFloor, showMatches };

    if (mode === "gamuda") {
      scene.onPointerObservable.add((pointerInfo) => {
        if (pointerInfo.type !== PointerEventTypes.POINTERPICK) return;
        const mesh = pointerInfo.pickInfo?.pickedMesh as Mesh | null;
        if (!mesh || !selectable.includes(mesh)) return;
        const tower = String(mesh.metadata?.tower ?? "Tower B");
        const floor = Number(mesh.metadata?.floor ?? 12);
        setSelectedTower(tower);
        setSelectedFloor(floor);
        setPanelTab("towers");
        setPanelOpen(true);
        selectFloor(tower, floor);
      });
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let visible = true;
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { rootMargin: "160px" });
    observer.observe(canvas);
    scene.onBeforeRenderObservable.add(() => { if (!reducedMotion) lineMaterials.forEach((material) => { material.dashOffset -= 0.003; }); });
    engine.runRenderLoop(() => { if (visible) scene.render(); });
    const resize = new ResizeObserver(() => engine.resize());
    resize.observe(canvas);
    return () => {
      controlsRef.current = { selectFloor: () => {}, showMatches: () => {} };
      observer.disconnect();
      resize.disconnect();
      scene.dispose();
      engine.dispose();
    };
  }, [mode]);

  const chooseTower = (tower: string) => {
    const towerData = TOWERS.find((item) => item.id === tower) ?? TOWERS[1];
    const floor = Math.min(Math.max(selectedFloor, towerData.start), towerData.start + towerData.floors - 1);
    setSelectedTower(tower);
    setSelectedFloor(floor);
    controlsRef.current.selectFloor(tower, floor);
  };
  const chooseFloor = (floor: number) => {
    setSelectedFloor(floor);
    controlsRef.current.selectFloor(selectedTower, floor);
  };
  const chooseChatResult = (result: ChatResult) => {
    setChatResult(result);
    controlsRef.current.showMatches([...result.matches]);
  };
  const resetChat = () => {
    setChatTopic(null);
    setChatResult(null);
    controlsRef.current.showMatches([]);
  };
  const activeTower = TOWERS.find((tower) => tower.id === selectedTower) ?? TOWERS[1];
  const selectedProjects = chatResult ? PLATFORM_PROJECTS.filter((project) => chatResult.matches.includes(project.id)) : [];

  return (
    <div className={`babylon-stage babylon-${mode}`}>
      <div className={`scene-fallback scene-fallback-${mode}`} aria-hidden="true">
        <span className="scene-fallback-grid" /><span className="scene-fallback-building scene-fallback-building-a" />
        <span className="scene-fallback-building scene-fallback-building-b" /><span className="scene-fallback-building scene-fallback-building-c" />
        <span className="scene-fallback-route scene-fallback-route-a" /><span className="scene-fallback-route scene-fallback-route-b" />
      </div>
      <canvas ref={canvasRef} aria-label={`${mode} interactive line-art property preview`} />
      <div className="scene-status" aria-live="polite">{status}</div>

      {mode === "gamuda" ? (
        <>
          <button className="property-panel-trigger" type="button" aria-expanded={panelOpen} onClick={() => setPanelOpen((open) => !open)}><span aria-hidden="true">⌁</span> Explore project</button>
          {panelOpen ? (
            <aside className="property-panel" aria-label="Project explorer">
              <div className="property-panel-head"><div><span>GO540 WEB</span><strong>HauS on 15</strong></div><button type="button" aria-label="Close project explorer" onClick={() => setPanelOpen(false)}>×</button></div>
              <div className="property-tabs" role="tablist" aria-label="Project information">
                {(["project", "towers", "facilities"] as ExplorerTab[]).map((tab) => <button type="button" role="tab" aria-selected={panelTab === tab} onClick={() => setPanelTab(tab)} key={tab}>{tab}</button>)}
              </div>
              {panelTab === "project" ? (
                <div className="property-panel-copy"><span className="panel-kicker">Interactive sales experience</span><h3>Explore before visiting.</h3><p>Orbit the development, choose a tower and inspect sample unit information in one place.</p><dl><div><dt>Location</dt><dd>Subang Jaya</dd></div><div><dt>Experience</dt><dd>Web · mobile · showroom</dd></div></dl><button type="button" onClick={() => setPanelTab("towers")}>Choose a tower →</button></div>
              ) : null}
              {panelTab === "towers" ? (
                <div className="tower-browser">
                  <div className="tower-options">{TOWERS.map((tower) => <button type="button" className={selectedTower === tower.id ? "active" : ""} onClick={() => chooseTower(tower.id)} key={tower.id}>{tower.id.replace("Tower ", "")}</button>)}</div>
                  <p><strong>{selectedTower}</strong><span>{activeTower.note}</span></p>
                  <div className="floor-options" aria-label={`${selectedTower} floors`}>{Array.from({ length: activeTower.floors }, (_, index) => activeTower.start + index).map((floor) => <button type="button" aria-pressed={selectedFloor === floor} onClick={() => chooseFloor(floor)} key={floor}>{String(floor).padStart(2, "0")}</button>)}</div>
                  <div className="unit-list">{UNIT_LAYOUTS.map((unit) => <article key={unit.stack}><span>{selectedTower.slice(-1)}-{String(selectedFloor).padStart(2, "0")}-{unit.stack}</span><strong>{unit.type}</strong><small>{unit.rooms} · {unit.size}</small></article>)}</div>
                  <small className="sample-note">Illustrative unit data for this portfolio demo.</small>
                </div>
              ) : null}
              {panelTab === "facilities" ? (
                <div className="facility-list">
                  <article><span>01</span><div><strong>Arrival court</strong><small>Drop-off and lobby connection</small></div></article>
                  <article><span>02</span><div><strong>Pool deck</strong><small>Family pool and shaded seating</small></div></article>
                  <article><span>03</span><div><strong>Sky garden</strong><small>Elevated green and social space</small></div></article>
                  <article><span>04</span><div><strong>Transit link</strong><small>Walking route shown on the map</small></div></article>
                </div>
              ) : null}
            </aside>
          ) : null}
        </>
      ) : (
        <aside className="property-chat" aria-label="Guided property discovery">
          <div className="chat-head"><span aria-hidden="true">✦</span><div><strong>Property guide</strong><small>Sample conversation</small></div></div>
          {!chatTopic ? (
            <div className="chat-step"><p>How may I assist you?</p><div className="chat-choices">{(Object.keys(CHAT_PATHS) as ChatTopic[]).map((topic) => <button type="button" onClick={() => setChatTopic(topic)} key={topic}>{CHAT_PATHS[topic].label}</button>)}</div></div>
          ) : !chatResult ? (
            <div className="chat-step"><button className="chat-back" type="button" onClick={() => setChatTopic(null)}>← Back</button><p>{CHAT_PATHS[chatTopic].followup}</p><div className="chat-choices">{CHAT_PATHS[chatTopic].choices.map((choice) => <button type="button" onClick={() => chooseChatResult(choice)} key={choice.label}>{choice.label}</button>)}</div></div>
          ) : (
            <div className="chat-step chat-result"><p>{chatResult.answer}</p><div className="match-list">{selectedProjects.map((project) => <article key={project.id}><span>{project.id.replace("Project ", "0")}</span><div><strong>{project.name}</strong><small>{project.note}</small></div></article>)}</div><button className="chat-reset" type="button" onClick={resetChat}>Start another search</button></div>
          )}
        </aside>
      )}
    </div>
  );
}
