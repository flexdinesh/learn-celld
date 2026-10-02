# MinIO removed its public images and archived binaries. Build the pinned official source.
FROM golang:1.24-bookworm AS build
ARG MINIO_VERSION=RELEASE.2025-04-22T22-12-26Z
WORKDIR /src
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL "https://codeload.github.com/minio/minio/tar.gz/refs/tags/${MINIO_VERSION}" | tar -xz --strip-components=1
RUN go build -trimpath -ldflags="-s -w" -o /minio .
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/*
COPY --from=build /minio /usr/local/bin/minio
EXPOSE 9000 9001
ENTRYPOINT ["minio"]
