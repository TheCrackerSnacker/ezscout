# Debian-based: sodium-native (@fastify/secure-session) has no musl prebuilds.
FROM node:24-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci

FROM deps AS dev
ENV NODE_ENV=development
COPY apps/api/scripts apps/api/scripts
COPY apps/api/drizzle apps/api/drizzle
COPY packages/shared/src packages/shared/src
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["npx", "--no-install", "tsx", "watch", "src/server.ts"]

FROM deps AS build
ENV NODE_ENV=production
COPY apps/api/src apps/api/src
COPY apps/api/tsup.config.ts apps/api/
COPY packages/shared/src packages/shared/src
WORKDIR /app/apps/api
RUN npx tsup

FROM base AS prod
ENV NODE_ENV=production
WORKDIR /app/apps/api
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=build /app/apps/api/dist dist
COPY apps/api/drizzle drizzle
EXPOSE 3000
CMD ["node", "dist/server.js"]
