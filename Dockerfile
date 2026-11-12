# syntax=docker/dockerfile:1

# Dev server image (compose.dev.yaml). Source is bind-mounted at runtime; the
# pre-created node_modules gives the named volume the right owner, since Docker
# copies a mount point's ownership into a fresh volume.
FROM node:24-slim AS dev
WORKDIR /app
RUN mkdir -p /app/node_modules && chown node:node /app/node_modules
USER node
ENV npm_config_cache=/tmp/.npm
CMD ["sh", "-c", "npm ci && exec npx vite --host 0.0.0.0 --port 5173 --strictPort"]


# Build on the native platform: the output is static files, identical for every
# target. Type errors fail the image build (`npm run build` typechecks first).
FROM --platform=$BUILDPLATFORM node:24-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build


# Caddy serves dist/ read-only. No Node, no node_modules, no source.
FROM caddy:2.11.9-alpine AS runtime

# Caddy wants writable config/data dirs even with admin and auto-HTTPS off.
# Point them at /tmp so the container can run with a read-only root.
ENV XDG_CONFIG_HOME=/tmp/caddy/config \
    XDG_DATA_HOME=/tmp/caddy/data

COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv

# Unprivileged port, unprivileged user. The image's files stay root-owned, so
# the server can't modify what it serves.
USER 1000:1000
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
