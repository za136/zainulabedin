import type { Metadata } from "next";
import { NewsletterForm } from "@/components/NewsletterForm";

export const metadata: Metadata = { title: "Newsletter", description: "New projects and releases from ZAIN LABS." };

// The API redirects confirmation and unsubscribe links here with ?status=confirmed|unsubscribed|invalid.
const MESSAGES: Record<string, { title: string; text: string }> = {
  confirmed: { title: "You're subscribed.", text: "Thank you for confirming. You can unsubscribe at any time with the link in every email." },
  unsubscribed: { title: "You're unsubscribed.", text: "You will not receive further newsletters. You can subscribe again below." },
  invalid: { title: "This link is no longer valid.", text: "Confirmation links expire after 7 days. Please subscribe again below." },
};

export default async function NewsletterPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const msg = status ? MESSAGES[status] : undefined;
  return (
    <>
      <div className="page-head">
        <div className="wrap">
          <div className="crumbs">Newsletter</div>
          <h1>{msg?.title ?? "Stay in the loop."}</h1>
          <p>{msg?.text ?? "New projects, releases and studio notes from ZAIN LABS. A few emails a year, no tracking."}</p>
        </div>
      </div>
      <section><div className="wrap"><NewsletterForm /></div></section>
    </>
  );
}
