import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page-head" style={{ minHeight: "60vh" }}>
      <div className="wrap">
        <div className="crumbs">404</div>
        <h1>Not found.</h1>
        <p><Link href="/">Back to the start page →</Link></p>
      </div>
    </div>
  );
}
