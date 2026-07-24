# 청기와 프로덕션 이미지 — 클라 정적 파일 + WebSocket 서버 단일 프로세스 (PLAN.md §1.2-7)
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build

# 서버는 CJS 단일 번들(tsup noExternal)이라 런타임 node_modules가 필요 없다
FROM node:22-slim AS runtime
ENV NODE_ENV=production \
    PORT=8787 \
    STATIC_DIR=/app/public
WORKDIR /app
COPY --from=build /app/apps/server/dist ./dist
COPY --from=build /app/apps/client/dist ./public
EXPOSE 8787
USER node
CMD ["node", "dist/index.cjs"]
