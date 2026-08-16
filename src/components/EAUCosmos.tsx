import { OrnateSword } from "./OrnateSword";

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
        {Array.from({ length: 11 }, (_, index) => (
          <span className={`galaxy-ring galaxy-ring-${index + 1}`} key={index} />
        ))}
        <span className="galaxy-core" />
      </div>

      <span className="cosmos-orbit cosmos-orbit-one" aria-hidden="true"><i /></span>
      <span className="cosmos-orbit cosmos-orbit-two" aria-hidden="true"><i /></span>
      <span className="cosmos-orbit cosmos-orbit-three" aria-hidden="true"><i /></span>
      <span className="cosmos-orbit cosmos-orbit-four" aria-hidden="true"><i /></span>

      <span className="cosmos-spark cosmos-spark-one" aria-hidden="true" />
      <span className="cosmos-spark cosmos-spark-two" aria-hidden="true" />
      <span className="cosmos-spark cosmos-spark-three" aria-hidden="true" />
      <span className="cosmos-spark cosmos-spark-four" aria-hidden="true" />

      <div className="cosmos-sword-flight" aria-hidden="true">
        <OrnateSword />
      </div>
    </div>
  );
}
