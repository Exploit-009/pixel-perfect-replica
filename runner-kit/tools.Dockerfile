# Sandbox image used for every XPLO session. Build: docker build -t xplo-tools:latest -f tools.Dockerfile .
# Includes: nmap, nikto, curl, dig, tshark, yara, file, strings, sha256sum, grep, ls, nuclei.
# Not included (runner reports them unavailable and refuses them): OWASP ZAP baseline, Ghidra headless.
FROM projectdiscovery/nuclei:latest AS nuclei

FROM debian:bookworm-slim
ENV DEBIAN_FRONTEND=noninteractive
RUN echo "wireshark-common wireshark-common/install-setuid boolean false" | debconf-set-selections \
 && apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates nmap nikto curl dnsutils tshark yara file binutils coreutils grep \
 && rm -rf /var/lib/apt/lists/* \
 && find / -xdev -perm /6000 -type f -exec chmod a-s {} + 2>/dev/null || true
COPY --from=nuclei /usr/local/bin/nuclei /usr/local/bin/nuclei
RUN groupadd -g 10001 sandbox && useradd -u 10001 -g 10001 -M -d /work -s /usr/sbin/nologin sandbox
USER 10001:10001
WORKDIR /work
