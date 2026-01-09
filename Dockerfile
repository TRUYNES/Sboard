# Build Stage
FROM node:20-alpine as build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production Stage
FROM nginx:stable-alpine as production-stage
COPY --from=build-stage /app/dist /usr/share/nginx/html
# Copy custom nginx config if we needed one, but default is usually fine for SPA if we handle 404s
# For React Router (not used here yet, but good practice), we might need a custom default.conf
# We only have a single page, so default is fine.
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
