import type { AppContext } from '../context.js';
import { renewSubscriptions } from '../modules/account/library.service.js';
import { expireUnpaidOrders } from '../modules/checkout/checkout.service.js';
import { processOutbox } from '../modules/notifications/outbox.js';

/**
 * In-process background jobs. For larger deployments run them in a separate
 * worker (same code, `pnpm --filter @factory/api start:worker`) or a cron.
 */
export function startScheduler(ctx: AppContext, log: (msg: string, err?: unknown) => void) {
  const every = (ms: number, name: string, fn: () => Promise<unknown>) => {
    let running = false;
    return setInterval(async () => {
      if (running) return;
      running = true;
      try {
        await fn();
      } catch (e) {
        log(`job ${name} failed`, e);
      } finally {
        running = false;
      }
    }, ms);
  };
  const timers = [
    every(2_000, 'outbox', () => processOutbox(ctx)),
    every(60 * 60_000, 'expire-unpaid', () => expireUnpaidOrders(ctx)),
    every(15 * 60_000, 'renew-subscriptions', () => renewSubscriptions(ctx)),
  ];
  return () => timers.forEach(clearInterval);
}
