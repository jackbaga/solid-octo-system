ARG NODE_IMAGE=node:22-alpine
FROM ${NODE_IMAGE} AS build

WORKDIR /app
RUN find /app -mindepth 1 -maxdepth 1 -exec rm -rf {} +
RUN if command -v apk >/dev/null 2>&1; then \
      apk add --no-cache openssl; \
    elif command -v apt-get >/dev/null 2>&1; then \
      apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*; \
    fi

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run prisma:generate
RUN npm run build

FROM ${NODE_IMAGE} AS runtime

WORKDIR /app
RUN find /app -mindepth 1 -maxdepth 1 -exec rm -rf {} +
RUN if command -v apk >/dev/null 2>&1; then \
      apk add --no-cache openssl; \
    elif command -v apt-get >/dev/null 2>&1; then \
      apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*; \
    fi

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

ENV NODE_ENV=production
EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
