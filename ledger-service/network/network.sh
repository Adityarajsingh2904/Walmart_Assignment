#!/usr/bin/env bash
set -e
export PATH=$PWD/../bin:$PATH
FABRIC_CFG_PATH=${FABRIC_CFG_PATH:-$PWD/configtx}
CHANNEL_NAME=${CHANNEL_NAME:-trustvault}
IMAGETAG=2.5.4
CATAG=1.5.6

COMPOSE_BASE="compose"
function generateArtifacts() {
  cryptogen generate --config=./organizations/cryptogen/crypto-config-orderer.yaml
  cryptogen generate --config=./organizations/cryptogen/crypto-config-org1.yaml
  mkdir -p system-genesis-block
  configtxgen -profile TwoOrgsOrdererGenesis -channelID system-channel -outputBlock ./system-genesis-block/genesis.block
  configtxgen -profile TwoOrgsChannel -outputCreateChannelTx ./channel.tx -channelID $CHANNEL_NAME
}
COMPOSE_FILES="-f $COMPOSE_BASE/compose-test-net.yaml -f $COMPOSE_BASE/compose-ca.yaml"

function createOrgs() {
  ./organizations/fabric-ca/registerEnroll.sh
  ./organizations/ccp-generate.sh
}

function networkUp() {
  generateArtifacts
  createOrgs
  docker compose $COMPOSE_FILES up -d
}

function createChannel() {
  export FABRIC_CFG_PATH=$PWD/configtx
  set -x
  docker exec cli bash -c 'peer channel create -o orderer.example.com:7050 -c $CHANNEL_NAME -f ./channel.tx --outputBlock ./channel.block --tls --cafile /etc/hyperledger/ordererOrg/tlsca/tlsca.example.com-cert.pem'
  docker exec cli bash -c 'peer channel join -b channel.block'
  { set +x; } 2>/dev/null
}

function deployCC() {
  ./scripts/deployCC.sh "$CHANNEL_NAME" "$CC_NAME" "$CC_SRC_PATH" "$CC_SRC_LANGUAGE" "$CC_VERSION" "$CC_SEQUENCE" "$CC_END_POLICY"
}

function networkDown() {
  docker compose $COMPOSE_FILES down -v
  rm -rf organizations system-genesis-block *.tar.gz channel.tx channel.block
}

MODE=$1
shift
case "$MODE" in
  up)
    if [[ "$1" == "createChannel" ]]; then
      shift
      networkUp
      createChannel
    else
      networkUp
    fi
    ;;
  deployCC)
    while [[ $# -ge 1 ]]; do
      key="$1"; shift
      case $key in
        -ccn) CC_NAME="$1"; shift;;
        -ccp) CC_SRC_PATH="$1"; shift;;
        -ccl) CC_SRC_LANGUAGE="$1"; shift;;
        -ccep) CC_END_POLICY="$1"; shift;;
        -ccv) CC_VERSION="$1"; shift;;
        -ccs) CC_SEQUENCE="$1"; shift;;
      esac
    done
    deployCC
    ;;
  down)
    networkDown
    ;;
  *)
    echo "Usage: ./network.sh up|deployCC|down"
    exit 1
esac
