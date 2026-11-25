# Two targets on one base image.
#   app (the default): serves the web app on $PORT (3000), specimens replayed from recordings, no key needed.
#     docker build -t notice-exorcist .
#     docker run --rm -p 3000:3000 notice-exorcist
#   test: runs the full check suite (typecheck, unit tests, Playwright e2e) in a clean Linux box.
#     docker build --target test -t notice-exorcist-test .
#     docker run --rm notice-exorcist-test
# Node 24 is needed for next, vitest and node:sqlite; bun drives the workspace scripts.
FROM node:24-bookworm AS base

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

FROM base AS test
CMD ["sh", "-c", "bun run typecheck && bun run test && bun run e2e"]

# Last, so a plain `docker build` gives the app. EXTRACT_MODE stays unset: notices are read from the recorded
# replies, and the empty inbox offers Try a specimen. Chromium (above) prints the PDF export.
FROM base AS app
RUN bun run build
ENV PORT=3000
EXPOSE 3000
CMD ["sh", "-c", "exec bun run start -H 0.0.0.0 --port \"${PORT:-3000}\""]
