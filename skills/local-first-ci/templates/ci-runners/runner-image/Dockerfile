# Self-hosted runner image, built by ../docker-compose.yml. Template from the local-first-ci skill.
#
# Keep its tools at the versions on GitHub's ubuntu-24.04 hosted image (Ubuntu 24.04, Python 3.12,
# OpenSSL 3, Node 24), so a job behaves the same on the local runner as on a hosted one and the
# fallback to hosted runners stays safe. When a workflow needs a tool that ubuntu-24.04 ships and
# this image lacks, add it here, not in the workflow. The base image provides the Docker CLI.
FROM myoung34/github-runner:ubuntu-noble
USER root
RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      python3 python3-venv python3-pip openssl jq unzip zip curl ca-certificates git xz-utils \
      build-essential \
 && rm -rf /var/lib/apt/lists/*
# Node from nodejs.org for the build's architecture, checked against the release's SHA256SUMS.
ARG NODE_VERSION=24.22.0
RUN set -eu; \
    case "$(dpkg --print-architecture)" in amd64) n=x64;; arm64) n=arm64;; *) exit 1;; esac; \
    tarball="node-v${NODE_VERSION}-linux-${n}.tar.xz"; \
    curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/${tarball}" -o "/tmp/${tarball}"; \
    curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt" -o /tmp/SHASUMS256.txt; \
    (cd /tmp && grep " ${tarball}\$" SHASUMS256.txt | sha256sum --check --strict); \
    tar -xJf "/tmp/${tarball}" -C /usr/local --strip-components=1; \
    rm -f "/tmp/${tarball}" /tmp/SHASUMS256.txt; \
    corepack enable; \
    node --version && python3 --version && openssl version
