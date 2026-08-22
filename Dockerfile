# Naija Dimes Hub — Render deploy (Docker, no GitHub OAuth needed)
FROM node:18-bookworm

WORKDIR /app

# copy manifests first for better layer caching
COPY package.json package-lock.json* ./

# install deps (better-sqlite3 builds native here)
RUN npm install --no-audit --no-fund

# copy app source (data/ excluded via .dockerignore; persisted on disk at runtime)
COPY . .

# ensure data dir exists
RUN mkdir -p /app/data/uploads

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.js"]
