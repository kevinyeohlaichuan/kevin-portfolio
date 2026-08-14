const work = [
  {
    number: "01",
    eyebrow: "Solo engineering · Visual assets supplied",
    title: "HauS on 15 — Gamuda SS15",
    summary:
      "A production 3D property-sales experience built across the browser, asset pipeline, content tools, and deployment.",
    result: "239.8 MB source model → 34.6 MB web-ready runtime",
    tags: ["React", "TypeScript", "Babylon.js", "Blender / glTF"],
    href: "https://goprop.ai/demo/gamuda-ss15/",
    link: "Open live experience",
    visual: "building",
  },
  {
    number: "02",
    eyebrow: "Company platform · Shared with Koh",
    title: "GoProp.ai",
    summary:
      "A live property platform combining discovery, regional maps, AI-assisted search, backend services, and interactive 3D.",
    result: "My lane: 3D web, product tooling, APIs, asset delivery, and releases",
    tags: ["React", "Laravel", "Node.js", "MySQL"],
    href: "https://dev.goprop.ai/",
    link: "Explore the platform",
    visual: "map",
  },
];

const games = [
  {
    status: "Released · Google Play",
    title: "Nasi Lemak Survivors",
    summary:
      "A Malaysian survivor roguelite built and released in Godot, including gameplay, original pixel art, animation, monetization, and store delivery.",
    href: "https://play.google.com/store/apps/details?id=com.eternalamaris.nasilemak.survivors",
    link: "View on Google Play",
  },
  {
    status: "Current WIP · Small team",
    title: "I Got a System",
    summary:
      "A 2D cultivation game where the player trains an AI-controlled host. I work across gameplay systems, tools, UI, and pixel-art production.",
  },
  {
    status: "Released · Itch.io",
    title: "To Infinity and Beyond",
    summary:
      "A solo-developed 2D precision platformer designed, programmed, illustrated, animated, and published in Godot.",
    href: "https://kevin-d-eternal.itch.io/to-infinity-and-beyond",
    link: "Play on Itch.io",
  },
];

const skillGroups = [
  {
    index: "A",
    title: "Interactive 3D web",
    copy: "React, TypeScript, Babylon.js, Zustand, HTML/CSS, Blender, glTF/GLB, profiling, and asset optimization.",
  },
  {
    index: "B",
    title: "Backend and delivery",
    copy: "Laravel, PHP, Node.js, Fastify, MySQL, REST APIs, webhooks, production debugging, and deployment.",
  },
  {
    index: "C",
    title: "Games and visual craft",
    copy: "Godot 4, GDScript, Unreal Engine 5, Blueprint, gameplay systems, pixel art, animation, testing, and publishing.",
  },
];

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Back to top">
          <span className="wordmark-mark">EA</span>
          <span>Eternal Amaris Universe</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#work">Work</a>
          <a href="#games">Games</a>
          <a href="#about">About</a>
        </nav>
        <a className="header-cta" href="mailto:spicymsgstudio@gmail.com">
          Contact <Arrow />
        </a>
      </header>

      <section className="hero" id="top">
        <div className="hero-orbit" aria-hidden="true">
          <span className="orbit-dot dot-one" />
          <span className="orbit-dot dot-two" />
          <span className="orbit-dot dot-three" />
        </div>
        <p className="kicker"><span /> Kuala Lumpur, Malaysia</p>
        <h1>
          I build digital worlds
          <span>that people can use.</span>
        </h1>
        <div className="hero-bottom">
          <p>
            I’m <strong>Kevin Yeoh</strong>—a full-stack developer focused on
            interactive 3D web products, and a game developer shipping under
            Spicy MSG Studio.
          </p>
          <a className="primary-button" href="#work">
            See selected work <span aria-hidden="true">↓</span>
          </a>
        </div>
        <div className="proof-strip" aria-label="Selected career highlights">
          <div><strong>84%</strong><span>production 3D model reduction</span></div>
          <div><strong>2</strong><span>commercial games shipped</span></div>
          <div><strong>2×</strong><span>game-jam award winner</span></div>
          <div><strong>7 yrs</strong><span>pixel-art practice</span></div>
        </div>
      </section>

      <section className="section selected-work" id="work">
        <div className="section-heading">
          <p className="kicker"><span /> Selected work</p>
          <h2>Production proof,<br />not practice exercises.</h2>
          <p>Two live products. Different ownership. Both clearly labelled.</p>
        </div>

        <div className="work-list">
          {work.map((project) => (
            <article className="work-card" key={project.title}>
              <div className={`project-visual ${project.visual}`} aria-hidden="true">
                <div className="visual-topline">
                  <span>LIVE PRODUCT</span><span>{project.number}</span>
                </div>
                {project.visual === "building" ? (
                  <div className="tower-scene">
                    <span className="tower tower-one" />
                    <span className="tower tower-two" />
                    <span className="tower tower-three" />
                    <span className="ground-line" />
                  </div>
                ) : (
                  <div className="map-scene">
                    <span className="route route-one" />
                    <span className="route route-two" />
                    <span className="map-pin pin-one" />
                    <span className="map-pin pin-two" />
                    <span className="map-pin pin-three" />
                  </div>
                )}
              </div>
              <div className="work-copy">
                <p className="project-eyebrow">{project.eyebrow}</p>
                <h3>{project.title}</h3>
                <p className="project-summary">{project.summary}</p>
                <p className="project-result">{project.result}</p>
                <div className="tag-row">
                  {project.tags.map((tag) => <span key={tag}>{tag}</span>)}
                </div>
                <a className="text-link" href={project.href} target="_blank" rel="noreferrer">
                  {project.link} <Arrow />
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section games-section" id="games">
        <div className="section-heading compact">
          <p className="kicker"><span /> Games</p>
          <h2>Small worlds,<br />fully shipped.</h2>
        </div>
        <div className="games-grid">
          {games.map((game, index) => (
            <article className="game-card" key={game.title}>
              <div className="game-index">0{index + 1}</div>
              <p className="game-status">{game.status}</p>
              <h3>{game.title}</h3>
              <p>{game.summary}</p>
              {game.href ? (
                <a className="text-link" href={game.href} target="_blank" rel="noreferrer">
                  {game.link} <Arrow />
                </a>
              ) : <span className="quiet-link">Private development</span>}
            </article>
          ))}
        </div>
      </section>

      <section className="section capabilities" id="about">
        <div className="section-heading compact">
          <p className="kicker"><span /> Capabilities</p>
          <h2>Across the whole<br />delivery path.</h2>
        </div>
        <div className="capability-list">
          {skillGroups.map((group) => (
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
        <h2>Need a product that<br />has to feel alive?</h2>
        <p className="contact-copy">
          I’m interested in full-stack, interactive 3D web, and game-development
          work in Malaysia or with remote teams.
        </p>
        <div className="contact-links">
          <a href="mailto:spicymsgstudio@gmail.com">Email me <Arrow /></a>
          <a href="https://www.linkedin.com/in/kevin-yeoh-lai-chuan-a7b529240/" target="_blank" rel="noreferrer">LinkedIn <Arrow /></a>
          <a href="https://github.com/kevinyeohlaichuan" target="_blank" rel="noreferrer">GitHub <Arrow /></a>
          <a href="https://kevin-d-eternal.itch.io/" target="_blank" rel="noreferrer">Itch.io <Arrow /></a>
        </div>
      </section>

      <footer>
        <span>© 2026 Kevin Yeoh</span>
        <span>Full-stack · 3D web · Games</span>
      </footer>
    </main>
  );
}
