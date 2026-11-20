FROM swift:6.2.4-noble

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash clang cmake curl dotnet-sdk-8.0 g++ gcc git golang-go lua5.4 make nasm \
    nodejs node-typescript openjdk-21-jdk-headless php-cli ruby rustc unzip \
    && curl -fsSLo /tmp/microsoft.deb https://packages.microsoft.com/config/ubuntu/24.04/packages-microsoft-prod.deb \
    && dpkg -i /tmp/microsoft.deb \
    && apt-get update && apt-get install -y --no-install-recommends powershell \
    && rm -rf /var/lib/apt/lists/* /tmp/microsoft.deb

RUN curl -fsSLo /tmp/kotlin.zip https://github.com/JetBrains/kotlin/releases/download/v2.1.21/kotlin-compiler-2.1.21.zip \
    && echo '1ba08a8b45da99339a0601134cc037b54cf85e9bc0edbe19e  /tmp/kotlin.zip' | sha256sum -c - \
    && unzip -q /tmp/kotlin.zip -d /opt && rm /tmp/kotlin.zip

RUN git init /tmp/holyc \
    && git -C /tmp/holyc fetch --depth=1 https://github.com/Jamesbarford/holyc-lang.git 9fc6ba23688d0990803b184efec3dcd969a3a9e0 \
    && git -C /tmp/holyc checkout --detach FETCH_HEAD \
    && make -C /tmp/holyc && make -C /tmp/holyc install && rm -rf /tmp/holyc

COPY run.sh /usr/local/bin/playground-run
RUN sed -i 's/\r$//' /usr/local/bin/playground-run && chmod 755 /usr/local/bin/playground-run
ENV HOME=/work DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1 GOTOOLCHAIN=local GOPROXY=off GOSUMDB=off
WORKDIR /work
USER 65534:65534
ENTRYPOINT ["/usr/bin/timeout", "--signal=KILL", "29s", "/usr/local/bin/playground-run"]
