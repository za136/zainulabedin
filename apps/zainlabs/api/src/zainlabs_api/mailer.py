from __future__ import annotations

import smtplib
from datetime import datetime
from email.message import EmailMessage
from pathlib import Path


def message(sender: str, to: str, subject: str, body: str) -> EmailMessage:
    m = EmailMessage()
    m["From"], m["To"], m["Subject"] = sender, to, subject
    m.set_content(body)
    return m


class OutboxMailer:
    """Writes .eml files instead of sending. Default for development and tests."""

    def __init__(self, directory: Path):
        self.dir = Path(directory)

    def send(self, msg: EmailMessage) -> str:
        self.dir.mkdir(parents=True, exist_ok=True)
        path = self.dir / f"{datetime.now():%Y%m%d-%H%M%S-%f}.eml"
        path.write_bytes(bytes(msg))
        return str(path)


class SmtpMailer:
    def __init__(self, s):
        self.s = s

    def send(self, msg: EmailMessage) -> str:
        with smtplib.SMTP(self.s.smtp_host, self.s.smtp_port, timeout=20) as smtp:
            if self.s.smtp_starttls:
                smtp.starttls()
            if self.s.smtp_user:
                smtp.login(self.s.smtp_user, self.s.smtp_password)
            smtp.send_message(msg)
        return "smtp"


def get_mailer(settings):
    return SmtpMailer(settings) if settings.mail_backend == "smtp" else OutboxMailer(settings.outbox_dir)
