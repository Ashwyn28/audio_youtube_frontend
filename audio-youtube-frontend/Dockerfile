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
