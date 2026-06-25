ARG NODE_IMAGE=node:22-alpine
ARG NGINX_IMAGE=nginx:1.27-alpine
FROM ${NODE_IMAGE} AS build

WORKDIR /app
RUN find /app -mindepth 1 -maxdepth 1 -exec rm -rf {} +

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json ./
COPY vite.config.* ./
COPY index.html ./
COPY src ./src
RUN npm run build

FROM ${NGINX_IMAGE} AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
