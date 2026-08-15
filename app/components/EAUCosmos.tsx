interface EAUCosmosProps {
  variant?: "hero" | "card";
}

export function EAUCosmos({ variant = "hero" }: EAUCosmosProps) {
  return (
    <div
      className={`eau-cosmos eau-cosmos-${variant}`}
      role="img"
      aria-label="Animated Eternal Amaris Universe line-art galaxy with a flying cultivation sword"
    >
      <div className="cosmos-starfield cosmos-stars-far" aria-hidden="true" />
      <div className="cosmos-starfield cosmos-stars-near" aria-hidden="true" />

      <div className="galaxy-disc" aria-hidden="true">
        <span className="galaxy-core" />
        <span className="galaxy-arm galaxy-arm-one" />
        <span className="galaxy-arm galaxy-arm-two" />
        <span className="galaxy-arm galaxy-arm-three" />
        <span className="galaxy-arm galaxy-arm-four" />
      </div>

      <div className="cosmos-orbit cosmos-orbit-outer" aria-hidden="true">
        <span className="orbit-world orbit-world-jade" />
      </div>
      <div className="cosmos-orbit cosmos-orbit-inner" aria-hidden="true">
        <span className="orbit-world orbit-world-peach" />
      </div>

      <div className="cosmos-sword-flight" aria-hidden="true">
        <span className="cosmos-sword-trail" />
        <span className="cosmos-sword-blade" />
        <span className="cosmos-sword-guard" />
        <span className="cosmos-sword-handle" />
      </div>

    </div>
  );
}
