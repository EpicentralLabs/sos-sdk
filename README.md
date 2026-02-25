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
| `buildBuyFromPoolMarketOrderTransactionWithDerivation` | High-level market-order buy builder (refetches pool + remaining accounts, applies premium cap buffer). |
| `buildBuyFromPoolTransactionWithDerivation` | Builds buy-from-pool transaction; resolves accounts from option identity. |
| `preflightBuyFromPoolMarketOrder` | Buy preflight helper for liquidity + remaining-account coverage checks. |
| `buildCloseLongToPoolTransactionWithDerivation` | Builds close-long-to-pool transaction. |
| `getBuyFromPoolRemainingAccounts` | Builds remaining_accounts for buy (writer positions, etc.). |

### Short (Writer) Flows

| Function | Description |
|----------|-------------|
| `buildOptionMintTransactionWithDerivation` | Builds option mint (write) transaction. Supports multi-collateral: use `collateralMint` to back positions with any supported asset (USDC, BTC, SOL, etc.). |
| `buildUnwindWriterUnsoldTransactionWithDerivation` | Builds unwind unsold transaction. |
| `buildUnwindWriterUnsoldWithLoanRepayment` | **Unwind + repay pool loans in one tx.** Use when closing unsold shorts that borrowed from OMLP. |
| `buildSyncWriterPositionTransaction` | Syncs writer position with pool accumulators. |
| `buildSettleMakerCollateralTransaction` | Settles maker collateral after buyer closes. |
| `buildCloseOptionTransaction` | Closes option token account. |
| `buildClaimThetaTransaction` | Claims theta (time-decay share) for writer. |
| `buildRepayPoolLoanFromCollateralInstruction` | Repays pool loan from collateral (short/pool). |
| `buildRepayPoolLoanInstruction` | Repays pool loan with external funds (short/pool). |
| `buildRepayPoolLoanFromWalletInstruction` | Repays pool loan from maker's wallet (stuck loan recovery). |

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

## Multi-Collateral Settlement

The SDK supports universal multi-collateral settlement, allowing writers to use ANY supported asset as collateral for options (not just the underlying). This enables:

- **Capital Efficiency**: Writers use whatever assets they hold (USDC, BTC, SOL, BONK, etc.)
- **No Forced Conversions**: No swap fees or slippage to get the "correct" collateral
- **Lender Flexibility**: Lend any supported asset, earn yield in that asset

### How it works

When minting an option, specify `collateralMint` to choose the backing asset:

```ts
import {
  buildOptionMintTransactionWithDerivation,
  OptionType,
} from "@epicentral/sos-sdk";

// Write SOL calls backed by USDC
const tx = await buildOptionMintTransactionWithDerivation({
  underlyingAsset: SOL_MINT,
  optionType: OptionType.Call,
  strikePrice: 150.0,
  expirationDate: BigInt(1735689600),
  quantity: 1_000_000,           // 1 contract
  underlyingMint: SOL_MINT,
  underlyingSymbol: "SOL",
  collateralMint: USDC_MINT,     // Back with USDC instead of SOL
  makerCollateralAmount: 780_000_000,  // $780 (10% of $7,800)
  borrowedAmount: 7_020_000_000,       // $7,020 (90% borrowed)
  maker: walletAddress,
  rpc,
});
```

**Key points:**
- `collateralMint` defaults to `underlyingMint` if not provided (backwards compatible)
- OMLP vault routing is based on `collateralMint` - the vault must exist for the collateral asset
- At settlement, buyers receive payout in the collateral currency that backed the position
- The `WriterPosition` account tracks `collateralMint` and `settlementMint` for each position

### Collateral Calculation

Use `calculateRequiredCollateral` to estimate collateral needs before minting:

```ts
import { calculateRequiredCollateral } from "@epicentral/sos-sdk";

const required = calculateRequiredCollateral(
  1_000_000n,      // 1 contract in base units
  150.0,           // $150 strike price
  145.23,          // Current spot price (USD)
  6                // USDC decimals
);
// Returns: USDC base units needed
```

## Unwind with Loan Repayment

When a writer unwinds an unsold short that had borrowed from the OMLP pool, the program repays proportionally to the unwind ratio inside `unwind_writer_unsold`:

**Proportional Repayment (partial unwinds):**
- Unwind ratio = `unwind_qty / written_qty`
- Principal repaid = `total_loan_principal * unwind_ratio`
- Interest repaid = `total_accrued_interest * unwind_ratio`
- Protocol fees repaid = `total_accrued_fees * unwind_ratio`

**Repayment order:**
1. Collateral vault funds first.
2. Writer fallback wallet source (`writerRepaymentAccount`) for any shortfall.
3. If combined funds cannot cover proportional principal + interest + protocol fees, unwind fails with a protocol custom error (not a generic SPL `0x1`).

**Collateral Return:**
- Proportional collateral share = `(collateral_deposited * unwind_qty) / written_qty`
- Returnable collateral = `proportional_share - amount_already_repaid_from_vault`
- If vault lacks sufficient post-repayment balance, fails with `InsufficientCollateralVault` (6090)

Use **`buildUnwindWriterUnsoldWithLoanRepayment`** so that:

1. Active pool loans for the option’s underlying vault are fetched.
2. `omlpVaultState` (Vault PDA), `omlpVault`, and `feeWallet` are passed as named accounts.
3. `remaining_accounts` = **[PoolLoan₁, PoolLoan₂, ...]** only (capped at 20 loans per tx).
4. One transaction burns, repays lenders from collateral vault, and returns collateral to the writer.

Use **`preflightUnwindWriterUnsold`** before building the transaction to get:

- Per-loan principal/interest/protocol-fee breakdown.
- **Proportional obligations** for partial unwinds (principal, interest, fees, total owed).
- **Collateral return calculation** (proportional share, returnable amount).
- Collateral-vault available, wallet fallback required, and shortfall.
- **Top-up UX fields:** `collateralVaultShortfall`, `needsWalletTopUp`.
- `canRepayFully` so UI can block early with actionable messaging.

If there are no active pool loans for that vault, the API still works and passes empty `remaining_accounts`.

**Alternative (repay then unwind):** For writers with more than ~20 active loans, (1) build `repay_pool_loan_from_collateral` instructions first to reduce loans, then (2) unwind with the remaining loans.

**Stuck loan (InsufficientEscrowBalance):** When standard repay fails with `InsufficientEscrowBalance` (escrow underfunded or drained), use `buildRepayPoolLoanFromWalletInstruction` or `buildRepayPoolLoanFromWalletTransaction`. Same accounts as `buildRepayPoolLoanInstruction`; maker pays full principal + interest + fees from their wallet.

### Recommended Preflight + Unwind

```ts
import {
  preflightUnwindWriterUnsold,
  buildUnwindWriterUnsoldWithLoanRepayment,
} from "@epicentral/sos-sdk";

const preflight = await preflightUnwindWriterUnsold({
  underlyingAsset,
  optionType,
  strikePrice,
  expirationDate,
  writer,
  unwindQty,
  rpc,
});

if (!preflight.canRepayFully) {
  throw new Error(`Unwind blocked. Shortfall: ${preflight.summary.shortfall.toString()}`);
}

const tx = await buildUnwindWriterUnsoldWithLoanRepayment({
  underlyingAsset,
  optionType,
  strikePrice,
  expirationDate,
  writer,
  unwindQty,
  rpc,
});
```

## Usage Examples

### Buy From Pool (market order, high-level)

```ts
import {
  buildBuyFromPoolMarketOrderTransactionWithDerivation,
  preflightBuyFromPoolMarketOrder,
  OptionType,
} from "@epicentral/sos-sdk";

const preflight = await preflightBuyFromPoolMarketOrder({
  underlyingAsset: "...",
  optionType: OptionType.Call,
  strikePrice: 100_000,
  expirationDate: BigInt(1735689600),
  quantity: 1_000_000,
  rpc,
  quotedPremiumTotal: 50_000,
  slippageBufferBaseUnits: 500_000n,
});

if (!preflight.canBuy) {
  throw new Error(preflight.reason ?? "Buy preflight failed");
}

const tx = await buildBuyFromPoolMarketOrderTransactionWithDerivation({
  underlyingAsset: "...",
  optionType: OptionType.Call,
  strikePrice: 100_000,
  expirationDate: BigInt(1735689600),
  buyer: walletAddress,
  buyerPaymentAccount: buyerUsdcAta,
  priceUpdate: pythPriceFeed,
  quantity: 1_000_000,
  quotedPremiumTotal: 50_000,
  slippageBufferBaseUnits: 500_000n,
  rpc,
});
```

### Buy premium semantics (market orders)

- `premiumAmount` / `max_premium_amount` is a **max premium cap**, not an exact premium target.
- Program computes premium on-chain at execution time and fails with `SlippageToleranceExceeded` if computed premium exceeds the cap.
- High-level market builder computes cap as `quotedPremiumTotal + buffer`:
  - Canonical: `slippageBufferBaseUnits`
  - Convenience for SOL/WSOL: `slippageBufferLamports`
  - Default buffer: `500_000` base units (0.0005 SOL lamports)

### Buy liquidity errors (6041 split into 6042/6043)

The program uses distinct error codes for liquidity failures:

- `InsufficientPoolAggregateLiquidity` (6042) – `option_pool.total_available < quantity`
- `InsufficientWriterPositionLiquidity` (6043) – remaining writer-position accounts cannot cover full quantity in the smallest-first fill loop

**Ghost Liquidity:** When `total_available` appears sufficient but active writer positions cannot cover the request. This happens when positions are settled/liquidated but still counted in the aggregate. The SDK now filters inactive positions, and the program skips them in the fill loop.

**Recommended client flow:**
  1. Run `preflightBuyFromPoolMarketOrder` for UX gating (checks both pool and active writer liquidity).
  2. Build via `buildBuyFromPoolMarketOrderTransactionWithDerivation` – it refetches pool + remaining accounts and asserts active writer liquidity >= requested quantity before building.

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

## Collateral Calculation Helper

The SDK exports `calculateRequiredCollateral` for pre-flight collateral estimation:

```ts
import { calculateRequiredCollateral } from "@epicentral/sos-sdk";

const required = calculateRequiredCollateral(
  1_000_000n,      // 1 contract in base units
  150.0,           // $150 strike price
  145.23,          // Current spot price (USD)
  9                // Token decimals (9 for SOL)
);
// Returns: token base units needed (e.g., 103_280_000_000 lamports for ~103.28 SOL)
```

**Formula:**
```
contracts     = quantity / 1_000_000
usd_value     = contracts * 100 * strike_price
collateral    = (usd_value / spot_price) * 10^token_decimals
```

This matches the on-chain formula in `Vault::calculate_required_collateral` and can be used to display required collateral to users before submitting an `option_mint` transaction.
