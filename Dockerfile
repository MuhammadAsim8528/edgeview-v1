# Reproducible QA environment, NOT the Windows desktop runtime.
# Windows DPAPI credentials must never be copied into this Linux container.
FROM node:24-bookworm-slim@sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5 AS qa
WORKDIR /app
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY --chown=node:node tsconfig.json vite.config.ts eslint.config.js index.html server.ts ./
COPY --chown=node:node server ./server
COPY --chown=node:node shared ./shared
COPY --chown=node:node src ./src
COPY --chown=node:node public ./public
COPY --chown=node:node assets ./assets
COPY --chown=node:node scripts ./scripts
RUN chown node:node /app
USER node
RUN npm run check && npm run build && npm run test:release
CMD ["npm", "run", "test:release"]
