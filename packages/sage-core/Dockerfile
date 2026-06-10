# Node 22 + Yarn 4.6.0 — the toolchain the sage pipeline was developed and locked
# against. Do NOT bump these to the top-level workspace's Yarn 4.9.3 / Node 24:
# the reported results come from this environment.
FROM node:22-slim

# COREPACK_ENABLE_PROJECT_SPEC=0 tells corepack to ignore the root package.json's
# "packageManager": "yarn@4.9.3" and use the version we pin here instead.
ENV COREPACK_ENABLE_PROJECT_SPEC=0
RUN corepack enable && corepack prepare yarn@4.6.0 --activate

WORKDIR /app

# Copy root manifests and Yarn config first for better layer caching
COPY package.json yarn.lock .yarnrc.yml ./

# Copy every workspace manifest so the install can resolve the full workspace graph
COPY packages/sage-core/package.json packages/sage-core/
COPY packages/simplenlg-core/package.json packages/simplenlg-core/
COPY packages/simplenlg-unwrap/package.json packages/simplenlg-unwrap/
COPY studies/eval/package.json studies/eval/
COPY studies/prelim/package.json studies/prelim/
COPY thesis/package.json thesis/

# Copy Yarn internals (release/plugins/cache)
COPY .yarn/ .yarn/

# Install dependencies exactly as locked — fails if lock is out of date
RUN yarn install --immutable

# Copy the TypeScript package sources. The pipeline runs via tsx (see the `gen`
# script), so no build step is needed — sage-core imports simplenlg-core from
# source and reads its lexicon XML directly.
COPY packages/ packages/

WORKDIR /app/packages/sage-core

# data/ is mounted at runtime; reports/ is written by the pipeline
VOLUME ["/app/packages/sage-core/data", "/app/packages/sage-core/reports"]

# Usage (from the repo root): docker run --rm \
#   -v $(pwd)/packages/sage-core/data:/app/packages/sage-core/data \
#   -v $(pwd)/packages/sage-core/reports:/app/packages/sage-core/reports \
#   --env-file packages/sage-core/.env.local \
#   sage-core generate data/ [--module all]
ENTRYPOINT ["yarn", "gen"]
CMD ["generate", "data/"]
