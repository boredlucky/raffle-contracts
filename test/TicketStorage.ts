import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("TicketStorage", function () {
    async function deployFixture() {
        const [owner, otherAccount, thirdAccount] = await ethers.getSigners();

        const TicketStorage = await ethers.getContractFactory("TicketStorageMock");
        const ticketStorage = await TicketStorage.deploy(100);

        return {
            owner,
            otherAccount,
            thirdAccount,
            TicketStorage,
            ticketStorage,
        };
    }

    describe("Creating ticket storage", function () {
        it("Tickets must be between 1 and 25_000", async function () {
            const { TicketStorage } = await loadFixture(deployFixture);

            await expect(TicketStorage.deploy(0)).to.be.revertedWith("Number of tickets must be greater than 0");
            await expect(TicketStorage.deploy(25_000)).not.to.be.reverted;
            await expect(TicketStorage.deploy(25_001)).to.be.revertedWith("Number of tickets cannot exceed 25_000");
        });
    });

    describe("TicketsAssigned event", function () {
        it("Should be emitted when new ticket ranges are assigned", async function () {
            const { owner, otherAccount, ticketStorage } = await loadFixture(deployFixture);

            await expect(ticketStorage.assignTickets(owner.address, 1))
                .to.emit(ticketStorage, "TicketsAssigned")
                .withArgs([owner.address, 0, 0], 99);
            await expect(ticketStorage.assignTickets(otherAccount.address, 10))
                .to.emit(ticketStorage, "TicketsAssigned")
                .withArgs([otherAccount.address, 1, 10], 89);
        });
    });

    describe("Finding owner of a ticket", function () {
        it("Fails if there are non-assigned tickets", async function () {
            const { ticketStorage } = await loadFixture(deployFixture);

            await expect(ticketStorage.findOwnerOfTicketNumber(1000)).to.be.revertedWith(
                "Ticket number does not exist"
            );
            await expect(ticketStorage.findOwnerOfTicketNumber(0)).to.be.revertedWith("Not all tickets are assigned");
        });

        it("Assign one ticket range of 100 tickets to one owner", async function () {
            const { owner, ticketStorage } = await loadFixture(deployFixture);

            await ticketStorage.assignTickets(owner.address, 100);
            expect(await ticketStorage.findOwnerOfTicketNumber(0)).to.be.equal(owner.address);
        });

        it("Assigning too many tickets at once", async function () {
            const { owner, ticketStorage } = await loadFixture(deployFixture);

            await ticketStorage.assignTickets(owner.address, 10);
            await expect(ticketStorage.assignTickets(owner.address, 100)).to.be.revertedWith(
                "Assigning too many tickets at once"
            );
            await ticketStorage.assignTickets(owner.address, 89);
            await expect(ticketStorage.assignTickets(owner.address, 2)).to.be.revertedWith(
                "Assigning too many tickets at once"
            );
            await ticketStorage.assignTickets(owner.address, 1);
            await expect(ticketStorage.assignTickets(owner.address, 1)).to.be.revertedWith("All tickets are assigned");
        });

        it("Assigning many 1-ticket ranges", async function () {
            const { owner, otherAccount, thirdAccount, ticketStorage } = await loadFixture(deployFixture);

            await ticketStorage.assignTickets(otherAccount.address, 1);
            await ticketStorage.bulkAssignTickets(owner.address, 98);
            await ticketStorage.assignTickets(thirdAccount.address, 1);
            expect(await ticketStorage.findOwnerOfTicketNumber(0)).to.be.equal(otherAccount.address);
            expect(await ticketStorage.findOwnerOfTicketNumber(1)).to.be.equal(owner.address);
            expect(await ticketStorage.findOwnerOfTicketNumber(50)).to.be.equal(owner.address);
            expect(await ticketStorage.findOwnerOfTicketNumber(98)).to.be.equal(owner.address);
            expect(await ticketStorage.findOwnerOfTicketNumber(99)).to.be.equal(thirdAccount.address);
        });

        it("Mixed 1 and N-ticket ranges", async function () {
            const { owner, otherAccount, thirdAccount, ticketStorage } = await loadFixture(deployFixture);

            await ticketStorage.assignTickets(otherAccount.address, 1);
            await ticketStorage.bulkAssignTickets(owner.address, 19);
            await ticketStorage.assignTickets(otherAccount.address, 30);
            await ticketStorage.assignTickets(thirdAccount.address, 30);
            await ticketStorage.assignTickets(owner.address, 20);
            expect(await ticketStorage.findOwnerOfTicketNumber(0)).to.be.equal(otherAccount.address);
            expect(await ticketStorage.findOwnerOfTicketNumber(10)).to.be.equal(owner.address);
            expect(await ticketStorage.findOwnerOfTicketNumber(25)).to.be.equal(otherAccount.address);
            expect(await ticketStorage.findOwnerOfTicketNumber(45)).to.be.equal(otherAccount.address);
            expect(await ticketStorage.findOwnerOfTicketNumber(55)).to.be.equal(thirdAccount.address);
            expect(await ticketStorage.findOwnerOfTicketNumber(75)).to.be.equal(thirdAccount.address);
            expect(await ticketStorage.findOwnerOfTicketNumber(99)).to.be.equal(owner.address);

            const counters = {
                [owner.address]: 0,
                [otherAccount.address]: 0,
                [thirdAccount.address]: 0,
            };
            const promises = [...Array(100)].map(async (_, i) => {
                counters[await ticketStorage.findOwnerOfTicketNumber(i)] += 1;
            });
            await Promise.all(promises);
            expect(counters[owner.address]).to.be.equal(39);
            expect(counters[otherAccount.address]).to.be.equal(31);
            expect(counters[thirdAccount.address]).to.be.equal(30);
        });

        describe("Worst-case scenarios (takes a while)", function () {
            xit("Assign 5000 1-ticket ranges", async function () {
                const { owner, otherAccount, thirdAccount, TicketStorage } = await loadFixture(deployFixture);

                const ticketStorage = await TicketStorage.deploy(5000);
                await ticketStorage.assignTickets(otherAccount.address, 1);
                const promises = [...Array(9)].map((_, i) => {
                    ticketStorage.bulkAssignTickets(owner.address, 500);
                });
                await ticketStorage.bulkAssignTickets(owner.address, 498);
                await ticketStorage.assignTickets(thirdAccount.address, 1);
                await Promise.all(promises);

                expect(await ticketStorage.estimateGas.findOwnerOfTicketNumber(0)).to.be.lt(100_000);
                expect(await ticketStorage.estimateGas.findOwnerOfTicketNumber(2500)).to.be.lt(100_000);
                expect(await ticketStorage.estimateGas.findOwnerOfTicketNumber(4999)).to.be.lt(100_000);

                expect(await ticketStorage.findOwnerOfTicketNumber(0)).to.be.equal(otherAccount.address);
                expect(await ticketStorage.findOwnerOfTicketNumber(1)).to.be.equal(owner.address);
                expect(await ticketStorage.findOwnerOfTicketNumber(2499)).to.be.equal(owner.address);
                expect(await ticketStorage.findOwnerOfTicketNumber(2500)).to.be.equal(owner.address);
                expect(await ticketStorage.findOwnerOfTicketNumber(2501)).to.be.equal(owner.address);
                expect(await ticketStorage.findOwnerOfTicketNumber(4998)).to.be.equal(owner.address);
                expect(await ticketStorage.findOwnerOfTicketNumber(4999)).to.be.equal(thirdAccount.address);
            });
            xit("Assign 25000 1-ticket ranges", async function () {
                const { owner, otherAccount, thirdAccount, TicketStorage } = await loadFixture(deployFixture);

                const ticketStorage = await TicketStorage.deploy(25000);
                await ticketStorage.assignTickets(otherAccount.address, 1);
                const promises = [...Array(49)].map((_, i) => {
                    ticketStorage.bulkAssignTickets(owner.address, 500);
                });
                await ticketStorage.bulkAssignTickets(owner.address, 498);
                await ticketStorage.assignTickets(thirdAccount.address, 1);
                await Promise.all(promises);

                expect(await ticketStorage.estimateGas.findOwnerOfTicketNumber(0)).to.be.lt(100_000);
                expect(await ticketStorage.estimateGas.findOwnerOfTicketNumber(12500)).to.be.lt(100_000);
                expect(await ticketStorage.estimateGas.findOwnerOfTicketNumber(24999)).to.be.lt(100_000);

                expect(await ticketStorage.findOwnerOfTicketNumber(0)).to.be.equal(otherAccount.address);
                expect(await ticketStorage.findOwnerOfTicketNumber(1)).to.be.equal(owner.address);
                expect(await ticketStorage.findOwnerOfTicketNumber(12499)).to.be.equal(owner.address);
                expect(await ticketStorage.findOwnerOfTicketNumber(12500)).to.be.equal(owner.address);
                expect(await ticketStorage.findOwnerOfTicketNumber(12501)).to.be.equal(owner.address);
                expect(await ticketStorage.findOwnerOfTicketNumber(24998)).to.be.equal(owner.address);
                expect(await ticketStorage.findOwnerOfTicketNumber(24999)).to.be.equal(thirdAccount.address);
            });
        });
    });

    describe("Getters", function () {
        it("tickets() and ticketsLeft()", async function () {
            const { owner, otherAccount, ticketStorage } = await loadFixture(deployFixture);

            expect(await ticketStorage.getTickets()).to.be.equal(100);
            expect(await ticketStorage.getTicketsLeft()).to.be.equal(100);
            await ticketStorage.assignTickets(owner.address, 1);
            expect(await ticketStorage.getTickets()).to.be.equal(100);
            expect(await ticketStorage.getTicketsLeft()).to.be.equal(99);
            await ticketStorage.assignTickets(owner.address, 99);
            expect(await ticketStorage.getTickets()).to.be.equal(100);
            expect(await ticketStorage.getTicketsLeft()).to.be.equal(0);
        });

        it("getAssignedTicketCount(), getAssignedTicketNumberRanges() and getAssignedTicketNumberRange()", async function () {
            const { owner, ticketStorage } = await loadFixture(deployFixture);

            expect(await ticketStorage.getAssignedTicketCount(owner.address)).to.be.equal(0);
            await ticketStorage.assignTickets(owner.address, 1);
            expect(await ticketStorage.getAssignedTicketCount(owner.address)).to.be.equal(1);
            expect(await ticketStorage.getAssignedTicketNumberRanges(owner.address)).to.be.equal(1);
            expect(await ticketStorage.getAssignedTicketNumberRange(owner.address, 0)).to.be.equal(0);
            let ticketNumberRange0 = await ticketStorage.getTicketNumberRange(0);
            expect(ticketNumberRange0.owner).to.be.equal(owner.address);
            expect(ticketNumberRange0.from).to.be.equal(0);
            expect(ticketNumberRange0.to).to.be.equal(0);

            await ticketStorage.assignTickets(owner.address, 9);
            expect(await ticketStorage.getAssignedTicketCount(owner.address)).to.be.equal(10);
            expect(await ticketStorage.getAssignedTicketNumberRanges(owner.address)).to.be.equal(2);
            expect(await ticketStorage.getAssignedTicketNumberRange(owner.address, 1)).to.be.equal(1);
            let ticketNumberRange1 = await ticketStorage.getTicketNumberRange(1);
            expect(ticketNumberRange1.owner).to.be.equal(owner.address);
            expect(ticketNumberRange1.from).to.be.equal(1);
            expect(ticketNumberRange1.to).to.be.equal(9);
        });
    });
});
