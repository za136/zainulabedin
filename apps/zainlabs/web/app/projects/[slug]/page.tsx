import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProject, getStream, projects } from "@zainlabs/content";
import { statusClass } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = getProject((await params).slug);
  return p ? { title: p.title, description: p.summary } : {};
}

export default async function ProjectPage({ params }: Props) {
  const p = getProject((await params).slug);
  if (!p) notFound();
  const stream = getStream(p.stream)!;
  return (
    <>
      <div className="page-head">
        <div className="wrap">
          <div className="crumbs">
            <Link href="/projects">Projects</Link> / <Link href={`/streams/${stream.slug}`}>{stream.name}</Link>
            {p.code ? ` / ${p.code}` : ""}
          </div>
          <h1>{p.title}</h1>
          <p>{p.summary}</p>
        </div>
      </div>
      <section>
        <div className="wrap detail">
          <div className="body">{p.description.map((d) => <p key={d}>{d}</p>)}</div>
          <aside className="aside">
            <div><h4>Status</h4><span className={`status ${statusClass(p.status)}`}>{p.status}</span> <span className="muted">· {p.year}</span></div>
            <div><h4>Highlights</h4><ul className="ticks">{p.highlights.map((h) => <li key={h}>{h}</li>)}</ul></div>
            <div><h4>Stack</h4><div className="tags">{p.stack.map((t) => <span className="tag" key={t}>{t}</span>)}</div></div>
            {p.links.length > 0 && (
              <div><h4>Links</h4>{p.links.map((l) => <a key={l.url} href={l.url} className="btn btn-small" target="_blank" rel="noreferrer">{l.label} ↗</a>)}</div>
            )}
            <Link href={`/contact?project=${p.slug}`} className="btn btn-ghost btn-small">Ask about this project</Link>
          </aside>
        </div>
      </section>
    </>
  );
}
