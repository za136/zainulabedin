import Link from "next/link";
import type { Metadata } from "next";
import { getStream, projects, streams } from "@zainlabs/content";
import { ProjectCard } from "@/components/ProjectCard";

export const metadata: Metadata = { title: "Projects", description: "All ZAIN LABS projects across software, websites, apps, studio and deep-tech." };

type Props = { searchParams: Promise<{ stream?: string }> };

export default async function ProjectsPage({ searchParams }: Props) {
  const active = (await searchParams).stream;
  const stream = active ? getStream(active) : undefined;
  const list = stream ? projects.filter((p) => p.stream === stream.slug) : projects;
  return (
    <>
      <div className="page-head">
        <div className="wrap">
          <div className="crumbs">Portfolio</div>
          <h1>Projects</h1>
          <p>Every product, site, app, release and study, with its honest status.</p>
        </div>
      </div>
      <section>
        <div className="wrap">
          <nav className="filters" aria-label="Filter by stream">
            <Link href="/projects" className={`chip ${!stream ? "active" : ""}`}>All ({projects.length})</Link>
            {streams.map((s) => (
              <Link key={s.slug} href={`/projects?stream=${s.slug}`} className={`chip ${stream?.slug === s.slug ? "active" : ""}`}>
                {s.name}
              </Link>
            ))}
          </nav>
          <div className="pgrid">{list.map((p, i) => <ProjectCard key={p.slug} project={p} index={i} />)}</div>
        </div>
      </section>
    </>
  );
}
