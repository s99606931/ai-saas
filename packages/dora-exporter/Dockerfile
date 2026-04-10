# DORA Exporter Container Image
# Design Ref: MTU-N169 §2 아키텍처 개요
# CSAP D-12: 최소 권한, 비-root 실행

FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm ci --ignore-scripts
COPY src/ ./src/
RUN npm run build

FROM node:20-alpine
RUN addgroup -g 1001 -S dora && adduser -u 1001 -S dora -G dora
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
USER dora
EXPOSE 9170
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:9170/healthz || exit 1
CMD ["node", "dist/index.js"]
