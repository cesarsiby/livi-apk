# V45 finding: no Dockerfile existed anywhere in the repository before
# this version, despite the CI pipeline (V44) and staging preparation
# assuming a containerized deployment path. package.json declares
# "engines": { "node": ">=20" } — matched exactly here, same major version
# CI already runs against (see .github/workflows/backend-ci.yml).
#
# SESSION 26 (§41 prompt maître) : un vrai package-lock.json existe
# désormais (généré réellement via .github/workflows/generate-lockfiles.yml
# sur les serveurs GitHub, qui ont un accès réseau réel — voir ce fichier
# et RAPPORT_AUDIT_SESSION26_RECONCILIATION_BRANCHES.md). `npm ci` est donc
# utilisé ci-dessous plutôt que `npm install` : installation reproductible
# à l'octet près à partir du lockfile committé, plus rapide qu'un
# `npm install`, exactement la bascule que le commentaire précédent de ce
# fichier annonçait comme prochaine étape.
#
# Multi-stage: the build stage installs dependencies; the runtime stage
# reinstalls only production dependencies and copies application source,
# running as a non-root user.

FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Non-root user — the base image's default `node` user/group already
# exists on node:*-slim images.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
COPY migrations ./migrations

# Local file storage (UPLOAD_DIR default) needs to exist and be writable
# by the non-root user before dropping privileges.
RUN mkdir -p /app/storage && chown -R node:node /app

USER node

EXPOSE 3000

# Migrations are NOT run automatically on container start — a staging or
# production rollout should run `node src/utils/migrate.js` as an explicit,
# separate step (see docs/V45_STAGING_ENVIRONMENT.md and
# docs/V43_BACKUP_RESTORE_DR.md) so a failed migration blocks the deploy
# instead of silently leaving old application code running against a
# half-migrated schema, or racing multiple container replicas against each
# other (mitigated by the advisory lock added in V43, but still cleaner as
# an explicit pre-deploy step than an implicit one baked into every
# container's entrypoint).
CMD ["node", "src/server.js"]
