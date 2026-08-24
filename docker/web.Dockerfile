FROM node:24-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci

FROM deps AS dev-web
ENV NODE_ENV=development
COPY apps/web/index.html apps/web/index.html
COPY apps/web/tsconfig.json apps/web/tsconfig.json
COPY apps/web/vite.config.ts apps/web/vite.config.ts
COPY packages/shared/src packages/shared/src
WORKDIR /app/apps/web
EXPOSE 5173
CMD ["npx", "--no-install", "vite", "--host", "0.0.0.0"]

FROM deps AS build
COPY packages/shared/src packages/shared/src
COPY apps/web/ apps/web/
WORKDIR /app/apps/web
RUN npm run build

FROM nginx:1.27-alpine AS prod
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
