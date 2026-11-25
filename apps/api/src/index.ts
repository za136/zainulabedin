import { buildApp } from './app.js';
import { bootstrap } from './bootstrap.js';
import { startScheduler } from './jobs/scheduler.js';

const { ctx, handle } = await bootstrap();
const app = await buildApp(ctx);
const stop = startScheduler(ctx, (m, e) => app.log.error({ err: e }, m));

await app.listen({ host: ctx.env.HOST, port: ctx.env.PORT });
app.log.info(`🛍  ${ctx.store.config.name} API ready — docs at ${ctx.env.API_URL}/docs`);

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    stop();
    await app.close();
    await handle.close();
    process.exit(0);
  });
}
