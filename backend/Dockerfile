FROM node:22.16.0-alpine AS base

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM base AS development

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]

FROM base AS build

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22.16.0-alpine AS production

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist

USER node
EXPOSE 8080

CMD ["node", "dist/server.js"]
