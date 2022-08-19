import {expect} from "chai";
import {ethers} from "hardhat";
import {loadFixture, time} from "@nomicfoundation/hardhat-network-helpers";
import {ERC721Mock, RaffleFactory, VRFCoordinatorV2Mock} from "../typechain-types";
import {ContractTransaction, Signer} from "ethers";

describe("RaffleFactory", function () {
    async function deployFixture() {
        const [owner, creatorAccount, thirdAccount] = await ethers.getSigners();

        const ERC721Mock = await ethers.getContractFactory("ERC721Mock");
        const erc721Mock = await ERC721Mock.deploy("DummyNFT", "DUMMY");
        const RaffleFactory = await ethers.getContractFactory("RaffleFactory");
        const raffleFactory = await RaffleFactory.deploy();
        const VRFCoordinatorV2Mock = await ethers.getContractFactory("VRFCoordinatorV2Mock");
        const vrfCoordinatorV2Mock = await VRFCoordinatorV2Mock.deploy("100000000000000000", "1000000000");

        await raffleFactory.grantRole(raffleFactory.CREATOR_ROLE(), creatorAccount.address);

        return {
            owner,
            creatorAccount,
            thirdAccount,
            erc721Mock,
            raffleFactory,
            vrfCoordinatorV2Mock,
        };
    }

    async function createRaffle(
        owner: Signer,
        erc721Mock: ERC721Mock,
        raffleFactory: RaffleFactory,
        vrfCoordinatorV2Mock: VRFCoordinatorV2Mock): Promise<ContractTransaction> {
        const timestamp = await time.latest();
        const raffleFactoryWithSigner = raffleFactory.connect(owner)
        return raffleFactoryWithSigner.createRaffle(
            await owner.getAddress(),
            erc721Mock.address,
            0,
            1,
            100,
            100,
            timestamp + 10000,
            timestamp + 20000,
            0,
            vrfCoordinatorV2Mock.address,
            "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc");
    }

    describe("Creating raffles", function () {
        it("Only users with CREATOR_ROLE can create raffle", async function () {
            const {
                owner,
                creatorAccount,
                thirdAccount,
                erc721Mock,
                raffleFactory,
                vrfCoordinatorV2Mock
            } = await loadFixture(deployFixture);

            await expect(createRaffle(owner, erc721Mock, raffleFactory, vrfCoordinatorV2Mock)).not.to.be.reverted;
            await expect(createRaffle(creatorAccount, erc721Mock, raffleFactory, vrfCoordinatorV2Mock)).not.to.be.reverted;
            await expect(createRaffle(thirdAccount, erc721Mock, raffleFactory, vrfCoordinatorV2Mock)).to.be.revertedWith(
                "Must have CREATOR_ROLE");
        });
    });

    describe("Events", function () {
        it("Emits RaffleCreated when new raffle is created", async function () {
            const {owner, erc721Mock, raffleFactory, vrfCoordinatorV2Mock} = await loadFixture(deployFixture);

            await expect(createRaffle(owner, erc721Mock, raffleFactory, vrfCoordinatorV2Mock)).to.emit(
                raffleFactory,
                "RaffleCreated");
        });
    });

    describe("Getters", function () {
        it("getRaffleCount() and getRaffle()", async function () {
            const {owner, erc721Mock, raffleFactory, vrfCoordinatorV2Mock} = await loadFixture(deployFixture);

            expect(await raffleFactory.getRaffleCount()).to.be.equal(0);
            await createRaffle(owner, erc721Mock, raffleFactory, vrfCoordinatorV2Mock);
            expect(await raffleFactory.getRaffleCount()).to.be.equal(1);
            await createRaffle(owner, erc721Mock, raffleFactory, vrfCoordinatorV2Mock);
            expect(await raffleFactory.getRaffleCount()).to.be.equal(2);

            const raffle0Address = await raffleFactory.getRaffle(0);
            const raffle1Address = await raffleFactory.getRaffle(1);
            expect(raffle0Address).not.to.be.equal(raffle1Address);
        });
    });
});
