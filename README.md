# Addresses

Deployer: `0xa396177E79E3830125dBA37775A4b1bf76FAeb36`

| Contract        | Chain       | Address                                      | Link                                                                                              |
|-----------------|-------------|----------------------------------------------|---------------------------------------------------------------------------------------------------|
| `RaffleFactory` | Rinkeby     | `0xC099785160905aC58c66ba9fC297031C807857fc` | [etherscan](https://rinkeby.etherscan.io/address/0xC099785160905aC58c66ba9fC297031C807857fc#code) |
| `RaffleFactory` | Rinkeby     | `0x3933707870282875924b2E82c55E2Bdcbcd7b056` | [etherscan](https://rinkeby.etherscan.io/address/0x3933707870282875924b2E82c55E2Bdcbcd7b056#code) |
| `RaffleFactory` | BSC Testnet | `0x11F662E006C8e4cE0510983949be66c1161842C4` | [bscscan](https://testnet.bscscan.com/address/0x11F662E006C8e4cE0510983949be66c1161842C4#code)    |
| `ERC721Mock`    | Rinkeby     | `0xF3E5FA2cC204fDa862e4f3Dd8069E72d15dDddBb` | [etherscan](https://rinkeby.etherscan.io/address/0xF3E5FA2cC204fDa862e4f3Dd8069E72d15dDddBb#code) |
| `ERC721Mock`    | BSC Testnet | `0xF3E5FA2cC204fDa862e4f3Dd8069E72d15dDddBb` | [bscscan](https://testnet.bscscan.com/address/0xF3E5FA2cC204fDa862e4f3Dd8069E72d15dDddBb#code)    | 

Raffle contracts:

| Chain   | Address                                      | NFT                | Link                                                                                              | 
|---------|----------------------------------------------|--------------------|---------------------------------------------------------------------------------------------------|
| Rinkeby | `0x94d593badfF522bf4F96B77b77E58a4a1391FB0b` | `ERC721Mock` / `4` | [etherscan](https://rinkeby.etherscan.io/address/0x94d593badff522bf4f96b77b77e58a4a1391fb0b#code) |
| Rinkeby | `0x3C88a1Eb3aCB634C3dF28E4AfF327dAc1226C2ec` | `ERC1155-OpenSea`  | [etherscan](https://rinkeby.etherscan.io/address/0x3C88a1Eb3aCB634C3dF28E4AfF327dAc1226C2ec#code) |

# Useful commands

* `npx hardhat compile`
* `npx hardhat test`
* `npx hardhat size-contracts`
* `npm run coverage`

## Deploying

* `npx hardhat run --network rinkeby scripts/deploy.ts`

## Verifying

Example for `RaffleFactory` contract:

* `npx hardhat verify --network rinkeby 0xE416c1B58c10082FdefAbF8578cA511180c4Cf02`

Example for `Raffle` (using `RaffleFactory.createRaffle`) contract:

* `npx hardhat verify --network rinkeby 0xA0f55d94cf742f6e94921B8997C9d4e0B48d9db0 0xF3E5FA2cC204fDa862e4f3Dd8069E72d15dDddBb 3 100 100000000000000 1659770100 1659773700 9975 0x6168499c0cffcacd319c818142124b7a15e857ab 0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc`

# Resources

* https://github.com/smartcontractkit/hardhat-starter-kit
* https://blog.chain.link/how-to-build-a-blockchain-lottery/
* https://github.com/alphachainio/chainlink-lottery/tree/master/ethereum/contracts
* https://github.com/itsthecandyshop/contracts/tree/master/contracts
* https://github.com/GMSteuart/lotto-buffalo/tree/master/ethereum/contracts
* https://github.com/elviric/BWoF/blob/master/smartcontract/BWoF.sol
* https://iancoleman.io/bip39/
