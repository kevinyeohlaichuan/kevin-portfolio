"use client";

import dynamic from "next/dynamic";

const BabylonRuntime = dynamic(
  () => import("./BabylonLineScene").then((module) => module.BabylonLineScene),
  { ssr: false },
);

const MotionRuntime = dynamic(
  () => import("./EAUMotion").then((module) => module.EAUMotion),
  { ssr: false },
);

export function BabylonLineScene({ mode }: { mode: "gamuda" | "platform" }) {
  return <BabylonRuntime mode={mode} />;
}

export function EAUMotion() {
  return <MotionRuntime />;
}
