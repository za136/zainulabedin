import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getStream, projectsIn, streams } from "@zainlabs/content";
import { ProjectCard } from "@/components/ProjectCard";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return streams.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = getStream((await params).slug);
  return s ? { title: `${s.name}: ${s.tagline}`, description: s.description } : {};
}

export default async function StreamPage({ params }: Props) {
  const stream = getStream((await params).slug);
  if (!stream) notFound();
  const items = projectsIn(stream.slug);
  return (
    <>
      <div className="page-head">
        <div className="wrap">
          <div className="crumbs"><Link href="/#streams">Streams</Link> / {stream.code}</div>
          <h1>{stream.name}</h1>
          <p>{stream.description}</p>
        </div>
      </div>
      <section>
        <div className="wrap">
          <div className="section-head">
            <div><h2>{stream.tagline}</h2></div>
            <ul className="ticks">{stream.capabilities.map((c) => <li key={c}>{c}</li>)}</ul>
          </div>
          <div className="pgrid">{items.map((p, i) => <ProjectCard key={p.slug} project={p} index={i} />)}</div>
        </div>
      </section>
    </>
  );
}
