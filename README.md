# @epicentral/sos-sdk

TypeScript/JavaScript SDK for the Solana Option Standard (SOS) program. The frontend-first SDK for native options trading on Solana. Built with `@solana/kit` and related Solana libraries.

## Installation

```bash
pnpm add @epicentral/sos-sdk
```

Peer dependencies: `@solana/kit` (and your RPC client). The SDK uses `KitRpc` for account resolution and fetches.

## Overview

The SDK supports two main flows:

- **Long (buyer)** – Buy options from the pool, close positions, exercise.
- **Short (writer)** – Mint options (write), unwind unsold, settle collateral, claim theta.

Additional modules:

- **OMLP** – Option Maker Liquidity Pool. Lenders deposit; writers borrow to collateralize shorts.
- **WSOL** – Helpers for wrapping/unwrapping SOL and creating token accounts.

## High-Level Functions and Instructions

### Accounts, PDAs, and Fetchers

| Function | Description |
|----------|-------------|
| `resolveOptionAccounts` | Resolves option pool, mints, vaults, and collateral accounts from option identity (underlying, type, strike, expiration). |
| `deriveVaultPda` | Derives OMLP vault PDA from mint. |
| `derivePoolLoanPdaFromVault` | Derives PoolLoan PDA from vault, maker, nonce (canonical; matches program). |
| `derivePoolLoanPda` | *(Deprecated)* Legacy derivation; use `derivePoolLoanPdaFromVault`. |
| `deriveWriterPositionPda` | Derives writer position PDA from option pool and writer. |
| `deriveAssociatedTokenAddress` | Derives ATA for owner + mint. |
| `fetchVault` | Fetches vault account by address. |
| `fetchPoolLoansByMaker` | Fetches active pool loans for a maker. |
| `fetchOptionPool` | Fetches option pool account. |
| `fetchWriterPositionsByWriter` | Fetches writer positions for a writer. |
| `fetchWriterPositionsForPool` | Fetches writer positions for an option pool. |
| `fetchPositionAccountsByBuyer` | Fetches buyer position accounts. |
| `fetchAllOptionPools` | Fetches all option pools. |
| `fetchAllVaults` | Fetches all vaults. |

### Long (Buyer) Flows

| Function | Description |
|----------|-------------|
| `buildBuyFromPoolTransactionWithDerivation` | Builds buy-from-pool transaction; resolves accounts from option identity. |
| `buildCloseLongToPoolTransactionWithDerivation` | Builds close-long-to-pool transaction. |
| `getBuyFromPoolRemainingAccounts` | Builds remaining_accounts for buy (writer positions, etc.). |

### Short (Writer) Flows

| Function | Description |
|----------|-------------|
| `buildOptionMintTransactionWithDerivation` | Builds option mint (write) transaction. |
| `buildUnwindWriterUnsoldTransactionWithDerivation` | Builds unwind unsold transaction. |
| `buildUnwindWriterUnsoldWithLoanRepayment` | **Unwind + repay pool loans in one tx.** Use when closing unsold shorts that borrowed from OMLP. |
| `buildSyncWriterPositionTransaction` | Syncs writer position with pool accumulators. |
| `buildSettleMakerCollateralTransaction` | Settles maker collateral after buyer closes. |
| `buildCloseOptionTransaction` | Closes option token account. |
| `buildClaimThetaTransaction` | Claims theta (time-decay share) for writer. |
| `buildRepayPoolLoanFromCollateralInstruction` | Repays pool loan from collateral (short/pool). |
| `buildRepayPoolLoanInstruction` | Repays pool loan with external funds (short/pool). |

### OMLP (Lending)

| Function | Description |
|----------|-------------|
| `buildDepositToPositionTransaction` | Deposits liquidity to OMLP. |
| `buildWithdrawFromPositionTransaction` | Withdraws liquidity. |
| `withdrawAllFromPosition` | Withdraws full position (omlp/service). |
| `withdrawInterestFromPosition` | Withdraws accrued interest only (omlp/service). |

Borrow/repay for writers: use `buildOptionMintTransactionWithDerivation` (with vault/poolLoan) and `buildRepayPoolLoanFromCollateralInstruction` or `buildUnwindWriterUnsoldWithLoanRepayment`.

### WSOL / Token Helpers

| Function | Description |
|----------|-------------|
| `getWrapSOLInstructions` | Wraps SOL to WSOL. |
| `getUnwrapSOLInstructions` | Unwraps WSOL to SOL. |
| `getCreateAssociatedTokenIdempotentInstructionWithAddress` | Creates ATA if missing (idempotent). |
| `NATIVE_MINT` | WSOL mint address. |

## Unwind with Loan Repayment

When a writer unwinds an unsold short that had borrowed from the OMLP pool, the borrowed amount must be repaid to the pool, not sent to the writer.

Use **`buildUnwindWriterUnsoldWithLoanRepayment`** so that:

1. Active pool loans for the option’s underlying vault are fetched.
2. `remaining_accounts` are built in the correct order: **[Vault PDA, PoolLoan₁, PoolLoan₂, ...]** (all writable).
3. OMLP vault token account and fee wallet are resolved.
4. One transaction both unwinds and repays the pool loan(s).

If there are no active pool loans for that vault, the API still works and passes empty `remaining_accounts`.

**Alternative (repay then unwind):** For flexibility, you can (1) build `repay_pool_loan_from_collateral` instructions via `buildRepayPoolLoanFromCollateralInstruction`, then (2) build `unwind_writer_unsold` without remaining_accounts.

## Usage Examples

### Buy from pool (with derivation)

```ts
import {
  buildBuyFromPoolTransactionWithDerivation,
  resolveOptionAccounts,
  OptionType,
} from "@epicentral/sos-sdk";

const tx = await buildBuyFromPoolTransactionWithDerivation({
  underlyingAsset: "...",
  optionType: OptionType.Call,
  strikePrice: 100_000,
  expirationDate: BigInt(1735689600),
  buyer: walletAddress,
  buyerPaymentAccount: buyerUsdcAta,
  priceUpdate: pythPriceFeed,
  quantity: 1_000_000,
  premiumAmount: 50_000,
  rpc,
});
```

### Unwind with loan repayment

```ts
import {
  buildUnwindWriterUnsoldWithLoanRepayment,
  OptionType,
} from "@epicentral/sos-sdk";

const tx = await buildUnwindWriterUnsoldWithLoanRepayment({
  underlyingAsset: "...",
  optionType: OptionType.Call,
  strikePrice: 100_000,
  expirationDate: BigInt(1735689600),
  writer: walletAddress,
  unwindQty: 500_000,
  rpc,
});
```

## Types and Exports

Key types exported from the package:

- `OptionType` – Call or Put.
- `BuiltTransaction` – `{ instructions: Instruction[] }`.
- `AddressLike` – `string | Address`.
- `KitRpc` – RPC client type for fetches.
- `RemainingAccountInput` – `{ address, isWritable, isSigner? }`.

PDAs, fetchers, and builders are exported from the package root.

## Program Compatibility

The SDK targets the Solana Option Standard program. Use `PROGRAM_ID` (or `getProgramId()`) from the package for the program address. Pass `programId` in builder params when using a different deployment.
