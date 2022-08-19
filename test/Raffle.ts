import {expect} from "chai";
import {ethers} from "hardhat";
import {time, loadFixture} from "@nomicfoundation/hardhat-network-helpers";

// must be in sync with Raffle.sol
const RAFFLE_STATES = {
    WaitingForNFT: 0,
    WaitingForStart: 1,
    SellingTickets: 2,
    WaitingForRNG: 3,
    Completed: 4,
    Cancelled: 5,
};

const NFT_STANDARDS = {
    CryptoPunk: 0,
    ERC721: 1,
    ERC1155: 2,
};

const DEFAULT_TICKETS = 100;
const DEFAULT_TICKET_PRICE = 1;

describe("Raffle", function () {
    async function deployFixture() {
        const [owner, otherAccount, thirdAccount] = await ethers.getSigners();

        const ERC721Mock = await ethers.getContractFactory("ERC721Mock");
        const erc721Mock = await ERC721Mock.deploy("DummyNFT", "DUMMY");
        const ERC1155Mock = await ethers.getContractFactory("ERC1155Mock");
        const erc1155Mock = await ERC1155Mock.deploy("https://dummy.nft/{id}");
        const CryptoPunksMarket = await ethers.getContractFactory("CryptoPunksMarket");
        const cryptoPunksMarket = await CryptoPunksMarket.deploy();
        const RaffleFactory = await ethers.getContractFactory("RaffleFactory");
        const raffleFactory = await RaffleFactory.deploy();

        const VRFCoordinatorV2Mock = await ethers.getContractFactory("VRFCoordinatorV2Mock");
        const vrfCoordinatorV2Mock = await VRFCoordinatorV2Mock.deploy("100000000000000000", "1000000000");

        const fundAmount = "1000000000000000000";
        const transaction = await vrfCoordinatorV2Mock.createSubscription();
        const transactionReceipt = await transaction.wait(1);
        const vrfSubscriptionId = ethers.BigNumber.from(transactionReceipt.events![0].topics[1]);
        await vrfCoordinatorV2Mock.fundSubscription(vrfSubscriptionId, fundAmount);
        const vrfKeyHash = "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc";

        const defaultOwner = owner.address;
        const defaultNFTContractAddress = erc721Mock.address;
        const timestamp = await time.latest();
        const defaultStartTimestamp = timestamp + 10000;
        const defaultEndTimestamp = timestamp + 20000;
        const createRaffleFn = (
            {
                owner = defaultOwner,
                nftContractAddress = defaultNFTContractAddress,
                nftTokenId = 0,
                nftStandardId = NFT_STANDARDS.ERC721,
                tickets = DEFAULT_TICKETS,
                ticketPrice = DEFAULT_TICKET_PRICE,
                startTimestamp = defaultStartTimestamp,
                endTimestamp = defaultEndTimestamp,
            }: {
                owner?: string;
                nftContractAddress?: string;
                nftTokenId?: number;
                nftStandardId?: number;
                tickets?: number;
                ticketPrice?: number;
                startTimestamp?: number;
                endTimestamp?: number;
            } = {}) =>
            raffleFactory.createRaffle(
                owner,
                nftContractAddress,
                nftTokenId,
                nftStandardId,
                tickets,
                ticketPrice,
                startTimestamp,
                endTimestamp,
                vrfSubscriptionId,
                vrfCoordinatorV2Mock.address,
                vrfKeyHash
            );

        return {
            owner,
            otherAccount,
            thirdAccount,
            cryptoPunksMarket,
            erc721Mock,
            erc1155Mock,
            raffleFactory,
            createRaffleFn,
            vrfSubscriptionId,
            vrfCoordinatorV2Mock,
            vrfKeyHash,
        };
    }

    async function raffleInWaitingForStartStateFixture(nftStandard: number = NFT_STANDARDS.ERC721) {
        const opts = await loadFixture(deployFixture);

        let nftContractAddress = opts.erc721Mock.address;
        if (nftStandard == NFT_STANDARDS.CryptoPunk) {
            nftContractAddress = opts.cryptoPunksMarket.address;
        } else if (nftStandard == NFT_STANDARDS.ERC1155) {
            nftContractAddress = opts.erc1155Mock.address;
        }

        await opts.createRaffleFn({
            nftContractAddress,
            nftStandardId: nftStandard});
        const raffleAddress = await opts.raffleFactory.getRaffle(0);

        const raffle = await ethers.getContractAt("Raffle", raffleAddress);
        expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.WaitingForNFT);

        if (nftStandard == NFT_STANDARDS.CryptoPunk) {
            await opts.cryptoPunksMarket.setInitialOwners([raffle.address, raffle.address], [0, 1]);
            await opts.cryptoPunksMarket.allInitialOwnersAssigned();
        } else if (nftStandard == NFT_STANDARDS.ERC721) {
            await opts.erc721Mock.mint(raffleAddress, 0);
        } else if (nftStandard == NFT_STANDARDS.ERC1155) {
            await opts.erc1155Mock.mint(raffleAddress, 0, 1, "0x12345678");
        }
        await raffle.verifyNFTPresenceBeforeStart();
        expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.WaitingForStart);

        await opts.vrfCoordinatorV2Mock.addConsumer(opts.vrfSubscriptionId, raffle.address);

        return {
            raffle,
            ...opts,
        };
    }

    async function cryptoPunkRaffleInWaitingForStartStateFixture() {
        return raffleInWaitingForStartStateFixture(NFT_STANDARDS.CryptoPunk);
    }

    async function erc721RaffleInWaitingForStartStateFixture() {
        return raffleInWaitingForStartStateFixture(NFT_STANDARDS.ERC721);
    }

    async function erc1155RaffleInWaitingForStartStateFixture() {
        return raffleInWaitingForStartStateFixture(NFT_STANDARDS.ERC1155);
    }

    async function raffleInSellingTicketsStateFixture(nftStandard: number = NFT_STANDARDS.ERC721) {
        const opts = await raffleInWaitingForStartStateFixture(nftStandard);
        const startTimestamp = await opts.raffle.startTimestamp();
        await time.increaseTo(startTimestamp);

        await opts.raffle.giveawayTicket([{receiverAddress: opts.thirdAccount.address, count: 1}]);
        expect(await opts.raffle.getState()).to.be.equal(RAFFLE_STATES.SellingTickets);
        return opts;
    }

    async function cryptoPunkRaffleInSellingTicketsStateFixture() {
        return raffleInSellingTicketsStateFixture(NFT_STANDARDS.CryptoPunk);
    }

    async function erc721RaffleInSellingTicketsStateFixture() {
        return raffleInSellingTicketsStateFixture(NFT_STANDARDS.ERC721);
    }

    async function erc1155RaffleInSellingTicketsStateFixture() {
        return raffleInSellingTicketsStateFixture(NFT_STANDARDS.ERC1155);
    }

    async function raffleInWaitingForRNGStateFixture(nftStandard: number = NFT_STANDARDS.ERC721) {
        const opts = await raffleInWaitingForStartStateFixture(nftStandard);
        const startTimestamp = await opts.raffle.startTimestamp();
        await time.increaseTo(startTimestamp);

        const tickets = DEFAULT_TICKETS;
        const totalPrice = tickets * DEFAULT_TICKET_PRICE;
        await expect(opts.raffle.purchaseTicket(tickets, {value: totalPrice})).to.changeEtherBalances(
            [opts.owner, opts.raffle.address],
            [-totalPrice, totalPrice]
        );
        expect(await opts.raffle.getState()).to.be.equal(RAFFLE_STATES.WaitingForRNG);
        return opts;
    }

    async function cryptoPunkRaffleInWaitingForRNGStateFixture() {
        return raffleInWaitingForRNGStateFixture(NFT_STANDARDS.CryptoPunk);
    }

    async function erc721RaffleInWaitingForRNGStateFixture() {
        return raffleInWaitingForRNGStateFixture(NFT_STANDARDS.ERC721);
    }

    async function erc1155RaffleInWaitingForRNGStateFixture() {
        return raffleInWaitingForRNGStateFixture(NFT_STANDARDS.ERC1155);
    }

    async function raffleInCompletedStateFixture(nftStandard: number = NFT_STANDARDS.ERC721) {
        const opts = await raffleInWaitingForRNGStateFixture(nftStandard);
        const requestId = await opts.raffle.vrfRequestId();
        await expect(opts.vrfCoordinatorV2Mock.fulfillRandomWords(requestId, opts.raffle.address)).to.emit(
            opts.raffle,
            "WinnerDrawn"
        );
        return opts;
    }

    async function cryptoPunkRaffleInCompletedStateFixture() {
        return raffleInCompletedStateFixture(NFT_STANDARDS.CryptoPunk);
    }

    async function erc721RaffleInCompletedStateFixture() {
        return raffleInCompletedStateFixture(NFT_STANDARDS.ERC721);
    }

    async function erc1155RaffleInCompletedStateFixture() {
        return raffleInCompletedStateFixture(NFT_STANDARDS.ERC1155);
    }

    describe("Creating raffle", function () {
        it("Tickets must be between 1 and 25_000", async function () {
            const {createRaffleFn} = await deployFixture();

            await expect(createRaffleFn({tickets: 0})).to.be.revertedWith("Number of tickets must be greater than 0");
            await expect(createRaffleFn({tickets: 25_000})).not.to.be.reverted;
            await expect(createRaffleFn({tickets: 25_001})).to.be.revertedWith(
                "Number of tickets cannot exceed 25_000"
            );
        });

        it("Start and end timestamp invariants", async function () {
            const {createRaffleFn} = await deployFixture();

            const latestTimestamp = await time.latest();
            await expect(createRaffleFn({startTimestamp: 1})).to.be.revertedWith(
                "Start timestamp cannot be in the past"
            );
            await expect(
                createRaffleFn({
                    startTimestamp: latestTimestamp + 100,
                    endTimestamp: latestTimestamp + 100,
                })
            ).to.be.revertedWith("End timestamp must be after start timestamp");
            await expect(
                createRaffleFn({
                    startTimestamp: latestTimestamp + 100,
                    endTimestamp: latestTimestamp + 200,
                })
            ).not.to.be.reverted;
        });

        it("Cannot use 0x0 as owner", async function () {
            const {createRaffleFn} = await deployFixture();
            await expect(createRaffleFn({owner: "0x0000000000000000000000000000000000000000"})).to.be.revertedWith(
                "Owner cannot be 0x0");
        });

        it("Cannot use 0x0 as nftContractAddress", async function () {
            const {createRaffleFn} = await deployFixture();
            await expect(createRaffleFn({nftContractAddress: "0x0000000000000000000000000000000000000000"})).to.be.revertedWith(
                "NFT contract cannot be 0x0");
        });

        it("Only CryptoPunk, ERC721 and ERC1155 are supported", async function () {
            const {createRaffleFn} = await deployFixture();
            await expect(createRaffleFn({nftStandardId: NFT_STANDARDS.CryptoPunk})).not.to.be.reverted;
            await expect(createRaffleFn({nftStandardId: NFT_STANDARDS.ERC721})).not.to.be.reverted;
            await expect(createRaffleFn({nftStandardId: NFT_STANDARDS.ERC1155})).not.to.be.reverted;
            await expect(createRaffleFn({nftStandardId: 3})).to.be.reverted;
        });

        it("Correct owner after creation", async function () {
            const {otherAccount, raffleFactory, createRaffleFn} = await deployFixture();
            await createRaffleFn({owner: otherAccount.address});
            const raffleAddress = await raffleFactory.getRaffle(0);
            const raffle = await ethers.getContractAt("Raffle", raffleAddress);
            expect(await raffle.owner()).to.be.equal(otherAccount.address);
        });

        it("Correct state after creation (WaitingForNFT)", async function () {
            const {raffleFactory, createRaffleFn} = await deployFixture();
            await createRaffleFn();
            const raffleAddress = await raffleFactory.getRaffle(0);
            const raffle = await ethers.getContractAt("Raffle", raffleAddress);
            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.WaitingForNFT);
        });
    });

    describe("Verifying that raffle has correct NFT before start", function () {
        it("verifyNFTPresenceBeforeStart (CryptoPunk) changes state to WaitingForStart only for correct NFT", async function () {
            const {otherAccount, cryptoPunksMarket, raffleFactory, createRaffleFn} = await deployFixture();

            await createRaffleFn({
                nftContractAddress: cryptoPunksMarket.address,
                nftStandardId: NFT_STANDARDS.CryptoPunk
            });
            const raffleAddress = await raffleFactory.getRaffle(0);
            const raffle = await ethers.getContractAt("Raffle", raffleAddress);

            await cryptoPunksMarket.setInitialOwners([otherAccount.address, otherAccount.address], [0, 1]);
            await cryptoPunksMarket.allInitialOwnersAssigned();
            await raffle.verifyNFTPresenceBeforeStart();
            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.WaitingForNFT);

            const cryptoPunksMarketWithSigner = cryptoPunksMarket.connect(otherAccount);
            await cryptoPunksMarketWithSigner.transferPunk(raffleAddress, 0);
            await raffle.verifyNFTPresenceBeforeStart();
            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.WaitingForStart);

            await expect(raffle.verifyNFTPresenceBeforeStart()).to.be.revertedWith("Must be in WaitingForNFT");
        });

        it("verifyNFTPresenceBeforeStart (ERC721) changes state to WaitingForStart only for correct NFT", async function () {
            const {otherAccount, erc721Mock, raffleFactory, createRaffleFn} = await deployFixture();

            await createRaffleFn();
            const raffleAddress = await raffleFactory.getRaffle(0);
            const raffle = await ethers.getContractAt("Raffle", raffleAddress);

            await erc721Mock.mint(otherAccount.address, 0);
            await erc721Mock.mint(otherAccount.address, 1);
            await raffle.verifyNFTPresenceBeforeStart();
            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.WaitingForNFT);

            const erc721MockWithSigner = erc721Mock.connect(otherAccount);
            await erc721MockWithSigner.transferFrom(otherAccount.address, raffleAddress, 1);
            await raffle.verifyNFTPresenceBeforeStart();
            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.WaitingForNFT);

            await erc721MockWithSigner.transferFrom(otherAccount.address, raffleAddress, 0);
            await raffle.verifyNFTPresenceBeforeStart();
            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.WaitingForStart);

            await expect(raffle.verifyNFTPresenceBeforeStart()).to.be.revertedWith("Must be in WaitingForNFT");
        });


        it("verifyNFTPresenceBeforeStart (ERC1155) changes state to WaitingForStart only for correct NFT", async function () {
            const {otherAccount, erc1155Mock, raffleFactory, createRaffleFn} = await deployFixture();

            await createRaffleFn({
                nftContractAddress: erc1155Mock.address,
                nftStandardId: NFT_STANDARDS.ERC1155
            })
            const raffleAddress = await raffleFactory.getRaffle(0);
            const raffle = await ethers.getContractAt("Raffle", raffleAddress);

            await erc1155Mock.mint(otherAccount.address, 0, 1, "0x12345678");
            await erc1155Mock.mint(otherAccount.address, 1, 1, "0x12345678");
            await raffle.verifyNFTPresenceBeforeStart();
            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.WaitingForNFT);

            const erc1155MockWithSigner = erc1155Mock.connect(otherAccount);
            await erc1155MockWithSigner.safeTransferFrom(otherAccount.address, raffleAddress, 1, 1, "0x12345678");
            await raffle.verifyNFTPresenceBeforeStart();
            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.WaitingForNFT);

            await erc1155MockWithSigner.safeTransferFrom(otherAccount.address, raffleAddress, 0, 1, "0x12345678");
            await raffle.verifyNFTPresenceBeforeStart();
            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.WaitingForStart);

            await expect(raffle.verifyNFTPresenceBeforeStart()).to.be.revertedWith("Must be in WaitingForNFT");
        });
    });

    describe("Cancelling raffle before start", function () {
        it("Canceling in WaitingForNFT state", async function () {
            const {raffleFactory, createRaffleFn} = await deployFixture();
            await createRaffleFn();
            const raffleAddress = await raffleFactory.getRaffle(0);

            const raffle = await ethers.getContractAt("Raffle", raffleAddress);
            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.WaitingForNFT);
            await raffle.cancelBeforeStart();
            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.Cancelled);
        });

        it("Canceling in WaitingForStart state", async function () {
            const {raffle} = await erc721RaffleInWaitingForStartStateFixture();

            await raffle.cancelBeforeStart();
            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.Cancelled);
        });

        it("Non-owner cannot cancel raffle in WaitingForStart state", async function () {
            const {otherAccount, raffle} = await erc721RaffleInWaitingForStartStateFixture();

            const raffleWithSigner = raffle.connect(otherAccount);
            await expect(raffleWithSigner.cancelBeforeStart()).to.be.reverted;
            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.WaitingForStart);
        });
    });

    describe("Owner can get back NFT in Cancelled state", function () {
        it("transferNFTToOwnerIfCancelled for CryptoPunks/ERC721/ERC1155 should work in Cancelled state", async function () {
            const {owner, cryptoPunksMarket, erc721Mock, erc1155Mock, raffle} = await cryptoPunkRaffleInWaitingForStartStateFixture();
            await erc721Mock.mint(raffle.address, 0);
            await erc1155Mock.mint(raffle.address, 0, 1, "0x12345678");

            expect(await cryptoPunksMarket.balanceOf(owner.address)).to.be.equal(0);
            expect(await erc721Mock.ownerOf(0)).to.be.equal(raffle.address);
            expect(await erc1155Mock.balanceOf(raffle.address, 0)).to.be.equal(1);

            await raffle.cancelBeforeStart();
            await raffle.transferNFTToOwnerIfCancelled(NFT_STANDARDS.CryptoPunk, cryptoPunksMarket.address, 0);
            await raffle.transferNFTToOwnerIfCancelled(NFT_STANDARDS.CryptoPunk, cryptoPunksMarket.address, 1);
            await raffle.transferNFTToOwnerIfCancelled(NFT_STANDARDS.ERC721, erc721Mock.address, 0);
            await raffle.transferNFTToOwnerIfCancelled(NFT_STANDARDS.ERC1155, erc1155Mock.address, 0);

            expect(await cryptoPunksMarket.balanceOf(raffle.address)).to.be.equal(0);
            expect(await cryptoPunksMarket.balanceOf(owner.address)).to.be.equal(2);
            expect(await erc721Mock.ownerOf(0)).to.be.equal(owner.address);
            expect(await erc1155Mock.balanceOf(raffle.address, 0)).to.be.equal(0);
            expect(await erc1155Mock.balanceOf(owner.address, 0)).to.be.equal(1)
        });
    });

    describe("Transitioning into SellingTickets state", function () {
        it("Purchasing or ticket in WaitingForStart after startTimestamp transitions into SellingTickets", async function () {
            const {raffle} = await raffleInWaitingForStartStateFixture();
            const startTimestamp = await raffle.startTimestamp();
            const endTimestamp = await raffle.endTimestamp();

            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.WaitingForStart);
            await expect(raffle.purchaseTicket(1, {value: DEFAULT_TICKET_PRICE})).to.be.reverted;

            await time.increaseTo(startTimestamp);
            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.WaitingForStart);
            await expect(await raffle.purchaseTicket(1, {value: DEFAULT_TICKET_PRICE})).not.to.be.reverted;
            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.SellingTickets);

            await time.increaseTo(endTimestamp);
            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.SellingTickets);
            await expect(raffle.purchaseTicket(1, {value: 1})).to.be.revertedWith(
                "End timestamp must be in the past"
            );
            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.SellingTickets);
        });

        it("Giveaway ticket in WaitingForStart after startTimestamp transitions into SellingTickets", async function () {
            const {owner, raffle} = await raffleInWaitingForStartStateFixture();
            const startTimestamp = await raffle.startTimestamp();
            const endTimestamp = await raffle.endTimestamp();

            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.WaitingForStart);
            await expect(raffle.giveawayTicket([{receiverAddress: owner.address, count: 1}])).not.to.be.reverted;

            await time.increaseTo(startTimestamp);
            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.WaitingForStart);
            await expect(raffle.giveawayTicket([{receiverAddress: owner.address, count: 1}])).not.to.be.reverted;
            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.SellingTickets);

            await time.increaseTo(endTimestamp);
            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.SellingTickets);
            await expect(raffle.giveawayTicket([{receiverAddress: owner.address, count: 1}])).to.be.revertedWith(
                "End timestamp must be in the past"
            );
            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.SellingTickets);
        });
    });

    describe("Purchasing tickets", function () {
        it("Purchasing is only possible in SellingTickets state and between startTimestamp and endTimestamp", async function () {
            const {owner, raffle} = await raffleInWaitingForStartStateFixture();
            const startTimestamp = await raffle.startTimestamp();
            await time.increaseTo(startTimestamp);

            await expect(raffle.purchaseTicket(1, {value: 1})).to.changeEtherBalances(
                [owner, raffle.address],
                [-1, 1]
            );
            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.SellingTickets);
            await expect(raffle.purchaseTicket(99, {value: 99})).to.changeEtherBalances(
                [owner, raffle.address],
                [-99, 99]
            );
            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.WaitingForRNG);
        });

        it("Cannot buy 0 tickets", async function () {
            const {raffle} = await raffleInSellingTicketsStateFixture();

            await expect(raffle.purchaseTicket(0, {value: 0})).to.be.revertedWith("Ticket count must be more than 0");
        });

        it("Cannot buy more than ticketsLeft", async function () {
            const {raffle} = await raffleInSellingTicketsStateFixture();

            await expect(raffle.purchaseTicket(100, {value: 100 * DEFAULT_TICKET_PRICE})).to.be.revertedWith(
                "Assigning too many tickets at once"
            );
        });

        it("Cannot buy for incorrect price", async function () {
            const {raffle} = await raffleInSellingTicketsStateFixture();

            await expect(raffle.purchaseTicket(1, {value: 0})).to.be.revertedWith(
                "Incorrect purchase amount (must be ticketPrice * count)"
            );
            await expect(raffle.purchaseTicket(1, {value: 2})).to.be.revertedWith(
                "Incorrect purchase amount (must be ticketPrice * count)"
            );
        });

        it("Owner cannot use transferNFTToOwnerIfCancelled (CryptoPunk) in SellingTickets state", async function () {
            const {raffle} = await cryptoPunkRaffleInSellingTicketsStateFixture();

            await expect(
                raffle.transferNFTToOwnerIfCancelled(NFT_STANDARDS.CryptoPunk, raffle.address, raffle.nftTokenId())
            ).to.be.revertedWith("Must be in Cancelled");
        });

        it("Owner cannot use transferNFTToOwnerIfCancelled (ERC721) in SellingTickets state", async function () {
            const {raffle} = await raffleInSellingTicketsStateFixture();

            await expect(
                raffle.transferNFTToOwnerIfCancelled(NFT_STANDARDS.ERC721, raffle.address, raffle.nftTokenId())
            ).to.be.revertedWith("Must be in Cancelled");
        });

        it("Owner cannot use transferNFTToOwnerIfCancelled (CryptoPunk) in SellingTickets state", async function () {
            const {raffle} = await erc1155RaffleInSellingTicketsStateFixture();

            await expect(
                raffle.transferNFTToOwnerIfCancelled(NFT_STANDARDS.ERC1155, raffle.address, raffle.nftTokenId())
            ).to.be.revertedWith("Must be in Cancelled");
        });
    });

    describe("Giveaway tickets", function () {
        it("It is possible to giveaway tickets to anyone", async function () {
            const {owner, otherAccount, raffle} = await raffleInSellingTicketsStateFixture();

            await raffle.giveawayTicket([
                {receiverAddress: owner.address, count: 10},
                {receiverAddress: otherAccount.address, count: 20},
            ]);
            expect(await raffle.getAssignedTicketCount(owner.address)).to.be.equal(10);
            expect(await raffle.getAssignedTicketCount(otherAccount.address)).to.be.equal(20);
        });
    });

    describe("Canceling raffle after start", function () {
        it("Raffle cannot be cancelled in SellingTickets state", async function () {
            const {raffle} = await raffleInSellingTicketsStateFixture();

            await expect(raffle.cancelBeforeStart()).to.be.revertedWith("Must be in WaitingForNFT or WaitingForStart");
            await expect(raffle.cancelIfUnsold()).to.be.revertedWith("End timestamp must be in the past");
            await expect(raffle.cancelIfNoRNG()).to.be.revertedWith("Must be in WaitingForRNG");
        });
    });

    describe("Refunding tickets", function () {
        it("It is not possible to get refund in SellingTickets, WaitingForRNG and Completed states", async function () {
            const {owner, raffle, vrfCoordinatorV2Mock} = await raffleInWaitingForStartStateFixture();
            const startTimestamp = await raffle.startTimestamp();
            await time.increaseTo(startTimestamp);

            const ticketCount = 10;
            const ticketValue = ticketCount * DEFAULT_TICKET_PRICE;
            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.WaitingForStart);
            await raffle.purchaseTicket(ticketCount, {value: ticketValue});
            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.SellingTickets);
            await expect(raffle.transferTicketRefundIfCancelled()).to.be.revertedWith("Must be in Cancelled");
            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.SellingTickets);
            await raffle.giveawayTicket([{receiverAddress: owner.address, count: 90}]);
            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.WaitingForRNG);
            await expect(raffle.transferTicketRefundIfCancelled()).to.be.revertedWith("Must be in Cancelled");

            const requestId = await raffle.vrfRequestId();
            await expect(vrfCoordinatorV2Mock.fulfillRandomWords(requestId, raffle.address)).to.emit(
                raffle,
                "WinnerDrawn"
            );

            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.Completed);
            await expect(raffle.transferTicketRefundIfCancelled()).to.be.revertedWith("Must be in Cancelled");
        });

        it("It is possible to get refund in Cancelled state", async function () {
            const {owner, raffle} = await raffleInWaitingForStartStateFixture();
            const startTimestamp = await raffle.startTimestamp();
            const endTimestamp = await raffle.endTimestamp();
            await time.increaseTo(startTimestamp);

            const ticketCount = 10;
            const ticketValue = ticketCount * DEFAULT_TICKET_PRICE;
            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.WaitingForStart);
            await raffle.purchaseTicket(ticketCount, {value: ticketValue});
            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.SellingTickets);
            await time.increaseTo(endTimestamp);
            await expect(raffle.cancelIfUnsold()).not.to.be.reverted;
            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.Cancelled);

            await expect(raffle.transferTicketRefundIfCancelled()).to.changeEtherBalance(raffle, -ticketValue);
            await expect(raffle.withdrawPayments(owner.address)).to.changeEtherBalance(owner, ticketValue);
            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.Cancelled);
        });

        it("There should be no refunds for giveaway tickets", async function () {
            const {owner, raffle} = await raffleInWaitingForStartStateFixture();
            const startTimestamp = await raffle.startTimestamp();
            const endTimestamp = await raffle.endTimestamp();
            await time.increaseTo(startTimestamp);

            const ticketCount = 10;
            await raffle.giveawayTicket([{receiverAddress: owner.address, count: ticketCount}]);
            await time.increaseTo(endTimestamp);
            await expect(raffle.cancelIfUnsold()).not.to.be.reverted;
            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.Cancelled);
            await expect(raffle.transferTicketRefundIfCancelled()).to.changeEtherBalance(raffle, 0);
            await expect(raffle.withdrawPayments(owner.address)).to.changeEtherBalance(owner, 0);
            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.Cancelled);
        });
    });

    describe("Transitioning into WaitingForRNG state", function () {
        it("Purchasing of last ticket before endTimestamp should transition into WaitingForRNG state", async function () {
            const {raffle} = await raffleInSellingTicketsStateFixture();

            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.SellingTickets);
            await raffle.purchaseTicket(98, {value: 98 * DEFAULT_TICKET_PRICE});
            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.SellingTickets);
            await raffle.purchaseTicket(1, {value: DEFAULT_TICKET_PRICE});
            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.WaitingForRNG);
        });

        it("Giveaway of last ticket before endTimestamp should transition into WaitingForRNG state", async function () {
            const {owner, raffle} = await raffleInSellingTicketsStateFixture();

            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.SellingTickets);
            await raffle.purchaseTicket(98, {value: 98 * DEFAULT_TICKET_PRICE});
            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.SellingTickets);
            await raffle.giveawayTicket([{receiverAddress: owner.address, count: 1}]);
            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.WaitingForRNG);
        });

        describe("Owner cannot get back NFT during WaitingForRNG state", function () {
            it("Using transferNFTToOwnerIfCancelled (CryptoPunk)", async function () {
                const {raffle} = await cryptoPunkRaffleInWaitingForRNGStateFixture();

                await expect(raffle.transferNFTToOwnerIfCancelled(NFT_STANDARDS.CryptoPunk, raffle.address, raffle.nftTokenId())).to.be.revertedWith(
                    "Must be in Cancelled"
                );
            });

            it("Using transferNFTToOwnerIfCancelled (ERC721)", async function () {
                const {raffle} = await erc721RaffleInWaitingForRNGStateFixture();

                await expect(raffle.transferNFTToOwnerIfCancelled(NFT_STANDARDS.ERC721, raffle.address, raffle.nftTokenId())).to.be.revertedWith(
                    "Must be in Cancelled"
                );
            });

            it("Using transferNFTToOwnerIfCancelled (ERC1155)", async function () {
                const {raffle} = await erc1155RaffleInWaitingForRNGStateFixture();

                await expect(raffle.transferNFTToOwnerIfCancelled(NFT_STANDARDS.ERC1155, raffle.address, raffle.nftTokenId())).to.be.revertedWith(
                    "Must be in Cancelled"
                );
            });
        });
    });

    describe("Generating and receiving random number", function () {
        it("Receiving random number from Chainlink VRF", async function () {
            const {raffle, vrfCoordinatorV2Mock} = await raffleInWaitingForRNGStateFixture();

            const requestId = await raffle.vrfRequestId();
            await expect(vrfCoordinatorV2Mock.fulfillRandomWords(requestId, raffle.address)).to.emit(
                raffle,
                "WinnerDrawn"
            );
            expect(await raffle.vrfRandomWords(0)).to.be.gt(0, "First random number is greater than zero");
        });
    });

    describe("Canceling raffle if not received random number", function () {
        it("If there is no fulfillRandomWords response within 1 day, we can transition into Cancelled state", async function () {
            const {raffle} = await raffleInWaitingForRNGStateFixture();

            await expect(raffle.cancelIfNoRNG()).to.be.revertedWith("End timestamp + 1 day must be in the past");
            const endTimestamp = await raffle.endTimestamp();
            await time.increaseTo(endTimestamp);
            await time.increase(12 * 60 * 60);
            await expect(raffle.cancelIfNoRNG()).to.be.revertedWith("End timestamp + 1 day must be in the past");
            await time.increase(12 * 60 * 60);
            await expect(raffle.cancelIfNoRNG()).not.to.be.reverted;
            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.Cancelled);
        });
    });

    describe("Transitioning into Completed state", function () {
        it("After Chainlink VRF invokes fulfillRandomWords winner is drawn and we transition into Completed state", async function () {
            const {raffle, vrfCoordinatorV2Mock} = await raffleInWaitingForRNGStateFixture();

            const requestId = await raffle.vrfRequestId();
            await expect(vrfCoordinatorV2Mock.fulfillRandomWords(requestId, raffle.address)).to.emit(
                raffle,
                "WinnerDrawn"
            );
            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.Completed);
        });
    });

    describe("Claiming ETH and NFT in Completed state", function () {
        it("Owner can get ETH using transferETHToOwnerIfCompleted", async function () {
            const {owner, raffle} = await raffleInCompletedStateFixture();

            const amount = DEFAULT_TICKETS * DEFAULT_TICKET_PRICE;
            await expect(raffle.transferETHToOwnerIfCompleted()).to.changeEtherBalance(raffle, -amount);
            await expect(raffle.withdrawPayments(owner.address)).to.changeEtherBalance(owner, amount);
            expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.Completed);
        });

        describe("Owner cannot get back NFT during Completed state", function () {
            it("Using transferNFTToOwnerIfCancelled (CryptoPunk)", async function () {
                const {raffle} = await cryptoPunkRaffleInCompletedStateFixture();

                await expect(raffle.transferNFTToOwnerIfCancelled(NFT_STANDARDS.CryptoPunk, raffle.address, raffle.nftTokenId())).to.be.revertedWith(
                    "Must be in Cancelled"
                );
            });

            it("Using transferNFTToOwnerIfCancelled (ERC721)", async function () {
                const {raffle} = await erc721RaffleInCompletedStateFixture();

                await expect(raffle.transferNFTToOwnerIfCancelled(NFT_STANDARDS.ERC721, raffle.address, raffle.nftTokenId())).to.be.revertedWith(
                    "Must be in Cancelled"
                );
            });

            it("Using transferNFTToOwnerIfCancelled (ERC1155)", async function () {
                const {raffle} = await erc1155RaffleInCompletedStateFixture();

                await expect(raffle.transferNFTToOwnerIfCancelled(NFT_STANDARDS.ERC1155, raffle.address, raffle.nftTokenId())).to.be.revertedWith(
                    "Must be in Cancelled"
                );
            });
        });

        describe("Raffle winner can get NFT", function () {
            it("Using transferNFTToWinnerIfCompleted (CryptoPunk)", async function () {
                const {owner, cryptoPunksMarket, raffle} = await cryptoPunkRaffleInCompletedStateFixture();

                expect(Number(await cryptoPunksMarket.balanceOf(owner.address))).to.equal(0);
                await raffle.transferNFTToWinnerIfCompleted();
                expect(Number(await cryptoPunksMarket.balanceOf(owner.address))).to.equal(1);
                expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.Completed);
            });

            it("Using transferNFTToWinnerIfCompleted (ERC721)", async function () {
                const {erc721Mock, raffle} = await erc721RaffleInCompletedStateFixture();

                await expect(raffle.transferNFTToWinnerIfCompleted()).to.emit(erc721Mock, "Transfer");
                expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.Completed);
            });

            it("Using transferNFTToWinnerIfCompleted (ERC1155)", async function () {
                const {erc1155Mock, raffle} = await erc1155RaffleInCompletedStateFixture();

                await expect(raffle.transferNFTToWinnerIfCompleted()).to.emit(erc1155Mock, "TransferSingle");
                expect(await raffle.getState()).to.be.equal(RAFFLE_STATES.Completed);
            });
        });
    });

    describe("Getters", function () {
        it("isWinnerDrawn(), getWinnerAddress(), getWinnerTicketNumber(), getWinnerDrawTimestamp()", async function () {
            const {owner, raffle, vrfCoordinatorV2Mock} = await raffleInWaitingForRNGStateFixture();

            expect(await raffle.isWinnerDrawn()).to.be.equal(false);
            expect(await raffle.getWinnerAddress()).to.be.equal("0x0000000000000000000000000000000000000000");
            expect(await raffle.getWinnerTicketNumber()).to.be.equal(0);
            expect(await raffle.getWinnerDrawTimestamp()).to.be.equal(0);

            const requestId = await raffle.vrfRequestId();
            await expect(vrfCoordinatorV2Mock.fulfillRandomWords(requestId, raffle.address)).to.emit(
                raffle,
                "WinnerDrawn"
            );

            expect(await raffle.isWinnerDrawn()).to.be.equal(true);
            expect(await raffle.getWinnerAddress()).to.be.equal(owner.address);
            expect(await raffle.getWinnerTicketNumber()).to.be.lt(DEFAULT_TICKETS);
            expect(await raffle.getWinnerDrawTimestamp()).to.be.gt(0);
        });

        it("getPurchasedTicketCount()", async function () {
            const {owner, raffle} = await raffleInSellingTicketsStateFixture();

            expect(await raffle.getAssignedTicketCount(owner.address)).to.be.equal(0);
            expect(await raffle.getPurchasedTicketCount(owner.address)).to.be.equal(0);

            await raffle.giveawayTicket([{receiverAddress: owner.address, count: 2}]);

            expect(await raffle.getAssignedTicketCount(owner.address)).to.be.equal(2);
            expect(await raffle.getPurchasedTicketCount(owner.address)).to.be.equal(0);

            const tickets = 2;
            const totalPrice = tickets * DEFAULT_TICKET_PRICE;
            await raffle.purchaseTicket(tickets, {value: totalPrice});

            expect(await raffle.getAssignedTicketCount(owner.address)).to.be.equal(4);
            expect(await raffle.getPurchasedTicketCount(owner.address)).to.be.equal(2);
        });
    });
});
