import { ethers } from "hardhat";
import {getAndCacheNFTInfo, getAndCacheRaffleInfo, getNFTInfo} from "./query-rinkeby";

async function main() {
    const network = await ethers.provider.getNetwork();
    const chainId = network.chainId;

    const Raffle = await ethers.getContractFactory("Raffle");
    const RaffleFactory = await ethers.getContractFactory("RaffleFactory");
    const raffleFactory = await RaffleFactory.attach("0x3933707870282875924b2E82c55E2Bdcbcd7b056");

    const raffleCount = await raffleFactory.getRaffleCount()
    console.log(`There are ${raffleCount} raffles\n`);
    const raffles = [];
    for (let i = 0; i < raffleCount.toNumber(); i++) {
        const raffleContractAddress = await raffleFactory.getRaffle(i);
        raffles.push(await getAndCacheRaffleInfo(chainId, raffleContractAddress, i))
    }
    console.log(raffles);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
