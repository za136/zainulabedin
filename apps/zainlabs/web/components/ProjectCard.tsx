import Link from "next/link";
import { getStream, type Project } from "@zainlabs/content";
import { statusClass } from "@/lib/site";

export function ProjectCard({ project, index }: { project: Project; index?: number }) {
  const stream = getStream(project.stream);
  return (
    <Link href={`/projects/${project.slug}`} className="pcard">
      <div className="pcard-top">
        <span className="mono muted">
          {index !== undefined ? String(index + 1).padStart(2, "0") : stream?.code} · {stream?.name}
        </span>
        <span className={`status ${statusClass(project.status)}`}>{project.status}</span>
      </div>
      <h3>{project.title}</h3>
      <p>{project.summary}</p>
      <span className="arrow" aria-hidden="true">→</span>
    </Link>
  );
}
