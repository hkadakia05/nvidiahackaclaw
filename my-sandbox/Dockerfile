FROM ubuntu:24.04

WORKDIR /sandbox

RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    bash \
    ca-certificates \
    python3 \
    python3-pip \
    python3-venv \
    nodejs \
    npm \
    iproute2 \
    iputils-ping \
    net-tools \
    procps \
    sudo \
    tini \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -r sandbox && useradd -r -g sandbox -m -s /bin/bash sandbox

RUN mkdir -p /sandbox && chown -R sandbox:sandbox /sandbox

USER sandbox

CMD ["sleep", "infinity"]
