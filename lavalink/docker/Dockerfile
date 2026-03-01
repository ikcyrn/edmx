FROM eclipse-temurin:17-jre

WORKDIR /opt

ARG LAVALINK_VERSION=4.1.1
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl python3 python3-pip \
  && rm -rf /var/lib/apt/lists/*
RUN curl -L -o Lavalink.jar "https://github.com/lavalink-devs/Lavalink/releases/download/${LAVALINK_VERSION}/Lavalink.jar"
RUN python3 -m pip install --no-cache-dir yt-dlp

COPY lavalink/application.yml /opt/application.yml

EXPOSE 2333

CMD ["java", "-jar", "/opt/Lavalink.jar"]
