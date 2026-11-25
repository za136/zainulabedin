"""Outgoing mail. Default backend writes .eml files to an outbox and sends nothing."""
from __future__ import annotations

import smtplib
from datetime import datetime
from email.message import EmailMessage
from pathlib import Path


def build_message(*, sender: str, to: str, subject: str, body: str) -> EmailMessage:
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = sender, to, subject
    msg.set_content(body)
    return msg


class OutboxMailer:
    def __init__(self, directory: Path):
        self.dir = Path(directory)

    def send(self, msg: EmailMessage, tag: str) -> str:
        self.dir.mkdir(parents=True, exist_ok=True)
        path = self.dir / f"{datetime.now():%Y%m%d-%H%M%S-%f}_{tag}.eml"
        path.write_bytes(bytes(msg))
        return str(path)


class SmtpMailer:
    def __init__(self, host: str, port: int, user: str = "", password: str = "", starttls: bool = False):
        self.host, self.port, self.user, self.password, self.starttls = host, port, user, password, starttls

    def send(self, msg: EmailMessage, tag: str) -> str:
        with smtplib.SMTP(self.host, self.port, timeout=30) as s:
            if self.starttls:
                s.starttls()
            if self.user:
                s.login(self.user, self.password)
            s.send_message(msg)
        return f"smtp://{self.host}:{self.port}"


def get_mailer(settings):
    if settings.mail_backend == "smtp":
        return SmtpMailer(settings.smtp_host, settings.smtp_port, settings.smtp_user, settings.smtp_password,
                          settings.smtp_starttls)
    return OutboxMailer(settings.outbox_dir)
