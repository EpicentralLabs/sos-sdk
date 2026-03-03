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
| `buildCloseLongToPoolTransactionWithDerivation` | Builds close-long-to-pool transaction; by default appends CloseAccount for buyer LONG ATA and unwraps WSOL payout when underlying is SOL. |
| `getBuyFromPoolRemainingAccounts` | Builds remaining_accounts for buy (writer positions, etc.). |

### Short (Writer) Flows

| Function | Description |
|----------|-------------|
| `buildOptionMintTransactionWithDerivation` | Builds option mint (write) transaction. By default appends CloseAccount for the maker's LONG token account after mint (reclaim rent). Supports multi-collateral: use `collateralMint` to back positions with any supported asset (USDC, BTC, SOL, etc.). |
| `buildUnwindWriterUnsoldTransactionWithDerivation` | Builds unwind unsold transaction. |
| `buildUnwindWriterUnsoldWithLoanRepayment` | **Unwind + repay pool loans in one tx.** Use when closing unsold shorts that borrowed from OMLP. |
| `buildSyncWriterPositionTransaction` | Syncs writer position with pool accumulators. |
| `buildSettleMakerCollateralTransaction` | Settles maker collateral after buyer closes (repays principal + accrued interest to OMLP from collateral vault first, then returns remainder to maker). |
| `buildCloseOptionTransaction` | Closes option token account. |
| `buildClaimThetaTransaction` | Claims theta (time-decay share) for writer. |
| `buildRepayPoolLoanFromCollateralInstruction` | Repays pool loan from collateral (short/pool). |
| `buildRepayPoolLoanInstruction` | Repays pool loan with external funds (short/pool). |
| `buildRepayPoolLoanFromWalletInstruction` | Repays pool loan from maker's wallet (stuck loan recovery). |

### Seller Close Signers

- `buildUnwindWriterUnsoldWithLoanRepayment` / `buildUnwindWriterUnsoldTransactionWithDerivation`
  - Requires `writer` transaction signer.
  - On-chain transfers for lender repayment and collateral return are authorized by program PDAs (`collateral_pool` / `option_pool`) where applicable.
- `buildSettleMakerCollateralTransaction`
  - No maker transaction signer is required by this instruction format.
  - On-chain repayment (`collateral_vault` -> `omlp_vault`) and maker return are signed by the `collateral_pool` PDA.
  - Lender repayment is sourced from collateral vault funds, not maker wallet funds.

### OMLP (Lending)

| Function | Description |
|----------|-------------|
| `buildDepositToPositionTransaction` | Deposits liquidity to OMLP. |
| `buildWithdrawFromPositionTransaction` | Withdraws liquidity; supports optional same-tx WSOL unwrap via `unwrapSol` + `vaultMint`. |
| `withdrawAllFromPosition` | Withdraws full position (principal + proportional interest, including pending index accrual, capped by pool liquidity). |
| `withdrawInterestFromPosition` | Withdraws interest only (realized + pending index accrual, capped by pool liquidity). |

Borrow/repay for writers: use `buildOptionMintTransactionWithDerivation` (with vault/poolLoan) and `buildRepayPoolLoanFromCollateralInstruction` or `buildUnwindWriterUnsoldWithLoanRepayment`.

### Token account closing (option mint and close long)

- **Option mint (seller/writer):** After `option_mint`, all LONG tokens go to the pool escrow; the maker's LONG ATA is left with zero balance. The SDK **automatically appends an SPL CloseAccount instruction** (when `closeMakerLongAccount` is not set to `false`) so the maker reclaims rent. Use `buildOptionMintTransaction` or `buildOptionMintTransactionWithDerivation`; pass `closeMakerLongAccount: false` to skip closing the LONG ATA.
- **Close long (buyer):** When the buyer closes or exercises early via `close_long_to_pool`, LONG tokens are returned to the pool and payout is sent to the buyer's payout ATA. The SDK can:
  - **Close the buyer's LONG token account** after the close instruction so rent is reclaimed. Use `closeLongTokenAccount: true` (default for `buildCloseLongToPoolTransactionWithDerivation`); set to `false` for **partial** closes (the LONG ATA still holds remaining tokens).
  - **Unwrap WSOL payout** when the option underlying is SOL: append CloseAccount on the payout ATA so the buyer receives native SOL. Use `unwrapPayoutSol: true` (default for WSOL in the derivation builder); set to `false` to keep payout as WSOL.

### OMLP withdraw behavior

- Interest is allocated proportionally via the vault interest-per-share index.
- On-chain `withdraw_from_position` syncs pending interest before transferring funds, so a lender withdrawal automatically includes their proportional earned interest when available.
- `withdrawAllFromPosition` and `withdrawInterestFromPosition` compute pending interest from `accInterestPerShareFp` and `interestIndexSnapshotFp`, then cap by `poolAvailable = totalLiquidity - totalLoans`.
- Optional WSOL unwrap in the same transaction:
  - Set `unwrapSol: true` and provide `vaultMint`.
  - If `vaultMint === NATIVE_MINT`, SDK appends a `CloseAccount` after withdraw to unwrap WSOL ATA to native SOL.
  - For non-WSOL mints, the same builder remains token-agnostic and does not append unwrap instructions.

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
- WSOL repay metadata: `solTopUpRequired`, `topUpRequiredForRepay`, `nativeSolAvailable`.
- `canRepayFully`, which now reflects effective repay solvency (including native SOL top-up capacity for WSOL paths).

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

const tx = await buildUnwindWriterUnsoldWithLoanRepayment({
  underlyingAsset,
  optionType,
  strikePrice,
  expirationDate,
  writer,
  unwindQty,
  rpc,
  includeWrapForShortfall: true, // for WSOL paths, auto-wrap net top-up when needed
  writerSigner: walletSigner,    // required when wrapping is needed
});
```

Notes:
- For WSOL underlyings, the builder wraps only the net required amount: `max(0, walletFallbackRequired - walletFallbackAvailable)`.
- If repayment is still insolvent after considering vault + fallback + native SOL top-up capacity, the builder throws an actionable insolvency error.

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
  // optional: override feed account if you do not want SDK derivation from market data
  switchboardFeed: switchboardFeedAddress,
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

### Framework deserialization errors (`#3003`)

If simulation fails with `custom program error: #3003`, this usually means account deserialization failed before business logic (`60xx`) ran.

Check these first:

- `buyer_position` account shape/size (`146` bytes expected).
- `market_data` account shape/size (`128` bytes expected).
- `switchboardFeed` points to the configured Switchboard pull feed account for the market (or omit it and let derivation builders resolve from `market_data.switchboard_feed_id`).
- Account list/order matches the generated instruction layout.

This is different from liquidity failures (`6042/6043`) and should be debugged as an account wiring/layout issue.

### Oracle inputs (asset-agnostic)

- Keep oracle handling universal across assets.
- Use the market-configured `switchboard_feed_id` as source-of-truth and pass `switchboardFeed` when using low-level builders.
- Avoid hardcoding a single feed/account address in shared SDK integration flows.

### Price update freshness (required for accurate payouts)

The program uses the **Switchboard pull feed account** you pass in (or that the SDK derives) to read the current underlying price for:

- **Buy:** Premium computation (Black-Scholes).
- **Close:** Payout computation (mark-to-market). If the price is stale, the close payout will not reflect the current option value; the buyer may receive back only their premium instead of profit.

**You must ensure the Switchboard feed is recently updated** when building buy and close transactions. The SDK does not post oracle updates by default; use the Switchboard helper exports and your update pipeline before trading instructions.

- **Mainnet:** keep feed updates fresh enough to satisfy the feed's configured `max_staleness`.
- **Devnet:** ensure your keeper/update pipeline runs before user trade flows; payouts reflect the feed's staleness config.

**Fallback policy:** Switchboard-configured markets are strict Switchboard reads. Legacy Pyth helpers remain in the codebase for compatibility, but primary trade paths use Switchboard feed accounts.

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
