import Link from "next/link";
import { Asterisk } from "./Asterisk";

const NAV = [
  ["Streams", "/#streams"],
  ["Projects", "/projects"],
  ["Process", "/#process"],
  ["Contact", "/contact"],
];

export function Header() {
  return (
    <header className="site-header">
      <Link href="/" className="logo" aria-label="ZAIN LABS home">
        <Asterisk size={22} />
        <span>ZAIN LABS</span>
      </Link>
      <nav aria-label="Main">
        {NAV.map(([label, href]) => (
          <Link key={href} href={href}>
            {label}
          </Link>
        ))}
      </nav>
      <Link href="/contact" className="btn btn-small">
        Start a project
      </Link>
    </header>
  );
}
