FROM node:22-bookworm-slim AS base
RUN npm install -g pnpm@10.33.0
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm install --frozen-lockfile
FROM base AS api
EXPOSE 3001
CMD ["pnpm", "--filter", "@lab/api", "start"]
FROM base AS web-build
RUN pnpm --filter @lab/web build
FROM nginx:1.28-alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
