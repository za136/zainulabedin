import Link from "next/link";
import { site, streams } from "@zainlabs/content";
import { Asterisk } from "./Asterisk";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div>
          <div className="logo">
            <Asterisk size={20} />
            <span>ZAIN LABS</span>
          </div>
          <p className="muted">{site.location}</p>
        </div>
        <div>
          <h4>Streams</h4>
          {streams.map((s) => (
            <Link key={s.slug} href={`/streams/${s.slug}`}>
              {s.name}
            </Link>
          ))}
        </div>
        <div>
          <h4>Studio</h4>
          <Link href="/projects">All projects</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/newsletter">Newsletter</Link>
          <a href="/api/content">Public API</a>
        </div>
        <div>
          <h4>Legal</h4>
          <Link href="/impressum">Impressum</Link>
          <Link href="/datenschutz">Datenschutz / Privacy</Link>
        </div>
      </div>
      <p className="mono muted small">© {new Date().getFullYear()} ZAIN LABS · Built in DACH</p>
    </footer>
  );
}
