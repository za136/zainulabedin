import { and, eq, gt } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { id } from '@factory/core';
import { schema as s } from '@factory/db';
import type { AppContext } from '../context.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { randomToken, sha256 } from '../lib/security.js';

export const SESSION_COOKIE = 'sf_session';
const SESSION_DAYS = 30;

export interface AuthUser {
  id: string;
  email: string;
  role: 'customer' | 'admin' | 'seller';
  firstName: string | null;
  lastName: string | null;
  locale: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser | null;
  }
}

export async function createSession(ctx: AppContext, customerId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await ctx.db.insert(s.sessions).values({ id: id('ses'), tokenHash: sha256(token), customerId, expiresAt });
  return { token, expiresAt };
}

export async function destroySession(ctx: AppContext, token: string) {
  await ctx.db.delete(s.sessions).where(eq(s.sessions.tokenHash, sha256(token)));
}

export function sessionToken(req: FastifyRequest): string | undefined {
  const h = req.headers.authorization;
  if (h?.startsWith('Bearer ')) return h.slice(7);
  return req.cookies?.[SESSION_COOKIE];
}

/** Resolves `request.user` from a Bearer token or the session cookie (opaque, revocable tokens). */
export const authPlugin = fp(async (app: FastifyInstance, opts: { ctx: AppContext }) => {
  app.decorateRequest('user', null);
  app.addHook('onRequest', async (req) => {
    const token = sessionToken(req);
    if (!token) return;
    const rows = await opts.ctx.db
      .select({ c: s.customers })
      .from(s.sessions)
      .innerJoin(s.customers, eq(s.customers.id, s.sessions.customerId))
      .where(and(eq(s.sessions.tokenHash, sha256(token)), gt(s.sessions.expiresAt, new Date())))
      .limit(1);
    const c = rows[0]?.c;
    if (c) req.user = { id: c.id, email: c.email, role: c.role, firstName: c.firstName, lastName: c.lastName, locale: c.locale };
  });
});

export function requireUser(req: FastifyRequest): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}

export function requireAdmin(req: FastifyRequest): AuthUser {
  const u = requireUser(req);
  if (u.role !== 'admin') throw forbidden();
  return u;
}
