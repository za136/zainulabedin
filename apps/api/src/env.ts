import { z } from 'zod';

/**
 * Runtime configuration (12-factor). Store *identity* lives in store.json; this
 * file only holds infrastructure + secrets. See `.env.example` in the repo root.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().default(4000),
  /** postgres://… in production; pglite://<dir> or pglite://memory for zero-setup dev/tests */
  DATABASE_URL: z.string().optional(),
  STORE: z.string().optional(),
  STORE_DIR: z.string().optional(),
  /** HMAC secret for download links & signed tokens. MUST be set in production. */
  APP_SECRET: z.string().min(16).default('dev-only-secret-change-me-please'),
  /** Public storefront URL (redirects, emails) */
  WEB_URL: z.string().url().default('http://localhost:3000'),
  /** Public URL of this API (download links) */
  API_URL: z.string().url().default('http://localhost:4000'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  AUTO_MIGRATE: z.stringbool().default(true),
  SEED_ON_BOOT: z.stringbool().default(true),
  /** Where digital files live (local disk adapter). Missing files are served as demo placeholders outside production. */
  STORAGE_DIR: z.string().default('./storage'),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  /** format = syntax check only (dev); vies = EU VIES REST API (production) */
  VAT_VALIDATION: z.enum(['format', 'vies']).default('format'),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(10).optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});
export type Env = z.infer<typeof envSchema>;

export function loadEnv(raw: NodeJS.ProcessEnv = process.env): Env {
  const env = envSchema.parse(raw);
  if (env.NODE_ENV === 'production' && env.APP_SECRET.startsWith('dev-only')) {
    throw new Error('APP_SECRET must be set to a strong random value in production');
  }
  return env;
}
