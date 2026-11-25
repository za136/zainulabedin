import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import { jsonSchemaTransform, serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import type { AppContext } from './context.js';
import { AppError } from './lib/errors.js';
import { registerAdminRoutes } from './modules/admin/admin.routes.js';
import { registerRoutes } from './modules/routes.js';
import { authPlugin } from './plugins/auth.js';

/** Build the Fastify app for a given context. Used by the server and by tests (app.inject). */
export async function buildApp(ctx: AppContext): Promise<FastifyInstance> {
  const app = Fastify({
    logger: ctx.env.LOG_LEVEL === 'silent' ? false : { level: ctx.env.LOG_LEVEL, redact: ['req.headers.authorization', 'req.headers.cookie'] },
    trustProxy: true,
    bodyLimit: 1_000_000,
    routerOptions: { maxParamLength: 1000 },
  });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: ctx.env.CORS_ORIGINS.split(',').map((o) => o.trim()), credentials: true });
  await app.register(cookie);
  await app.register(rateLimit, { global: true, max: 600, timeWindow: '1 minute', enableDraftSpec: true });

  await app.register(swagger, {
    openapi: {
      info: { title: `${ctx.store.config.name} — Store Factory API`, version: '1.0.0', description: 'Headless commerce API. All prices in minor units (cents), gross (incl. VAT). Locale via ?locale=de|en, Accept-Language or X-Locale.' },
      components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } } },
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  app.setErrorHandler((err: FastifyError | AppError, req, reply) => {
    if (err instanceof AppError) return reply.code(err.statusCode).send({ error: { code: err.code, message: err.message, details: err.details } });
    if ((err as FastifyError).validation) return reply.code(400).send({ error: { code: 'validation_error', message: err.message, details: (err as FastifyError).validation } });
    if ((err as FastifyError).statusCode && (err as FastifyError).statusCode! < 500) return reply.code((err as FastifyError).statusCode!).send({ error: { code: (err as FastifyError).code ?? 'bad_request', message: err.message } });
    req.log.error(err);
    return reply.code(500).send({ error: { code: 'internal_error', message: 'Something went wrong' } });
  });
  app.setNotFoundHandler((req, reply) => reply.code(404).send({ error: { code: 'route_not_found', message: `${req.method} ${req.url}` } }));

  await app.register(authPlugin, { ctx });
  await registerRoutes(app, ctx);
  await app.register(async (scoped) => registerAdminRoutes(scoped, ctx));
  return app;
}
