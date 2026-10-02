FROM node:22-bookworm-slim
ARG TARGETARCH
ARG CELLD_VERSION=v0.6.1
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl gzip && rm -rf /var/lib/apt/lists/*
RUN case "$TARGETARCH" in arm64) target=aarch64 ;; amd64) target=x86_64 ;; *) exit 1 ;; esac; \
    curl -fsSL "https://github.com/denoland/celld/releases/download/${CELLD_VERSION}/celld-${target}-unknown-linux-gnu.gz" | gzip -d > /usr/local/bin/celld && chmod +x /usr/local/bin/celld && celld --version
RUN npm install -g esbuild@0.25.10
WORKDIR /worker
COPY apps/worker/package.json apps/worker/wrangler.json ./
COPY apps/worker/src ./src
RUN esbuild src/index.ts --bundle --format=esm --target=es2022 --outfile=dist/index.js
ENTRYPOINT ["celld"]
