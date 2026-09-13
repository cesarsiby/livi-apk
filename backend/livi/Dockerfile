# V45 finding: no Dockerfile existed anywhere in the repository before
# this version, despite the CI pipeline (V44) and staging preparation
# assuming a containerized deployment path. package.json declares
# "engines": { "node": ">=20" } — matched exactly here, same major version
# CI already runs against (see .github/workflows/ci.yml).
#
# V45 finding #2: no package-lock.json exists anywhere in this repository
# either — verified directly by running `npm ci --dry-run`, which fails
# immediately with EUSAGE ("can only install with an existing
# package-lock.json"). This is a real, honest limitation of every
# environment this project has been built in so far: none has had network
# access to run a real `npm install` and generate one. This Dockerfile
# therefore uses `npm install`, not `npm ci` — `npm install` resolves and
# installs dependencies without requiring a pre-existing lockfile, but
# without one, builds are not byte-for-byte reproducible (a dependency's
# transitive version could drift between builds). Before this Dockerfile
# is used for a real staging or production deployment, generate and commit
# a real package-lock.json (`npm install` once, in an environment with
# network access, then commit the resulting lockfile) and switch this to
# `npm ci` for reproducible, faster builds. Documented explicitly in
# docs/V45_STAGING_ENVIRONMENT.md rather than silently worked around.
#
# Multi-stage: the build stage installs dependencies; the runtime stage
# reinstalls only production dependencies and copies application source,
# running as a non-root user.

FROM node:20-slim AS build
WORKDIR /app
COPY package.json ./
RUN npm install

FROM node:20-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Non-root user — the base image's default `node` user/group already
# exists on node:*-slim images.
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

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
