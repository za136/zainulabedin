# One image, two targets: `api` and `web`. Build with:
#   docker build --target api -t store-factory-api .
#   docker build --target web -t store-factory-web .
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=1
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages/core/package.json packages/core/
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
COPY packages/sdk/package.json packages/sdk/
COPY packages/i18n/package.json packages/i18n/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/mobile/package.json apps/mobile/
COPY tools/factory/package.json tools/factory/
RUN pnpm install --frozen-lockfile

FROM deps AS source
COPY . .

# ---------------- API (runs TypeScript via tsx; no separate build step) ----------------
FROM source AS api
ENV NODE_ENV=production PORT=4000
EXPOSE 4000
USER node
CMD ["pnpm", "--filter", "@factory/api", "start"]

# ---------------- Web ----------------
FROM source AS web-build
ENV NEXT_OUTPUT=standalone NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @factory/web build

FROM node:22-slim AS web
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=web-build /app/apps/web/.next/standalone ./
COPY --from=web-build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=web-build /app/apps/web/public ./apps/web/public
EXPOSE 3000
USER node
CMD ["node", "apps/web/server.js"]
