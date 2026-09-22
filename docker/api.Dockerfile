FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile || pnpm install

FROM deps AS build
COPY packages/shared packages/shared
COPY apps/api apps/api
COPY prisma prisma
RUN pnpm --filter @crickscore/shared build && pnpm --filter @crickscore/api prisma:generate && pnpm --filter @crickscore/api build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/prisma ./prisma
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "dist/main.js"]
