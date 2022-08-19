# Overview

Requirements:
* Maximum number of tickets: **25000**
* EVM blockchain, payments in native token (ETH in case of Ethereum)
* Users can purchase any amount of available tickets at once
* Fair chance of winning, draw using [Chainlink VRF](https://docs.chain.link/docs/chainlink-vrf/)
* Ability to cancel raffle:
  * Recovering NFT from raffle contract
  * Users can get back their funds

Additional requirements:
* Ability to giveaway tickets
* Support for ERC721, ERC1155 and [CryptoPunks](https://etherscan.io/address/0xb47e3cd837ddf8e4c57f05d70ab865de6e193bbb)

# Implementation

New raffles are created using `RaffleFactory.createRaffle()`. Following arguments must be specified during creation:
* `address owner` -- raffle `owner` will be able to giveaway tickets and cancel raffle in case if it was not properly created/setup
* `address nftContract` -- NFT contract address 
* `uint256 nftTokenId` --  NFT id
* `uint256 nftStandardId` --  later will be converted into enum, what type of NFT it is (ERC721, ERC1155 or CryptoPunk)
* `uint16 tickets` -- ticket count
* `uint256 ticketPrice` -- price of one ticket in [wei](https://eth-converter.com/)
* `uint256 startTimestamp` -- [timestamp](https://www.unixtimestamp.com/) when users can start purchasing tickets
* `uint256 endTimestamp` -- [timestamp](https://www.unixtimestamp.com/) after which raffle can be canceled if not soldout
* `uint64 vrfSubscriptionId` see [Chainlink VRF subscriptions docs](https://docs.chain.link/docs/chainlink-vrf/#subscriptions)
* `address vrfCoordinator` -- see [Chainlink VRF contracts docs](https://docs.chain.link/docs/vrf-contracts/#ethereum-mainnet)
* `bytes32 vrfKeyHash`-- see [Chainlink VR contracts docs](https://docs.chain.link/docs/vrf-contracts/#ethereum-mainnet)


## Life cycle

* After the raffle was created, it has **WaitingForNFT** state.
  * It is possible for `owner` to `cancelBeforeStart()` and transition into **Cancelled** state

* After the correct NFT (`nftContract` and `nftTokenId` must match) is transferred to raffle contract it can transition into **WaitingForStart** state
  * It is possible for `owner` to `cancelBeforeStart()` and transition into **Cancelled** state

* In **WaitingForStart** before `startTimestamp` users cannot `purchaseTicket()`, but `owner` can `giveawayTicket()`
  * It is possible for `owner` to `cancelBeforeStart()` and transition into **Cancelled** state

* In **WaitingForStart** after `startTimestamp` users can start purchasing tickets. As soon as first `purchaseTicket()` or `giveawayTicket()`, raffle transitions into **SellingTickets** state
  * It is not possible for `owner` to `cancelBeforeStart()` at this stage
  * It is not possible to `purchaseTicket()` or `giveawayTicket()` after `endTimestamp`,
  * Anyone can `cancelIfUnsold()` after `endTimestamp` and transition info **Cancelled** state

* When last ticket is `purchaseTicket()` or `giveawayTicket()` before `endTimestamp`, raffle transitions into `WaitingForRNG` state
  * Random number is requested from Chainlink VRF 
  * It is not possible for `owner` to `cancelBeforeStart()` at this stage
  * Anyone can `cancelIfNoRNG()` after `endTimestamp` + **1 day** in case Chainlink fails and transition info **Cancelled** state

* When Chainlink VRF sends random number to raffle, we draw winner and transition into **Completed** state
  * Anyone can `transferNFToWinnerIfCompleted()`

* In `Cancelled` state it is possible for `owner` to get back NFTs and users can get refund
  * Users can `transferTicketRefundIfCancelled()`
  * Anyone can `transferNFTToOwnerIfCancelled()`

### States and related functions summary

* **WaitingForNFT** = 0
  * `verifyNFTPresenceBeforeStart()`
  * `cancelBeforeStart()` -- only `owner` can use
* **WaitingForStart** = 1
  * `cancelBeforeStart()` -- only `owner` can use
  * `giveawayTicket()` -- only `owner` can use
* **SellingTickets** = 2
  * `purchaseTicket()`
  * `giveawayTicket()` -- only `owner` can use
  * `cancelIfUnsold()`
* **WaitingForRNG** = 3
  * `cancelIfNoRNG()`
* **Completed** = 4
  * `transferNFTToWinnerIfCompleted()`
  * `transferETHToOwnerIfCompleted()`
* **Cancelled** = 5
  * `transferTicketRefundIfCancelled()`
  * `transferNFTToOwnerIfCancelled()`

## Ticket storage

Tickets are numbered from `0` to. If raffle has `4000` tickets, ticket numbers from `0` to `3999`.

`purchaseTicket()` and `giveawayTicket()` assigns corresponding ticket numbers in ascending order.

Assigned ticket are represented using `TicketNumberRange` struct:
```
struct TicketNumberRange {
    address owner;
    uint16 from;
    uint16 to;
}

TicketNumberRange[] private _ticketNumberRanges;
```

Examples:
* user 0x1 receives giveaway ticket #0, then `TicketNumberRange(0x1, 0, 0)`
* then user 0x2 purchases ten tickets , then `TicketNumberRange(0x2, 1, 10)`

How to work with tickets:
* `getTickets()` -- how many tickets in the raffle
* `getTicketsLeft()` -- how many unassigned tickets left
* `getTicketNumberRange(uint16)` -- get `TicketNumberRange` by id
* `getAssignedTicketCount(address)` -- how many tickets are assigned to given address
* `getAssignedTicketNumberRange(address, uint16)` -- get given address `TicketNumberRange` id to be used in `getTicketNumberRange(uint16)`
* `getAssignedTicketNumberRanges(address)` -- how many `TicketNumberRange` user has

## Other

* Before any ticket purchasing can be made, correct NFT must be transferred to the raffle contract
  * If wrong NFT is specified during creation, `owner` can cancel raffle
  * If wrong NFT (or multiple NFTs) are transferred to raffle, then `owner` can cancel raffle and get back any ERC721, ERC1155 or CryptoPunk back
* No purchases can be made before `startTimestamp`
* All methods of the raffle are callable by users, except for `cancelBeforeStart()` and `giveawayTicket()`, giving users the ability to transition between states
* Using [PullPayments](https://docs.openzeppelin.com/contracts/2.x/api/payment#PullPayment) approach for all ETH withdrawals
* There should be no ETH refunds for giveaway tickets
