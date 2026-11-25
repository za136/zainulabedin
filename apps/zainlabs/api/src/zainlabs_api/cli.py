"""zainlabs-api {serve,purge,openapi,new-admin-token}"""
from __future__ import annotations

import argparse
import json
import secrets
import sys


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="zainlabs-api")
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("serve")
    s.add_argument("--host", default="127.0.0.1")
    s.add_argument("--port", type=int, default=8100)
    s.add_argument("--reload", action="store_true")
    sub.add_parser("purge", help="apply the retention policy")
    sub.add_parser("openapi", help="print the OpenAPI contract (commit it as openapi.json)")
    sub.add_parser("new-admin-token", help="print a random admin token for ZL_ADMIN_TOKEN")
    args = p.parse_args(argv)

    if args.cmd == "serve":
        import uvicorn
        uvicorn.run("zainlabs_api.main:create_app", factory=True, host=args.host, port=args.port, reload=args.reload)
    elif args.cmd == "purge":
        from .config import Settings
        from .db import make_sessionmaker
        from .services import purge
        settings = Settings()
        with make_sessionmaker(settings.database_url)() as s:
            print(dict(zip(("deleted_leads", "deleted_pending_subscribers"), purge(s, settings.retention_days))))
    elif args.cmd == "openapi":
        from .main import create_app
        from .config import Settings
        print(json.dumps(create_app(Settings(database_url="sqlite:///:memory:")).openapi(), indent=2, sort_keys=True))
    elif args.cmd == "new-admin-token":
        print(secrets.token_urlsafe(32))
    return 0


if __name__ == "__main__":
    sys.exit(main())
