FROM node:20-alpine AS base

WORKDIR /app

# Install security updates and signal handling tools
RUN apk add --no-cache dumb-init

FROM base AS dependencies
COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev

FROM base AS final
COPY --chown=node:node --from=dependencies /app/node_modules ./node_modules
COPY --chown=node:node package*.json ./
COPY --chown=node:node . .

ENV NODE_ENV=production
EXPOSE 3000

USER node

# Use dumb-init to properly handle SIGTERM/SIGKILL
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
