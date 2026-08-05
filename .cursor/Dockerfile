# Cursor Cloud Agent environment — avoid NodeSource apt (flaky curl resets).
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV LANG=C.UTF-8

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    gnupg \
    locales \
    openssh-client \
    sudo \
    xz-utils \
  && rm -rf /var/lib/apt/lists/* \
  && locale-gen en_US.UTF-8

# Official Node binary tarball (more reliable than deb.nodesource.com in CI).
ARG NODE_VERSION=22.17.1
RUN set -eux; \
  for i in 1 2 3; do \
    curl -fsSL --retry 5 --retry-all-errors --retry-delay 2 \
      "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" \
      -o /tmp/node.tar.xz && break; \
    sleep $((i * 3)); \
  done; \
  tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1; \
  rm /tmp/node.tar.xz; \
  node -v; \
  npm -v; \
  corepack enable; \
  corepack prepare pnpm@10.33.4 --activate; \
  pnpm -v
