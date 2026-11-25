import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { loadPage, renderTemplate } from '@factory/config';
import { consentRequirements, id, ORDER_BUTTON_LABEL, PRODUCT_KIND_DEFINITIONS, productKindSchema, t, type Locale } from '@factory/core';
import { schema as s } from '@factory/db';
import { resolveMarket, type AppContext } from '../context.js';
import { AppError, badRequest, conflict, notFound } from '../lib/errors.js';
import { hashPassword, verifyPassword } from '../lib/security.js';
import { createSession, destroySession, requireUser, SESSION_COOKIE, sessionToken } from '../plugins/auth.js';
import { cancelSubscription, claimGuestOrder, completeLesson, getDiagram, library, listSubscriptions, resolveDownload } from './account/library.service.js';
import { addItem, cartView, createCart, updateCart, updateItem } from './cart/cart.service.js';
import { getProduct, listCategories, listProducts, upcomingSlots } from './catalog/catalog.service.js';
import { checkoutSchema, placeOrder } from './checkout/checkout.service.js';
import { emit } from './notifications/outbox.js';
import { authorizeOrder, invoiceHtml, listCustomerOrders, markOrderPaid, markPaymentFailed, orderView } from './orders/orders.service.js';
import { listReviews, createReview } from './reviews/reviews.service.js';

const marketQuery = z.object({ locale: z.string().optional(), country: z.string().optional(), currency: z.string().optional() });

export function market(ctx: AppContext, req: FastifyRequest) {
  const q = (req.query ?? {}) as Record<string, string | undefined>;
  return resolveMarket(ctx, {
    locale: q.locale ?? (req.headers['x-locale'] as string | undefined),
    country: q.country ?? (req.headers['x-country'] as string | undefined),
    currency: q.currency ?? (req.headers['x-currency'] as string | undefined),
    acceptLanguage: req.headers['accept-language'],
  });
}

function setSessionCookie(reply: FastifyReply, ctx: AppContext, token: string, expiresAt: Date) {
  reply.setCookie(SESSION_COOKIE, token, { path: '/', httpOnly: true, sameSite: 'lax', secure: ctx.env.NODE_ENV === 'production', expires: expiresAt });
}

export async function registerRoutes(app: FastifyInstance, ctx: AppContext) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  /* --------------------------------- store --------------------------------- */
  r.get('/v1/health', { schema: { tags: ['meta'] } }, async () => {
    await ctx.db.execute(sql`select 1`);
    return { ok: true, store: ctx.store.config.id, time: ctx.now().toISOString() };
  });

  r.get('/v1/store', { schema: { tags: ['store'], summary: 'Public store configuration (theme, locales, markets, legal, home layout)', querystring: marketQuery } }, async (req) => {
    const cfg = ctx.store.config;
    const m = market(ctx, req);
    return {
      id: cfg.id,
      name: cfg.name,
      tagline: cfg.tagline,
      url: cfg.url,
      locales: cfg.locales,
      markets: cfg.markets,
      market: m,
      legal: cfg.legal,
      theme: cfg.theme,
      home: cfg.home,
      seo: cfg.seo,
      features: cfg.features,
      catalog: { enabledKinds: cfg.catalog.enabledKinds },
      kinds: Object.fromEntries(cfg.catalog.enabledKinds.map((k) => [k, PRODUCT_KIND_DEFINITIONS[k]])),
      shipping: cfg.shipping,
      tax: { originCountry: cfg.tax.originCountry, smallBusiness: cfg.tax.smallBusiness },
      payments: ctx.payments.list().map((p) => ({ id: p.id, label: p.label, methods: p.methods, ...('bank' in p ? { bank: (p as { bank: unknown }).bank } : {}) })),
      orderButtonLabel: ORDER_BUTTON_LABEL,
      diagrams: [...ctx.store.diagrams.values()].map((d) => ({ id: d.id, title: d.title })),
    };
  });

  r.get('/v1/content/:key', { schema: { tags: ['store'], summary: 'Legal & content pages as Markdown (Impressum, AGB, Widerruf, Datenschutz, Versand)', params: z.object({ key: z.string().regex(/^[a-z0-9-]+$/) }), querystring: marketQuery } }, async (req) => {
    const m = market(ctx, req);
    const page = loadPage(ctx.store.dir, req.params.key, m.locale, ctx.store.config.locales.default);
    if (!page) throw notFound('page');
    const cfg = ctx.store.config;
    const legal = { ...cfg.legal, disputeResolution: t(cfg.legal.disputeResolution, page.locale) };
    return { key: req.params.key, locale: page.locale, markdown: renderTemplate(page.markdown, { store: { name: cfg.name, url: cfg.url }, legal }) };
  });

  /* -------------------------------- catalog -------------------------------- */
  r.get(
    '/v1/catalog/products',
    {
      schema: {
        tags: ['catalog'],
        summary: 'List & search products (German full-text search, facets)',
        querystring: marketQuery.extend({
          q: z.string().max(200).optional(),
          kind: productKindSchema.optional(),
          category: z.string().optional(),
          featured: z.stringbool().optional(),
          inStock: z.stringbool().optional(),
          minPrice: z.coerce.number().int().optional(),
          maxPrice: z.coerce.number().int().optional(),
          sort: z.enum(['relevance', 'newest', 'price_asc', 'price_desc', 'title']).optional(),
          page: z.coerce.number().int().positive().optional(),
          pageSize: z.coerce.number().int().positive().max(48).optional(),
          slugs: z.string().optional().describe('comma separated'),
        }),
      },
    },
    async (req) => listProducts(ctx, market(ctx, req), { ...req.query, slugs: req.query.slugs?.split(',').filter(Boolean) }),
  );

  r.get('/v1/catalog/products/:slug', { schema: { tags: ['catalog'], params: z.object({ slug: z.string() }), querystring: marketQuery } }, async (req) => getProduct(ctx, market(ctx, req), req.params.slug, { includeDrafts: req.user?.role === 'admin' }));
  r.get('/v1/catalog/products/:slug/slots', { schema: { tags: ['catalog'], summary: 'Bookable appointments of a service', params: z.object({ slug: z.string() }) } }, async (req) => ({ slots: await upcomingSlots(ctx, req.params.slug) }));
  r.get('/v1/catalog/categories', { schema: { tags: ['catalog'], querystring: marketQuery } }, async (req) => ({ categories: await listCategories(ctx, market(ctx, req)) }));

  r.get('/v1/catalog/products/:slug/reviews', { schema: { tags: ['reviews'], params: z.object({ slug: z.string() }) } }, async (req) => listReviews(ctx, req.params.slug));
  r.post(
    '/v1/catalog/products/:slug/reviews',
    { schema: { tags: ['reviews'], params: z.object({ slug: z.string() }), body: z.object({ rating: z.number().int().min(1).max(5), title: z.string().max(120).optional(), body: z.string().max(4000).optional(), locale: z.string().optional() }) } },
    async (req) => createReview(ctx, requireUser(req), req.params.slug, req.body),
  );

  r.get('/v1/diagrams/:id', { schema: { tags: ['catalog'], summary: '3D diagram scene (public preview or purchased)', params: z.object({ id: z.string() }) } }, async (req) => getDiagram(ctx, req.params.id, req.user?.id));

  /* ---------------------------------- cart --------------------------------- */
  r.post('/v1/carts', { schema: { tags: ['cart'], body: marketQuery.optional() } }, async (req, reply) => {
    const b = req.body ?? {};
    const m = resolveMarket(ctx, { ...b, acceptLanguage: req.headers['accept-language'] });
    const cart = await createCart(ctx, m, req.user?.id);
    reply.code(201);
    return cartView(ctx, cart.id);
  });
  r.get('/v1/carts/:id', { schema: { tags: ['cart'], params: z.object({ id: z.string() }) } }, async (req) => cartView(ctx, req.params.id));
  r.patch(
    '/v1/carts/:id',
    { schema: { tags: ['cart'], params: z.object({ id: z.string() }), body: z.object({ country: z.string().length(2).optional(), currency: z.string().optional(), locale: z.string().optional(), couponCode: z.string().nullable().optional(), shippingRateId: z.string().nullable().optional() }) } },
    async (req) => updateCart(ctx, req.params.id, req.body),
  );
  r.post(
    '/v1/carts/:id/items',
    { schema: { tags: ['cart'], params: z.object({ id: z.string() }), body: z.object({ variantId: z.string(), quantity: z.number().int().positive().max(99).default(1), slotId: z.string().optional() }) } },
    async (req) => addItem(ctx, req.params.id, req.body),
  );
  r.patch('/v1/carts/:id/items/:itemId', { schema: { tags: ['cart'], params: z.object({ id: z.string(), itemId: z.string() }), body: z.object({ quantity: z.number().int().min(0).max(99) }) } }, async (req) => updateItem(ctx, req.params.id, req.params.itemId, req.body.quantity));
  r.delete('/v1/carts/:id/items/:itemId', { schema: { tags: ['cart'], params: z.object({ id: z.string(), itemId: z.string() }) } }, async (req) => updateItem(ctx, req.params.id, req.params.itemId, 0));

  /* -------------------------------- checkout ------------------------------- */
  r.get('/v1/checkout/consents', { schema: { tags: ['checkout'], querystring: z.object({ kinds: z.string() }) } }, async (req) => consentRequirements(req.query.kinds.split(',').map((k) => productKindSchema.parse(k))));
  r.post('/v1/checkout', { schema: { tags: ['checkout'], summary: 'Place an order (legal consents, stock reservation, payment initiation)', body: checkoutSchema }, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const res = await placeOrder(ctx, req.body, { customerId: req.user?.id, ip: req.ip });
    // logged-in with new account? hand out a session
    if (!req.user && req.body.createAccountPassword) {
      const order = await ctx.db.query.orders.findFirst({ where: eq(s.orders.id, res.orderId) });
      if (order?.customerId) {
        const sess = await createSession(ctx, order.customerId);
        setSessionCookie(reply, ctx, sess.token, sess.expiresAt);
        reply.code(201);
        return { ...res, session: sess };
      }
    }
    reply.code(201);
    return res;
  });

  /* --------------------------------- orders -------------------------------- */
  r.get('/v1/orders/:id', { schema: { tags: ['orders'], params: z.object({ id: z.string() }), querystring: z.object({ token: z.string().optional() }) } }, async (req) => {
    await authorizeOrder(ctx, req.params.id, { customerId: req.user?.id, role: req.user?.role, token: req.query.token });
    return orderView(ctx, req.params.id);
  });
  r.get('/v1/orders/:id/invoice', { schema: { tags: ['orders'], summary: 'Printable invoice (HTML)', params: z.object({ id: z.string() }), querystring: z.object({ token: z.string().optional() }) } }, async (req, reply) => {
    await authorizeOrder(ctx, req.params.id, { customerId: req.user?.id, role: req.user?.role, token: req.query.token });
    reply.type('text/html; charset=utf-8');
    return invoiceHtml(ctx, req.params.id);
  });

  /* -------------------------------- payments ------------------------------- */
  r.post(
    '/v1/payments/mock/confirm',
    { schema: { tags: ['payments'], summary: 'DEV ONLY — simulate a payment provider callback', body: z.object({ orderId: z.string(), token: z.string(), outcome: z.enum(['success', 'failure']).default('success') }) } },
    async (req) => {
      if (!ctx.payments.get('mock')) throw notFound('provider');
      const order = await authorizeOrder(ctx, req.body.orderId, { token: req.body.token });
      if (order.paymentProvider !== 'mock') throw badRequest('wrong_provider');
      if (req.body.outcome === 'failure') {
        await markPaymentFailed(ctx, order.id);
        return orderView(ctx, order.id);
      }
      await markOrderPaid(ctx, order.id, { provider: 'mock', providerRef: order.paymentRef ?? undefined, amount: order.totals.total });
      return orderView(ctx, order.id);
    },
  );

  app.register(async (scoped) => {
    // Stripe needs the raw body for signature verification
    scoped.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => done(null, body));
    scoped.post('/v1/payments/stripe/webhook', { schema: { tags: ['payments'], hide: false } }, async (req) => {
      const provider = ctx.payments.get('stripe') as import('./payments/stripe.js').StripeProvider | undefined;
      if (!provider || !ctx.env.STRIPE_WEBHOOK_SECRET) throw notFound('provider');
      const stripe = await provider.stripe();
      let event;
      try {
        event = stripe.webhooks.constructEvent(req.body as Buffer, String(req.headers['stripe-signature']), ctx.env.STRIPE_WEBHOOK_SECRET);
      } catch {
        throw new AppError(400, 'invalid_signature');
      }
      if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
        const session = event.data.object;
        if (session.payment_status === 'paid' && session.metadata?.orderId) await markOrderPaid(ctx, session.metadata.orderId, { provider: 'stripe', providerRef: session.id, amount: session.amount_total ?? -1, raw: { id: event.id } });
      }
      if (event.type === 'checkout.session.async_payment_failed' && event.data.object.metadata?.orderId) await markPaymentFailed(ctx, event.data.object.metadata.orderId);
      return { received: true };
    });
  });

  /* ---------------------------------- auth --------------------------------- */
  const credentials = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200) });
  r.post(
    '/v1/auth/register',
    {
      schema: { tags: ['auth'], body: credentials.extend({ password: z.string().min(10).max(200), firstName: z.string().max(100).optional(), lastName: z.string().max(100).optional(), locale: z.string().optional(), marketingConsent: z.boolean().default(false), claim: z.object({ orderId: z.string(), token: z.string() }).optional() }) },
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const b = req.body;
      const exists = await ctx.db.query.customers.findFirst({ where: sql`lower(${s.customers.email}) = ${b.email}` });
      if (exists) throw conflict('email_taken', 'An account with this email already exists');
      const customerId = id('cus');
      const locale = ctx.store.config.locales.supported.includes(b.locale as Locale) ? b.locale! : ctx.store.config.locales.default;
      await ctx.db.insert(s.customers).values({ id: customerId, email: b.email, passwordHash: await hashPassword(b.password), firstName: b.firstName ?? null, lastName: b.lastName ?? null, locale, marketingConsent: b.marketingConsent });
      await emit(ctx.db, { type: 'customer.registered', payload: { customerId } });
      if (b.claim) {
        const order = await authorizeOrder(ctx, b.claim.orderId, { token: b.claim.token });
        if (order.email.toLowerCase() === b.email) await claimGuestOrder(ctx, customerId, order.id);
      }
      const sess = await createSession(ctx, customerId);
      setSessionCookie(reply, ctx, sess.token, sess.expiresAt);
      reply.code(201);
      return { token: sess.token, expiresAt: sess.expiresAt, customer: { id: customerId, email: b.email, firstName: b.firstName ?? null, lastName: b.lastName ?? null, role: 'customer', locale } };
    },
  );
  r.post('/v1/auth/login', { schema: { tags: ['auth'], body: credentials.extend({ claim: z.object({ orderId: z.string(), token: z.string() }).optional() }) }, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const c = await ctx.db.query.customers.findFirst({ where: sql`lower(${s.customers.email}) = ${req.body.email}` });
    // constant-ish time: always run a verify
    const ok = c?.passwordHash ? await verifyPassword(req.body.password, c.passwordHash) : (await hashPassword('timing-padding'), false);
    if (!c || !ok) throw new AppError(401, 'invalid_credentials', 'Email or password is incorrect');
    if (req.body.claim) {
      const order = await authorizeOrder(ctx, req.body.claim.orderId, { token: req.body.claim.token });
      if (order.email.toLowerCase() === c.email.toLowerCase()) await claimGuestOrder(ctx, c.id, order.id);
    }
    const sess = await createSession(ctx, c.id);
    setSessionCookie(reply, ctx, sess.token, sess.expiresAt);
    return { token: sess.token, expiresAt: sess.expiresAt, customer: { id: c.id, email: c.email, firstName: c.firstName, lastName: c.lastName, role: c.role, locale: c.locale } };
  });
  r.post('/v1/auth/logout', { schema: { tags: ['auth'] } }, async (req, reply) => {
    const token = sessionToken(req);
    if (token) await destroySession(ctx, token);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  /* --------------------------------- account ------------------------------- */
  r.get('/v1/me', { schema: { tags: ['account'] } }, async (req) => {
    const u = requireUser(req);
    return { customer: u };
  });
  r.patch('/v1/me', { schema: { tags: ['account'], body: z.object({ firstName: z.string().max(100).optional(), lastName: z.string().max(100).optional(), locale: z.string().optional(), marketingConsent: z.boolean().optional() }) } }, async (req) => {
    const u = requireUser(req);
    const [c] = await ctx.db.update(s.customers).set({ ...req.body, updatedAt: new Date() }).where(eq(s.customers.id, u.id)).returning();
    return { customer: { id: c!.id, email: c!.email, firstName: c!.firstName, lastName: c!.lastName, role: c!.role, locale: c!.locale } };
  });
  r.delete('/v1/me', { schema: { tags: ['account'], summary: 'Delete account (GDPR Art. 17). Orders/invoices are retained as required by § 147 AO.' } }, async (req, reply) => {
    const u = requireUser(req);
    await ctx.db.transaction(async (tx) => {
      await tx.update(s.orders).set({ customerId: null }).where(eq(s.orders.customerId, u.id));
      await tx.delete(s.customers).where(eq(s.customers.id, u.id));
    });
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });
  r.get('/v1/me/orders', { schema: { tags: ['account'] } }, async (req) => ({ orders: await listCustomerOrders(ctx, requireUser(req).id) }));
  r.get('/v1/me/library', { schema: { tags: ['account'], summary: 'Everything the customer owns: e-books, 3D books, courses, downloads, licence keys, subscriptions', querystring: marketQuery } }, async (req) => library(ctx, requireUser(req).id, market(ctx, req)));
  r.post('/v1/me/library/:entitlementId/lessons/:lessonId/complete', { schema: { tags: ['account'], params: z.object({ entitlementId: z.string(), lessonId: z.string() }) } }, async (req) => completeLesson(ctx, requireUser(req).id, req.params.entitlementId, req.params.lessonId));
  r.get('/v1/me/subscriptions', { schema: { tags: ['account'] } }, async (req) => ({ subscriptions: await listSubscriptions(ctx, requireUser(req).id) }));
  r.post('/v1/me/subscriptions/:id/cancel', { schema: { tags: ['account'], summary: '§ 312k BGB cancellation button', params: z.object({ id: z.string() }) } }, async (req) => cancelSubscription(ctx, requireUser(req).id, req.params.id));

  r.get('/v1/downloads/:token', { schema: { tags: ['account'], params: z.object({ token: z.string() }) } }, async (req, reply) => {
    const file = await resolveDownload(ctx, req.params.token);
    reply.header('content-disposition', `attachment; filename="${file.name.replace(/"/g, '')}"`);
    reply.header('cache-control', 'private, no-store');
    if ('stream' in file) return reply.type('application/octet-stream').send(file.stream);
    return reply.type('text/plain; charset=utf-8').send(file.body);
  });

  if (!ctx.payments.list().length) app.log.warn('No payment providers enabled — checkout will fail');
}
