import type { Metadata } from "next";

export const metadata: Metadata = { title: "Impressum", robots: { index: false } };

// § 5 DDG (Germany) requires these details. Fill in the real data before publishing.
export default function Impressum() {
  return (
    <section><div className="wrap legal">
      <h1>Impressum</h1>
      <p>Angaben gemäß § 5 DDG</p>
      <h2>Anbieter</h2>
      <p><span className="todo">Full name / company name</span><br /><span className="todo">Street and number</span><br /><span className="todo">Postcode, city, country</span></p>
      <h2>Kontakt</h2>
      <p>E-Mail: <span className="todo">contact email</span><br />Telefon: <span className="todo">phone (optional)</span></p>
      <h2>Umsatzsteuer-ID</h2>
      <p><span className="todo">USt-IdNr. gemäß § 27a UStG, if available</span></p>
      <h2>Verantwortlich für den Inhalt</h2>
      <p><span className="todo">Name and address</span></p>
    </div></section>
  );
}
