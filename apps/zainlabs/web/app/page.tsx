import Link from "next/link";
import { featuredProjects, projectsIn, site, stats, streams } from "@zainlabs/content";
import { Asterisk } from "@/components/Asterisk";
import { Hero3DClient } from "@/components/Hero3DClient";
import { ProjectCard } from "@/components/ProjectCard";

export default function Home() {
  const s = stats();
  return (
    <>
      <section className="hero" style={{ padding: 0 }}>
        <div className="hero-grid">
          <div className="wrap hero-copy" style={{ maxWidth: 640, marginRight: 0 }}>
            <span className="mono">{site.location.toUpperCase()}</span>
            <h1>
              Engineering <em>agentic AI</em>, apps and media for DACH.
            </h1>
            <p className="lead">{site.intro}</p>
            <div className="hero-ctas">
              <Link href="/projects" className="btn">
                Explore projects <span aria-hidden="true">→</span>
              </Link>
              <Link href="/contact" className="btn btn-ghost">
                Start a project
              </Link>
            </div>
          </div>
          <div className="hero-stage">
            <div className="grid-lines" />
            <Hero3DClient />
            <span className="hero-tag mono">REAL-TIME 3D · MOVE YOUR CURSOR</span>
          </div>
        </div>
      </section>

      <section id="streams">
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow mono"><Asterisk size={14} /> FIVE STREAMS</span>
              <h2>One studio, five production lines.</h2>
            </div>
            <p>Each stream is a reusable factory, not a one-off project. Software provides the back ends, websites and apps the storefront, the studio the content, deep-tech the long-horizon research.</p>
          </div>
          <div className="streams">
            {streams.map((st) => (
              <Link key={st.slug} href={`/streams/${st.slug}`} className="stream">
                <span className="code">{st.code}</span>
                <h3>{st.name}</h3>
                <p className="muted">{st.tagline}</p>
                <span className="count">{projectsIn(st.slug).length} projects →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section-dark">
        <div className="wrap stats">
          <div className="stat">
            <span className="dot">{s.streams}</span>
            <div><h3>Production streams</h3><p>Software, websites, apps, studio and deep-tech share one engine.</p></div>
          </div>
          <div className="stat">
            <span className="dot">{s.projects}</span>
            <div><h3>Projects in the portfolio</h3><p>From concept to MVP, each with its brief, decisions and status.</p></div>
          </div>
          <div className="stat">
            <span className="dot" style={{ fontSize: "1.5rem" }}>100%</span>
            <div><h3>Focused on DACH</h3><p>German-first products for Germany, Austria and Switzerland.</p></div>
          </div>
        </div>
      </section>

      <div className="quote">
        <div className="wrap">
          <blockquote>&ldquo;Deterministic where it matters, agentic where it helps, human where it counts.&rdquo;</blockquote>
          <cite className="mono">ZAIN LABS engineering principle</cite>
        </div>
      </div>

      <section>
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow mono"><Asterisk size={14} /> FEATURED</span>
              <h2>Selected work.</h2>
            </div>
            <p>
              Every project lives in one content source and appears here, in the public API and in the ZAIN LABS app. <Link href="/projects">See all {s.projects} projects →</Link>
            </p>
          </div>
          <div className="pgrid">
            {featuredProjects().map((p, i) => (
              <ProjectCard key={p.slug} project={p} index={i} />
            ))}
            {featuredProjects().length % 3 !== 0 && (
              <Link href="/projects" className="pcard pcard-more" style={{ gridColumn: `span ${3 - (featuredProjects().length % 3)}` }}>
                <span className="mono">PORTFOLIO</span>
                <h3>See all {s.projects} projects across five streams</h3>
                <span className="arrow" aria-hidden="true">→</span>
              </Link>
            )}
          </div>
        </div>
      </section>

      <section id="process" className="section-dark">
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="eyebrow mono"><Asterisk size={14} /> PROCESS</span>
              <h2>The process of innovation.</h2>
            </div>
            <p>Research to launch without repeating work: every step leaves an artefact the next product can reuse.</p>
          </div>
          <div className="process">
            {site.process.map((step, i) => (
              <div className="step" key={step.title}>
                <span className="num">{String(i + 1).padStart(2, "0")}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta">
        <div className="cta-visual">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/hero-3d.jpg" alt="" />
        </div>
        <div className="cta-copy">
          <span className="mono">LET&apos;S BUILD</span>
          <h2>Have an idea for the DACH market? Let&apos;s turn it into a product.</h2>
          <p>Software, website, app or a release: tell us what you need. We answer within two working days.</p>
          <Link href="/contact" className="btn">Start a project →</Link>
        </div>
      </section>
    </>
  );
}
