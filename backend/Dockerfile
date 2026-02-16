FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    default-jre-headless \
    osmium-tool \
    wget \
    unzip \
    && rm -rf /var/lib/apt/lists/*

ENV MKGMAP_VERSION=r4924
ENV SPLITTER_VERSION=r654

RUN mkdir -p /tmp/downloads && \
    wget -q -O /tmp/downloads/mkgmap.zip "https://www.mkgmap.org.uk/download/mkgmap-${MKGMAP_VERSION}.zip" && \
    unzip -q /tmp/downloads/mkgmap.zip -d /opt && \
    mv /opt/mkgmap-${MKGMAP_VERSION} /opt/mkgmap && \
    wget -q -O /tmp/downloads/splitter.zip "https://www.mkgmap.org.uk/download/splitter-${SPLITTER_VERSION}.zip" && \
    unzip -q /tmp/downloads/splitter.zip -d /opt && \
    mv /opt/splitter-${SPLITTER_VERSION} /opt/splitter && \
    rm -rf /tmp/downloads

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /data/jobs

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
