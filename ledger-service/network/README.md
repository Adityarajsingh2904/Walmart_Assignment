# Test Network

Run the Fabric test network for development.

```bash
# start Org1 and create channel
./network.sh up createChannel -ca

# deploy chaincode
./network.sh deployCC -ccn ledger_cc -ccp ../chaincode/ledger -ccl typescript -ccep "OR('Org1MSP.peer')"

# shutdown network
./network.sh down
```
