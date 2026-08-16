import { useState } from "react";
import { EAUCosmos } from "./EAUCosmos";

export function CardClient() {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const data = {
      title: "Kevin Yeoh — Building digital worlds",
      text: "Full-stack archviz developer and game developer.",
      url: window.location.href,
    };

    if (navigator.share) {
      await navigator.share(data);
      return;
    }

    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <main className="card-page">
      <div className="digital-card">
        <div className="digital-card-copy">
          <a className="wordmark" href="/" aria-label="Return to portfolio">
            <span className="eau-seal"><b>E</b><b>A</b><b>U</b></span>
            <span>Eternal Amaris Universe</span>
          </a>
          <div>
            <p className="kicker"><span /> Kuala Lumpur, Malaysia</p>
            <h1>Building<br />digital worlds.</h1>
            <p>Kevin Yeoh · Full-stack archviz developer at GoProp · Game developer at Spicy MSG Studio</p>
          </div>
          <div className="card-actions">
            <a href="mailto:spicymsgstudio@gmail.com">Email</a>
            <a href="/kevin-yeoh.vcf" download>Save contact</a>
            <button type="button" onClick={share}>{copied ? "Link copied" : "Share card"}</button>
          </div>
        </div>
        <div className="digital-card-visual"><EAUCosmos variant="card" /></div>
      </div>
      <a className="card-back-link" href="/">View full portfolio ↓</a>
    </main>
  );
}
