# source2video / doc-maker UI - Next.js standalone image
FROM node:22-slim AS deps

WORKDIR /app/doc-maker/ui

RUN npm config set registry https://registry.npmmirror.com \
  && npm install -g pnpm@10.33.0

COPY doc-maker/ui/package.json doc-maker/ui/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-slim AS builder

WORKDIR /app

RUN npm config set registry https://registry.npmmirror.com \
  && npm install -g pnpm@10.33.0

COPY --from=deps /app/doc-maker/ui/node_modules ./doc-maker/ui/node_modules
COPY Dockerfile ./Dockerfile
COPY packages ./packages
COPY doc-maker/packages ./doc-maker/packages
COPY doc-maker/ui ./doc-maker/ui

WORKDIR /app/doc-maker/ui
RUN pnpm test && pnpm build

FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production \
  PORT=3000 \
  HOSTNAME=0.0.0.0 \
  DOC_MAKER_RUN_STORE_DIR=/data/writing-runs \
  DOC_MAKER_RULE_PACKAGE_STORE_DIR=/data/rule-packages

RUN mkdir -p /data/writing-runs /data/rule-packages /app/ui/.doc-maker-runtime \
  && chown -R node:node /data /app

COPY --from=builder --chown=node:node /app/doc-maker/ui/.next/standalone ./
COPY --from=builder --chown=node:node /app/doc-maker/ui/.next/static ./ui/.next/static

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=6 --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "ui/server.js"]
