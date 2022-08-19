import {HardhatUserConfig} from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import 'hardhat-abi-exporter';
import "hardhat-contract-sizer";
import "solidity-docgen";

const MAINNET_RPC_URL =
    process.env.MAINNET_RPC_URL || "https://eth-mainnet.g.alchemy.com/v2/2s7E2BUKmluhMZx7RXJnl8dv2KceLgiL";
const RINKEBY_RPC_URL =
    process.env.RINKEBY_RPC_URL || "https://eth-rinkeby.alchemyapi.io/v2/og1sfp46U1puZhF5NhqWYc5MscXOHw0V";
const GOERLI_RPC_URL =
    process.env.GOERLI_RPC_URL || "https://eth-goerli.g.alchemy.com/v2/ZgIbkV5wq2nOwOXMUs7Pf0bF2X-pQMP5";
const BSC_MAINNET_RPC_URL =
    process.env.BSC_MAINNET_RPC_URL || "https://bsc-dataseed1.binance.org";
const BSC_TESTNET_RPC_URL =
    process.env.BSC_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545";

const REPORT_GAS = process.env.REPORT_GAS || false

// deployer key
const MNEMONIC = "";

const config: HardhatUserConfig = {
    defaultNetwork: "hardhat",
    networks: {
        mainnet: {
            url: MAINNET_RPC_URL,
            accounts: {
                mnemonic: MNEMONIC,
            },
            chainId: 1,
        },
        rinkeby: {
            url: RINKEBY_RPC_URL,
            accounts: {
                mnemonic: MNEMONIC,
            },
            chainId: 4,
        },
        goerli: {
            url: GOERLI_RPC_URL,
            accounts: {
                mnemonic: MNEMONIC,
            },
            chainId: 5,
        },
        bscMainnet: {
            url: BSC_MAINNET_RPC_URL,
            accounts: {
                mnemonic: MNEMONIC,
            },
        },
        bscTestnet: {
            url: BSC_TESTNET_RPC_URL,
            accounts: {
                mnemonic: MNEMONIC,
            },
        },
    },
    solidity: {
        compilers: [
            {
                version: "0.8.9",
                settings: {
                    optimizer: {enabled: true, runs: 200},
                },
            },
            {
                version: "0.7.6",
            },
            {
                version: "0.6.6",
            },
            {
                version: "0.5.16",
            },
            {
                version: "0.4.24",
            },
        ],
    },
    etherscan: {
        // etherscan
        apiKey: "",
        // bscscan
        // apiKey: "",
    },
    gasReporter: {
        enabled: true,
        currency: "USD",
        outputFile: "gas-report.txt",
        noColors: true,
        // coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    },
    abiExporter: [
        {
            path: './abi/pretty',
            pretty: true,
            flat: true,
        },
        {
            path: './abi/ugly',
            pretty: false,
            flat: true,
        },
    ],
    mocha: {
        timeout: 120000000,
    },
};

export default config;
