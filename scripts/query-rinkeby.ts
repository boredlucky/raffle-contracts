import {ethers} from "hardhat";
import axios from "axios";
import * as path from "path";
import {exists} from "solidity-docgen/dist/utils/fs-exists";
import * as fs from "fs";

type NFTStandard = "ERC721" | "ERC1155" | "CryptoPunks";

export const RAFFLE_STATES = {
    WaitingForNFT: 0,
    WaitingForStart: 1,
    SellingTickets: 2,
    WaitingForRNG: 3,
    Completed: 4,
    Cancelled: 5,
};

export const NFT_STANDARDS = {
    CryptoPunks: 0,
    ERC721: 1,
    ERC1155: 2,
};

type ContractInformation = {
    name: string,
    standard: NFTStandard,
}

type ChainInformation = {
    [contractAddress: string]: ContractInformation
}

type NFTRegistry = {
    [chainId: number]: ChainInformation
}

type NFTInfo = {
    collection: string,
    name: string;
    image: string;
    standard: NFTStandard;
}

type RaffleInfo = {
    contractAddress: string;
    startTimestamp: number;
    endTimestamp: number;
    ticketPrice: string;
    tickets: number;
    nftContractAddress: string;
    nftTokenId: string;
    nftStandard: number;
    nftCollection: string;
    nftTitle: string;
    nftImage: string;
}

const NFT_REGISTRY: NFTRegistry = {
    // Mainnet
    1: {
        "0xb47e3cd837ddf8e4c57f05d70ab865de6e193bbb": {
            name: "CryptoPunk",
            standard: "CryptoPunks",
        },
        "0x60e4d786628fea6478f785a6d7e704777c86a7c6": {
            name: "Mutant Ape Yacht Club",
            standard: "ERC721",
        },
        "0xfb7e002151343efa2a3a5f2ea98db0d21efb75ce": {
            name: "Azuki",
            standard: "ERC721",
        },
        "0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d": {
            name: "Bored Ape Yacht Club",
            standard: "ERC721",
        }
    },
    // Rinkeby
    4: {
        "0x88b48f654c30e99bc2e4a1559b4dcf1ad93fa656": {
            name: "BoredLucky Collection",
            standard: "ERC1155",
        },
        "0xf3e5fa2cc204fda862e4f3dd8069e72d15ddddbb": {
            name: "Dummy Collection",
            standard: "ERC721",
        }
    }
}

async function main() {
    const contract = "0x88b48f654c30e99bc2e4a1559b4dcf1ad93fa656";
    const nftId = "50744890173291188141548913820641530757405226719909589055559939351978193190913";

    const network = await ethers.provider.getNetwork();
    console.log("Network name=", network.name);
    const chainId = network.chainId;
    console.log("Network chain id=", chainId);

    // if (chainId == 1) {
    //     // CryptoPunks
    //     console.log(await getCryptoPunkInfo(chainId, "0xb47e3cd837ddf8e4c57f05d70ab865de6e193bbb", 33));
    //
    //     // Azuki
    //     console.log(await getERC721Info(chainId, "0xed5af388653567af2f388e6224dc7c4b3241c544", 8586));
    //
    //     // Moonbirds
    //     console.log(await getERC721Info(chainId, "0x23581767a106ae21c074b2276d25e5c3e136a68b", 2239));
    //
    //     // Mutant Ape Yacht Club
    //     console.log(await getERC721Info(chainId, "0x60e4d786628fea6478f785a6d7e704777c86a7c6", 18341));
    //
    //     // Bored Ape Yacht Club
    //     console.log(await getERC721Info(chainId, "0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d", 4506));
    // } else if (chainId == 4) {
    //     // BoredLucky Collection
    //     console.log(await getERC1155Info(chainId, "0x88b48f654c30e99bc2e4a1559b4dcf1ad93fa656", "50744890173291188141548913820641530757405226719909589055559939358575262957569"));
    // }
}

export async function getAndCacheRaffleInfo(chainId: number, contract: string, raffleId: number): Promise<RaffleInfo> {
    const cacheDir = "./node_modules/.cache/raffle-metadata-cache"
    fs.mkdirSync(cacheDir, {recursive: true});

    const cacheKey = `${chainId}-${contract}-${raffleId}`;
    const cacheFile = path.join(cacheDir, cacheKey);
    const fileExists = await exists(cacheFile);
    if (fileExists) {
        return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    } else {
        const result = await getRaffleInfo(chainId, contract, raffleId);
        await fs.writeFileSync(cacheFile, JSON.stringify(result));
        return result;
    }
}

export async function getRaffleInfo(chainId: number, contractAddress: string, raffleId: number): Promise<RaffleInfo> {
    const Raffle = await ethers.getContractFactory("Raffle");
    const raffle = Raffle.attach(contractAddress);
    const nftContractAddress = await raffle.nftContract();
    const nftTokenId = await raffle.nftTokenId();
    const nftInfo = await getAndCacheNFTInfo(chainId, nftContractAddress.toLowerCase(), nftTokenId.toString());
    const tickets = await raffle.getTickets();
    const ticketPrice = await raffle.ticketPrice();
    const startTimestamp = await raffle.startTimestamp();
    const endTimestamp = await raffle.endTimestamp();
    return {
        contractAddress,
        startTimestamp: startTimestamp.toNumber(),
        endTimestamp: endTimestamp.toNumber(),
        ticketPrice: ticketPrice.toString(),
        tickets,
        nftContractAddress,
        nftTokenId: nftTokenId.toString(),
        nftStandard: NFT_STANDARDS[nftInfo.standard],
        nftCollection: nftInfo.collection,
        nftTitle: nftInfo.name,
        nftImage: nftInfo.image,
    }
}

export async function getAndCacheNFTInfo(chainId: number, contract: string, nftId: string): Promise<NFTInfo> {
    const cacheDir = "./node_modules/.cache/nft-metadata-cache"
    fs.mkdirSync(cacheDir, {recursive: true});

    const cacheKey = `${chainId}-${contract}-${nftId}`;
    const cacheFile = path.join(cacheDir, cacheKey);
    const fileExists = await exists(cacheFile);
    if (fileExists) {
        return JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    } else {
        const result = await getNFTInfo(chainId, contract, nftId);
        await fs.writeFileSync(cacheFile, JSON.stringify(result));
        return result;
    }
}

export async function getNFTInfo(chainId: number, contract: string, nftId: string): Promise<NFTInfo> {
    const contractInformation = NFT_REGISTRY[chainId][contract];
    switch (contractInformation.standard) {
        case "CryptoPunks":
            return getCryptoPunkInfo(chainId, contract, Number(nftId));
        case "ERC721":
            return getERC721Info(chainId, contract, Number(nftId));
        case "ERC1155":
            return getERC1155Info(chainId, contract, nftId);
        default:
            throw Error("Unknown standard");
    }
}

async function getCryptoPunkInfo(chainId: number, contract: string, nftId: number): Promise<NFTInfo> {
    let CryptopunksData = await ethers.getContractFactory("CryptopunksData");
    let data = await CryptopunksData.attach("0x16F5A35647D6F03D5D3da7b35409D65ba03aF3B2");
    let imageSvg = await data.punkImageSvg(nftId);
    return {
        collection: "CryptoPunks",
        name: `CryptoPunk #${nftId}`,
        image: imageSvg,
        standard: "CryptoPunks",
    };
}

async function getERC721Info(chainId: number, contract: string, nftId: number): Promise<NFTInfo> {
    let ERC721 = await ethers.getContractFactory("ERC721");
    let nft = await ERC721.attach(contract);
    const uri = await nft.tokenURI(nftId);
    if (uri) {
        const processedUri = replaceIpfsUri(uri);
        const response: any = await axios.get(processedUri);
        return {
            collection: NFT_REGISTRY[chainId][contract].name,
            name: response.data.name ?? `${NFT_REGISTRY[chainId][contract].name} #${nftId}`,
            image: replaceIpfsUri(response.data.image),
            standard: "ERC721",
        };
    } else {
        return {
            collection: NFT_REGISTRY[chainId][contract].name,
            name: `${NFT_REGISTRY[chainId][contract].name} #${nftId}`,
            image: "https://testnets.opensea.io/static/images/placeholder.png",
            standard: "ERC721",
        };
    }
}

async function getERC1155Info(chainId: number, contract: string, nftId: string): Promise<NFTInfo> {
    let ERC1155 = await ethers.getContractFactory("ERC1155");
    let nft = await ERC1155.attach(contract);
    const uri = await nft.uri(nftId);
    if (uri) {
        const processedUri = uri.replace("0x{id}", nftId);
        const response: any = await axios.get(processedUri);
        return {
            collection: NFT_REGISTRY[chainId][contract].name,
            name: response.data.name ?? `${NFT_REGISTRY[chainId][contract].name} #${nftId}`,
            image: response.data.image,
            standard: "ERC1155",
        };
    } else {
        return {
            collection: NFT_REGISTRY[chainId][contract].name,
            name: `${NFT_REGISTRY[chainId][contract].name} #${nftId}`,
            image: "https://testnets.opensea.io/static/images/placeholder.png",
            standard: "ERC1155",
        };
    }
}

function replaceIpfsUri(uri: string) {
    return uri.replace("ipfs://", "https://ipfs.io/ipfs/")
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
