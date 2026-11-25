"""Command line: mahn-agent {seed,run,drafts,approve,pay,serve,eval}"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date

from sqlalchemy import select

from .config import get_settings
from .db import make_engine, make_sessionmaker
from .money import fmt_eur


def _service(settings, with_llm: bool = True):
    from .agent import drafter
    from .connectors import get_connector
    from .mailer import get_mailer
    from .service import DunningService
    session = make_sessionmaker(make_engine(settings.database_url))()
    client = drafter.make_client(settings.llm) if with_llm else None
    return DunningService(session, settings, connector=get_connector(settings), mailer=get_mailer(settings),
                          llm_client=client)


def cmd_seed(args, settings) -> int:
    from . import seed
    data = seed.write(settings.demo_erp_file)
    if args.reset and settings.database_url.startswith("sqlite:///"):
        from pathlib import Path
        Path(settings.database_url.removeprefix("sqlite:///")).unlink(missing_ok=True)
    print(f"Demo-ERP geschrieben: {settings.demo_erp_file} ({len(data['customers'])} Kunden, "
          f"{len(data['invoices'])} Rechnungen, {len(data['payments'])} Bankzahlungen)")
    return 0


def cmd_run(args, settings) -> int:
    svc = _service(settings, with_llm=not args.no_llm)
    print(f"LLM: {'Claude ' + settings.model if svc.client else 'aus (Vorlagen)'}")
    report = svc.run(today=args.today, actor="cli")
    print(json.dumps(report.as_dict(), indent=2, ensure_ascii=False))
    return 0


def cmd_drafts(args, settings) -> int:
    from .models import ReminderDraft
    svc = _service(settings, with_llm=False)
    for d in svc.s.scalars(select(ReminderDraft).where(ReminderDraft.status == args.status)):
        inv = d.case.invoice
        print(f"#{d.id:<4} L{d.level} {inv.number} {inv.customer.name:<32} {fmt_eur(d.total_cents):>14}  {d.generated_by}")
        if args.show:
            print(f"\n  Betreff: {d.subject}\n\n" + "\n".join("  " + line for line in d.body.splitlines()) + "\n")
    return 0


def cmd_approve(args, settings) -> int:
    from .models import ReminderDraft
    svc = _service(settings, with_llm=False)
    ids = ([d.id for d in svc.s.scalars(select(ReminderDraft).where(ReminderDraft.status == "pending"))]
           if args.all else [args.id])
    failed = 0
    for draft_id in ids:
        try:
            d = svc.approve_and_send(draft_id, args.approver, today=args.today)
            print(f"Versendet: {d.subject}")
        except (LookupError, ValueError) as e:
            failed += 1
            print(f"#{draft_id}: {e}", file=sys.stderr)
    return 1 if failed else 0


def cmd_pay(args, settings) -> int:
    """Demo only: simulate a bank payment for an invoice number."""
    from .connectors.demo import DemoConnector
    conn = DemoConnector(settings.demo_erp_file)
    inv = next((i for i in conn.open_invoices() if i.number == args.invoice), None)
    if inv is None:
        print("Rechnung nicht offen/gefunden", file=sys.stderr)
        return 1
    amount = args.amount_cents or (inv.amount_total_cents - inv.paid_cents)
    conn.add_payment({"external_id": f"SIM-{args.invoice}-{amount}", "booking_date": date.today().isoformat(),
                      "amount_cents": amount, "payer_name": None, "reference": f"RE {args.invoice}",
                      "customer_erp_id": None})
    print(f"Zahlung über {fmt_eur(amount)} für {args.invoice} im Bank-Feed. Nächster Mahnlauf ordnet sie zu.")
    return 0


def cmd_serve(args, settings) -> int:
    import uvicorn
    from .api import create_app
    uvicorn.run(create_app(settings), host=args.host, port=args.port)
    return 0


def cmd_eval(args, settings) -> int:
    from . import evals
    result = evals.run(settings, limit=args.limit)
    for r in result["rows"]:
        print(f"{'PASS' if r['ok'] else 'FAIL'}  {r['case']:<20} {r['by']:<28} attempts={r['attempts']} "
              f"{r['seconds']}s {' '.join(r['errors'])}")
    print(f"\n{result['mode']}: {result['passed']}/{result['cases']} passed ({result['pass_rate']:.0%})")
    return 0 if result["passed"] == result["cases"] else 1


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="mahn-agent", description="Agentic dunning for DACH receivables")
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("seed", help="write demo ERP data")
    s.add_argument("--reset", action="store_true", help="also delete the local SQLite database")
    s.set_defaults(f=cmd_seed)
    r = sub.add_parser("run", help="sync ERP + payments, apply stop logic, create drafts")
    r.add_argument("--no-llm", action="store_true")
    r.add_argument("--today", type=date.fromisoformat, help="simulate another date (demo), YYYY-MM-DD")
    r.set_defaults(f=cmd_run)
    d = sub.add_parser("drafts", help="list drafts")
    d.add_argument("--status", default="pending")
    d.add_argument("--show", action="store_true")
    d.set_defaults(f=cmd_drafts)
    a = sub.add_parser("approve", help="approve and send a draft")
    a.add_argument("id", type=int, nargs="?", default=0)
    a.add_argument("--approver", required=True)
    a.add_argument("--today", type=date.fromisoformat, help="simulate another date (demo)")
    a.add_argument("--all", action="store_true", help="approve all pending drafts")
    a.set_defaults(f=cmd_approve)
    y = sub.add_parser("pay", help="demo: simulate an incoming bank payment")
    y.add_argument("invoice")
    y.add_argument("--amount-cents", type=int)
    y.set_defaults(f=cmd_pay)
    v = sub.add_parser("serve", help="start web UI + API")
    v.add_argument("--host", default="127.0.0.1")
    v.add_argument("--port", type=int, default=8000)
    v.set_defaults(f=cmd_serve)
    e = sub.add_parser("eval", help="run the drafting eval")
    e.add_argument("--limit", type=int)
    e.set_defaults(f=cmd_eval)
    args = p.parse_args(argv)
    return args.f(args, get_settings())


if __name__ == "__main__":
    sys.exit(main())
