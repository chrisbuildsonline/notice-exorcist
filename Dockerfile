# Runs the full check suite (typecheck, unit tests, Playwright e2e) in a clean Linux box.
#   docker build -t notice-exorcist .
#   docker run --rm notice-exorcist
# Node 24 is needed for next, vitest and node:sqlite; bun drives the workspace scripts.
FROM node:24-bookworm

ARG BUN_VERSION=latest
RUN npm install -g bun@${BUN_VERSION}

ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# Manifests first, so the dependency layers are cached until a package.json or the lockfile changes.
COPY package.json bun.lock ./
COPY apps/web/package.json apps/web/
COPY packages/duty-engine/package.json packages/duty-engine/
COPY packages/notice-extract/package.json packages/notice-extract/
COPY packages/tariff-data/package.json packages/tariff-data/
COPY packages/tariff-mcp/package.json packages/tariff-mcp/
RUN bun install --frozen-lockfile

# Chromium plus its system libraries and fonts: PDF export, specimen tests and e2e all print with it.
RUN bunx playwright install --with-deps chromium

COPY . .

# The tariff index is not in git; the tests and the web app read it.
RUN bun run --cwd packages/tariff-data data:build

CMD ["sh", "-c", "bun run typecheck && bun run test && bun run e2e"]
