import type { Metadata } from "next";
import { site } from "@zainlabs/content";
import { ContactForm } from "@/components/ContactForm";

export const metadata: Metadata = { title: "Contact", description: "Start a project with ZAIN LABS." };

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { project } = await searchParams;
  return (
    <>
      <div className="page-head">
        <div className="wrap">
          <div className="crumbs">Contact</div>
          <h1>Start a project.</h1>
          <p>Tell us what you want to build for the DACH market. Or write to {site.email}.</p>
        </div>
      </div>
      <section><div className="wrap"><ContactForm project={project} /></div></section>
    </>
  );
}
