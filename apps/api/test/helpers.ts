import type { FastifyInstance, InjectOptions } from 'fastify';
import { fileURLToPath } from 'node:url';
import { buildApp } from '../src/app.js';
import { bootstrap } from '../src/bootstrap.js';
import type { AppContext } from '../src/context.js';
import { MemoryMailer } from '../src/modules/notifications/mailer.js';

export const STORE_DIR = fileURLToPath(new URL('../../../stores/wissenswerk', import.meta.url));
export const ADMIN = { email: 'admin@test.example', password: 'admin-password-123' };

export interface TestApp {
  app: FastifyInstance;
  ctx: AppContext;
  mailer: MemoryMailer;
  clock: { offsetMs: number };
  close(): Promise<void>;
  call<T = any>(method: InjectOptions['method'], url: string, body?: unknown, headers?: Record<string, string>): Promise<{ status: number; body: T; headers: Record<string, unknown>; raw: string }>;
}

export async function createTestApp(): Promise<TestApp> {
  const mailer = new MemoryMailer();
  const clock = { offsetMs: 0 };
  const { ctx, handle } = await bootstrap({
    env: { NODE_ENV: 'test', DATABASE_URL: 'pglite://memory', STORE_DIR, LOG_LEVEL: 'silent', ADMIN_EMAIL: ADMIN.email, ADMIN_PASSWORD: ADMIN.password, STORAGE_DIR: '/nonexistent-storage' },
    mailer,
    now: () => new Date(Date.now() + clock.offsetMs),
  });
  const app = await buildApp(ctx);
  await app.ready();
  return {
    app,
    ctx,
    mailer,
    clock,
    async close() {
      await app.close();
      await handle.close();
    },
    async call(method, url, body, headers = {}) {
      const res = await app.inject({ method, url, payload: body as InjectOptions['payload'], headers });
      let parsed: unknown = res.body;
      try {
        parsed = JSON.parse(res.body);
      } catch {
        /* html / text */
      }
      return { status: res.statusCode, body: parsed as any, headers: res.headers, raw: res.body };
    },
  };
}

export const address = (country = 'DE') => ({ firstName: 'Erika', lastName: 'Musterfrau', street: 'Hauptstraße 5', zip: country === 'AT' ? '1010' : '80331', city: country === 'AT' ? 'Wien' : 'München', country });
