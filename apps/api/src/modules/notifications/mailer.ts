export interface Mail {
  to: string;
  subject: string;
  text: string;
}

/** Mailer adapter. Swap ConsoleMailer for SMTP/Postmark/SES in production. */
export interface Mailer {
  send(mail: Mail): Promise<void>;
}

export class ConsoleMailer implements Mailer {
  constructor(private log: (msg: string) => void = console.log) {}
  async send(mail: Mail) {
    this.log(`📧 to=${mail.to} subject="${mail.subject}"\n${mail.text}\n`);
  }
}

export class MemoryMailer implements Mailer {
  sent: Mail[] = [];
  async send(mail: Mail) {
    this.sent.push(mail);
  }
}
