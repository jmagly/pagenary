FROM node:20@sha256:8f693eaa7e0a8e71560c9a82b55fd54c2ae920a2ba5d2cde28bac7d1c01c9ba5 AS node

FROM ubuntu:24.04@sha256:561618e2c15bf2397621dd04f96926663a3b5616c189cf7e38db7e82f5c538ea

ARG DEBIAN_FRONTEND=noninteractive
ARG PLANTUML_VERSION=1.2026.4
ARG PLANTUML_SHA256=08588de4b505bd3f08fcc35bf2ca2fd9b7ec785e28203c5d6c57a7f05f4a00ff
ARG TECTONIC_VERSION=0.16.9
ARG TECTONIC_SHA256=60b13a0826ae7ad9ce34b4a2df06bff2cfcfa6dda8a915477c0cbb84e1a4a902

COPY --from=node /usr/local/ /usr/local/

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates=20260601~24.04.1 \
      curl=8.5.0-2ubuntu10.11 \
      fontconfig=2.15.0-1.1ubuntu2 \
      graphviz=2.42.2-9ubuntu0.1 \
      latexml=0.8.8-1 \
      openjdk-21-jre-headless=21.0.11+10-1~24.04.2 \
 && rm -rf /var/lib/apt/lists/* \
 && curl -fsSLo /opt/plantuml.jar \
      "https://github.com/plantuml/plantuml/releases/download/v${PLANTUML_VERSION}/plantuml-mit-${PLANTUML_VERSION}.jar" \
 && echo "${PLANTUML_SHA256}  /opt/plantuml.jar" | sha256sum -c - \
 && curl -fsSLo /tmp/tectonic.tar.gz \
      "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${TECTONIC_VERSION}/tectonic-${TECTONIC_VERSION}-x86_64-unknown-linux-musl.tar.gz" \
 && echo "${TECTONIC_SHA256}  /tmp/tectonic.tar.gz" | sha256sum -c - \
 && tar -xzf /tmp/tectonic.tar.gz -C /usr/local/bin tectonic \
 && rm /tmp/tectonic.tar.gz \
 && useradd --create-home --uid 10001 renderer \
 && fc-cache -f

ENV LANG=C.UTF-8 LC_ALL=C.UTF-8 \
    PLANTUML_JAR=/opt/plantuml.jar \
    JAVA_PATH=/usr/bin/java

USER renderer
WORKDIR /workspace

COPY --chown=renderer:renderer apps/publisher/__tests__/fixtures/latex-pages/01-structure-math.tex /tmp/tectonic-warm/cache.tex

# Populate the exact bundle/font resources exercised by the accepted PDF
# fixture while the image build still has network access. Runtime compilation
# is then forced through --only-cached in a networkless container.
RUN tectonic -X compile --untrusted --outdir /tmp/tectonic-warm /tmp/tectonic-warm/cache.tex \
 && rm -rf /tmp/tectonic-warm

CMD ["node", "ci/rich-content/qualify.mjs"]
