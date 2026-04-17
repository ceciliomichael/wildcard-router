FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./

# node-pty requires a native build toolchain on Alpine during install.
RUN apk add --no-cache python3 make g++
RUN npm ci

FROM node:22-alpine AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN apk add --no-cache docker-cli
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# Next standalone tracing can miss node-pty native artifacts. Copy them explicitly.
COPY --from=builder /app/node_modules/node-pty ./node_modules/node-pty
COPY --from=builder /app/node_modules/node-addon-api ./node_modules/node-addon-api

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
