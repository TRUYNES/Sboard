# Build Stage
FROM node:20-alpine as build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
RUN apk add --no-cache docker-cli docker-cli-compose git
COPY . .
RUN npm run build

# Production Stage
FROM node:20-alpine as production-stage
WORKDIR /app
COPY --from=build-stage /app/dist ./dist
# We need package.json for type: module, and node_modules for deps
COPY package*.json ./
RUN npm install --production
RUN apk add --no-cache docker-cli docker-cli-compose git
COPY server.js .
COPY services ./services

EXPOSE 80
CMD ["node", "server.js"]
