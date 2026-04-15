# Build stage
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# Production stage
FROM oven/bun:1-slim AS production
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/.output .output
COPY --from=build /app/drizzle drizzle
COPY --from=build /app/drizzle.config.ts .
COPY --from=build /app/package.json .
COPY --from=build /app/bun.lock .
RUN bun install --frozen-lockfile --production --ignore-scripts
EXPOSE 3000
CMD ["sh", "-c", "bun run db:migrate && bun run start"]
