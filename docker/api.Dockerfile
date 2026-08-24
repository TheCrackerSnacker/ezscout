FROM node:24-alpine AS base
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

FROM deps AS prod
ENV NODE_ENV=production
COPY apps/api/src apps/api/src
COPY apps/api/scripts apps/api/scripts
COPY apps/api/drizzle apps/api/drizzle
COPY packages/shared/src packages/shared/src
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["npx", "--no-install", "tsx", "src/server.ts"]
