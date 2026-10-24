FROM node:22-slim AS base
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .

FROM base AS dev
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM base AS preview
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "3000"]

FROM base AS builder
RUN npm run build

FROM node:22-slim AS production
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
EXPOSE 3000
CMD ["node", "build"]
