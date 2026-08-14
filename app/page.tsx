import { BabylonLineScene } from "./components/BabylonLineScene";
import { EAUMotion } from "./components/EAUMotion";
import { GameMicroDemo } from "./components/GameMicroDemo";
import { LiveProductFrame } from "./components/LiveProductFrame";

const solutions = [
  {
    code: "PRO",
    title: "Sales-gallery experiences",
    copy: "Offline Unreal Engine presentations for large displays, touchscreens and immersive property galleries.",
    note: "Project adaptation · asset integration · interactive presentation",
    href: "https://goprop.ai/pro/",
  },
  {
    code: "WEB",
    title: "Browser-based archviz",
    copy: "Interactive project showcases buyers can explore anywhere, across desktop, tablet and mobile browsers.",
    note: "React · Babylon.js · PHP · MySQL · deployment",
    href: "https://goprop.ai/web/",
  },
  {
    code: "PLATFORM",
    title: "AI-assisted discovery",
    copy: "A property marketplace combining verified listings, immersive views and preference-based recommendations.",
    note: "Full-stack product · APIs · data · 3D web",
    href: "https://goprop.ai/platform/",
  },
];

const capabilities = [
  {
    index: "A",
    title: "Full-stack archviz delivery",
    copy: "React, TypeScript, JavaScript, PHP, Laravel, Node.js, Fastify, MySQL, HeidiSQL, APIs, content tools and production deployment.",
  },
  {
    index: "B",
    title: "Interactive 3D systems",
    copy: "Babylon.js, Three.js, Blender, glTF/GLB, asset pipelines, compression, runtime profiling, interaction design and Unreal Engine 5.",
  },
  {
    index: "C",
    title: "Games and visual craft",
    copy: "Godot 4, GDScript, gameplay systems, pixel art, animation, testing, publishing and seven years of hands-on visual practice.",
  },
];

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

function EAUSeal() {
  return <span className="eau-seal" aria-label="EAU"><b>E</b><b>A</b><b>U</b></span>;
}

export default function Home() {
  return (
    <main>
      <EAUMotion />

      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Back to top">
          <EAUSeal />
          <span>Eternal Amaris Universe</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#work">Professional</a>
          <a href="#games">Games</a>
          <a href="#about">Capabilities</a>
          <a href="/card">Card</a>
        </nav>
        <a className="header-cta" href="mailto:spicymsgstudio@gmail.com">
          Contact <Arrow />
        </a>
      </header>

      <section className="hero" id="top">
        <div className="hero-grid-glow" aria-hidden="true" />
        <div className="hero-copy">
          <p className="kicker"><span /> Kuala Lumpur, Malaysia</p>
          <h1>Building<br />digital worlds.</h1>
          <p className="hero-intro">
            I’m <strong>Kevin Yeoh</strong>—a full-stack developer at <strong>GoProp</strong>,
            building architectural-visualisation products. I also run <strong>Spicy MSG Studio</strong>,
            creating games in the Eternal Amaris Universe.
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="#work">Explore my work <span aria-hidden="true">↓</span></a>
            <a className="secondary-link" href="/card">Open digital card <Arrow /></a>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-visual-label"><span>EAU // 001</span><span>FULL-STACK · ARCHVIZ · GAMES</span></div>
          <BabylonLineScene mode="hero" />
        </div>
        <div className="proof-strip" aria-label="Selected career highlights">
          <div><strong>84%</strong><span>production 3D model reduction</span></div>
          <div><strong>3</strong><span>archviz solution lanes</span></div>
          <div><strong>2×</strong><span>game-jam award winner</span></div>
          <div><strong>7 yrs</strong><span>pixel-art practice</span></div>
        </div>
      </section>

      <section className="section professional-intro" id="work">
        <div className="section-heading">
          <p className="kicker"><span /> Professional work</p>
          <h2>Architectural visualisation,<br />built to be explored.</h2>
          <p>
            At GoProp, I work across immersive sales-gallery experiences,
            browser-based project showcases and an AI-assisted property platform.
          </p>
        </div>

        <div className="solution-grid">
          {solutions.map((solution) => (
            <a href={solution.href} target="_blank" rel="noreferrer" key={solution.code}>
              <span>{solution.code}</span>
              <h3>{solution.title}</h3>
              <p>{solution.copy}</p>
              <small>{solution.note}</small>
            </a>
          ))}
        </div>

        <div className="work-list">
          <article className="work-card">
            <div className="work-visual-shell">
              <div className="visual-topline"><span>LIVE WEB ARCHVIZ</span><span>01</span></div>
              <BabylonLineScene mode="gamuda" />
              <LiveProductFrame title="HauS on 15 — Gamuda SS15" url="https://goprop.ai/demo/gamuda-ss15/" />
            </div>
            <div className="work-copy">
              <p className="project-eyebrow">GO540 WEB · END-TO-END DELIVERY</p>
              <h3>HauS on 15 —<br />Gamuda SS15</h3>
              <p className="project-summary">
                A production 3D property-sales experience covering project discovery,
                location, facilities, units, galleries, content data and deployment.
              </p>
              <p className="project-result">239.8 MB source model → 34.6 MB web-ready runtime</p>
              <div className="scope-list">
                <span>Frontend and interaction</span><span>Babylon.js runtime</span>
                <span>PHP and MySQL</span><span>HeidiSQL data work</span>
                <span>Blender / glTF pipeline</span><span>Build and deployment</span>
              </div>
              <a className="text-link" href="https://goprop.ai/demo/gamuda-ss15/" target="_blank" rel="noreferrer">
                Open full experience <Arrow />
              </a>
            </div>
          </article>

          <article className="work-card reverse">
            <div className="work-visual-shell">
              <div className="visual-topline"><span>PROPERTY PLATFORM</span><span>02</span></div>
              <div className="platform-query" aria-hidden="true">
                <span>AI property discovery</span>
                <strong>Find investment-ready units near transit</strong>
              </div>
              <BabylonLineScene mode="platform" />
              <LiveProductFrame title="GoProp Platform" url="https://dev.goprop.ai/" />
            </div>
            <div className="work-copy">
              <p className="project-eyebrow">MARKETPLACE · AI-ASSISTED DISCOVERY</p>
              <h3>GoProp<br />Platform</h3>
              <p className="project-summary">
                A property marketplace where buyers discover verified developments
                through immersive listings, location context and preference-based recommendations.
              </p>
              <p className="project-result">540° showcases the project. GoProp connects it to the buyer journey.</p>
              <div className="scope-list">
                <span>React product UI</span><span>3D property maps</span>
                <span>Laravel / PHP</span><span>Node.js / Fastify</span>
                <span>MySQL and APIs</span><span>Production delivery</span>
              </div>
              <a className="text-link" href="https://dev.goprop.ai/" target="_blank" rel="noreferrer">
                Explore the platform <Arrow />
              </a>
            </div>
          </article>
        </div>
      </section>

      <div className="flight-divider" aria-hidden="true">
        <span className="flight-label">HUMAN SECTOR // CULTIVATION SECTOR</span>
        <div className="flight-path" />
        <div className="flight-courier"><span className="courier-head" /><span className="courier-body" /><span className="courier-sword" /></div>
      </div>

      <section className="section games-section" id="games">
        <div className="section-heading compact">
          <p className="kicker"><span /> Games · EAU</p>
          <h2>Worlds I’m building<br />from the inside out.</h2>
          <p>Short interactive line-art vignettes carry the feel. The complete games live beyond the portfolio.</p>
        </div>
        <GameMicroDemo />
      </section>

      <section className="section capabilities" id="about">
        <div className="section-heading compact">
          <p className="kicker"><span /> Capabilities</p>
          <h2>One delivery path.<br />Three technical lenses.</h2>
          <p>Full-stack is the foundation. Interactive 3D and game development are the specialisations built on top.</p>
        </div>
        <div className="capability-list">
          {capabilities.map((group) => (
            <article key={group.index}>
              <span>{group.index}</span>
              <h3>{group.title}</h3>
              <p>{group.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="contact-section">
        <p className="kicker"><span /> Let’s talk</p>
        <h2>Need an interactive<br />digital product?</h2>
        <p className="contact-copy">
          I’m open to full-stack, architectural-visualisation, interactive 3D web
          and game-development opportunities in Malaysia or with remote teams.
        </p>
        <div className="contact-links">
          <a href="mailto:spicymsgstudio@gmail.com">Email me <Arrow /></a>
          <a href="/card">Digital card <Arrow /></a>
          <a href="https://www.linkedin.com/in/kevin-yeoh-lai-chuan-a7b529240/" target="_blank" rel="noreferrer">LinkedIn <Arrow /></a>
          <a href="https://github.com/kevinyeohlaichuan" target="_blank" rel="noreferrer">GitHub <Arrow /></a>
          <a href="https://kevin-d-eternal.itch.io/" target="_blank" rel="noreferrer">Itch.io <Arrow /></a>
        </div>
      </section>

      <footer>
        <span>© 2026 Kevin Yeoh</span>
        <span>EAU · Full-stack archviz · Interactive 3D · Games</span>
      </footer>
    </main>
  );
}
