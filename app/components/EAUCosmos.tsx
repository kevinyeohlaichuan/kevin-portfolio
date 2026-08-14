interface EAUCosmosProps {
  variant?: "hero" | "card";
}

export function EAUCosmos({ variant = "hero" }: EAUCosmosProps) {
  return (
    <div
      className={`eau-cosmos eau-cosmos-${variant}`}
      role="img"
      aria-label="Animated Eternal Amaris Universe galaxy with orbiting planets and a flying cultivation sword"
    >
      <div className="cosmos-nebula cosmos-nebula-violet" aria-hidden="true" />
      <div className="cosmos-nebula cosmos-nebula-jade" aria-hidden="true" />
      <div className="cosmos-starfield cosmos-stars-far" aria-hidden="true" />
      <div className="cosmos-starfield cosmos-stars-near" aria-hidden="true" />

      <div className="galaxy-disc" aria-hidden="true">
        <span className="galaxy-core" />
        <span className="galaxy-arm galaxy-arm-one" />
        <span className="galaxy-arm galaxy-arm-two" />
        <span className="galaxy-arm galaxy-arm-three" />
      </div>

      <div className="cosmos-orbit cosmos-orbit-outer" aria-hidden="true">
        <span className="orbit-world orbit-world-jade" />
      </div>
      <div className="cosmos-orbit cosmos-orbit-inner" aria-hidden="true">
        <span className="orbit-world orbit-world-peach" />
      </div>

      <div className="cosmos-planet" aria-hidden="true">
        <span className="planet-latitude planet-latitude-one" />
        <span className="planet-latitude planet-latitude-two" />
        <span className="planet-meridian" />
      </div>

      <div className="cosmos-sword-flight" aria-hidden="true">
        <span className="cosmos-sword-trail" />
        <span className="cosmos-sword-blade" />
        <span className="cosmos-sword-guard" />
        <span className="cosmos-sword-handle" />
      </div>

      <div className="cosmos-coordinate cosmos-coordinate-top" aria-hidden="true">
        MILKY WAY // EAU SECTOR 001
      </div>
      <div className="cosmos-coordinate cosmos-coordinate-bottom" aria-hidden="true">
        神 · 魔 · 妖 · 人 // ORGANIC + MACHINE
      </div>
    </div>
  );
}
