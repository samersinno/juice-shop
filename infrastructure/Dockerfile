FROM node:20.19.2-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init=1.2.5-* \
    && rm -rf /var/lib/apt/lists/*

FROM node:20.19.2-bookworm AS builder

WORKDIR /juice-shop
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build && npm prune --production

FROM base AS production

ENV NODE_ENV=production
WORKDIR /juice-shop

COPY --from=builder --chown=node:node /juice-shop .

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/rest/admin/application-version',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "build/app.js"]
