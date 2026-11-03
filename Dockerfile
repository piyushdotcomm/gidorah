# Gidorah runtime image (CLI only; Bifrost and Ollama run alongside, see docker-compose.yml)
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps ./apps
COPY plugins ./plugins
COPY scripts ./scripts
COPY config ./config
COPY tests ./tests
COPY tsconfig.base.json tsconfig.json ./
RUN pnpm install --frozen-lockfile
RUN node scripts/build.ts
ENV GIDORAH_MODE=mock
ENTRYPOINT ["node", "apps/cli/src/main.ts"]
CMD ["doctor"]
