# 청기와 프로덕션 이미지 — 클라 정적 파일 + WebSocket 서버 단일 프로세스 (PLAN.md §1.2-7)
FROM node:22-slim AS build
RUN corepack enable \
  && apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build
# 서버는 better-sqlite3(네이티브)만 외부 의존 — deploy로 런타임 node_modules 구성
RUN pnpm --filter @cheongiwa/server deploy --prod --legacy /out/server

FROM node:22-slim AS runtime
ENV NODE_ENV=production \
    PORT=8787 \
    STATIC_DIR=/app/public \
    DB_PATH=/app/data/cheongiwa.db
WORKDIR /app
COPY --from=build /out/server ./
COPY --from=build /app/apps/client/dist ./public
RUN mkdir -p /app/data && chown -R node:node /app/data
VOLUME /app/data
EXPOSE 8787
USER node
CMD ["node", "dist/index.cjs"]
