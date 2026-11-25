import type { Metadata } from "next";

export const metadata: Metadata = { title: "Datenschutz / Privacy", robots: { index: false } };

// Starting point only, not legal advice. Have it reviewed before publishing.
export default function Datenschutz() {
  return (
    <section><div className="wrap legal">
      <h1>Datenschutz / Privacy notice</h1>
      <p>This notice explains which personal data this website and the ZAIN LABS app process (Art. 13 GDPR).</p>
      <h2>Controller</h2>
      <p>See <a href="/impressum">Impressum</a>.</p>
      <h2>Hosting and server logs</h2>
      <p>When you visit the site, the server processes technical data (IP address, time, requested page, browser) to deliver the site and keep it secure (Art. 6(1)(f) GDPR). <span className="todo">Name your hosting provider and log retention period.</span></p>
      <h2>Contact form and app contact</h2>
      <p>If you contact us, we store your name, email, company and message to answer your request, based on your consent (Art. 6(1)(a) GDPR) and pre-contractual measures (Art. 6(1)(b)). Data is deleted when it is no longer needed, at the latest after <span className="todo">retention period</span>.</p>
      <h2>Cookies and tracking</h2>
      <p>This site sets no tracking cookies and uses no third-party analytics. Fonts are served locally; no requests go to Google Fonts.</p>
      <h2>Your rights</h2>
      <p>You have the right to access, rectification, erasure, restriction, data portability and objection, and to withdraw consent at any time. You can complain to a data protection supervisory authority.</p>
    </div></section>
  );
}
