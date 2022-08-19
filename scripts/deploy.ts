import { ethers } from "hardhat";

async function main() {
    // const lockedAmount = ethers.utils.parseEther("1");

    // const ERC721Mock = await ethers.getContractFactory("ERC721Mock");
    // const erc721Mock = await ERC721Mock.deploy("DummyNFT", "DUMMY");
    // await erc721Mock.deployed();
    // console.log("ERC721Mock deployed to:", erc721Mock.address);

    const RaffleFactory = await ethers.getContractFactory("RaffleFactory");
    const raffleFactory = await RaffleFactory.deploy();
    await raffleFactory.deployed();

    // await raffleFactory.grantRole(raffleFactory.CREATOR_ROLE(), "0x7C953d2eb5a34bcdb04514D5F193a6406cc902a4"); // Andrew
    // await raffleFactory.grantRole(raffleFactory.CREATOR_ROLE(), "0x96A9c9306b2Dd2cDF3EeAd63D7D200Aa59420770"); // Philip
    // await raffleFactory.grantRole(raffleFactory.CREATOR_ROLE(), "0x50b2dE3411AcCD6A4ba15653A5682594345e1FE5"); // Marjana
    // await raffleFactory.grantRole(raffleFactory.CREATOR_ROLE(), "0x7030970b77A08e40B0FcCa39F59aEB112d34fd46"); // Lyuba
    // await raffleFactory.grantRole(raffleFactory.CREATOR_ROLE(), "0x63d1025b525272e9ac23d6ca1d8ab33353592994"); // Natalija
    // await raffleFactory.grantRole(raffleFactory.CREATOR_ROLE(), "0x641694021d66883b3Fd48FDA136014E4179337f1"); // Valery

    console.log("RaffleFactory deployed to:", raffleFactory.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
