#!/usr/bin/env bash
# Optional: create a lab network whose containers can reach ONLY the given lab CIDR.
# Usage: sudo ./lab-network.sh 10.10.0.0/24
# Rootful Docker shown; with rootless Docker the lab targets must run as containers on the same network
# (create it with: docker network create --internal xplo-lab) — this is the safest option.
set -euo pipefail
LAB_CIDR="${1:?lab CIDR required, e.g. 10.10.0.0/24}"
NET=xplo-lab
SUBNET=172.31.250.0/24
docker network inspect "$NET" >/dev/null 2>&1 || docker network create --subnet "$SUBNET" -o com.docker.network.bridge.name=br-xplo-lab "$NET"
# DOCKER-USER is evaluated before Docker's own rules. Allow replies, allow the lab, drop everything else.
iptables -C DOCKER-USER -s "$SUBNET" -j DROP 2>/dev/null || {
  iptables -I DOCKER-USER -s "$SUBNET" -j DROP
  iptables -I DOCKER-USER -s "$SUBNET" -d "$LAB_CIDR" -j ACCEPT
  iptables -I DOCKER-USER -s "$SUBNET" -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
}
echo "Lab network $NET ready. Set LAB_NETWORK=$NET in .env. Persist these rules (e.g. iptables-persistent)."
