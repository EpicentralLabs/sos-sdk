# @epicentral/sos-sdk

Solana Option Standard SDK. A frontend-first SDK for native options trading on Solana, built by Epicentral Labs.

Uses `@solana/kit` types (`Address`, `Instruction`, `Rpc`) across the public API.

## Install

```bash
pnpm add @epicentral/sos-sdk @solana/kit decimal.js
```

## Overview

- **LONG** — Buy from pool, close to pool, exercise options.
- **SHORT** — Mint options, unwind, sync, settle, claim premium, close option.
- **Pool** — Deposit, withdraw, borrow, repay liquidity.
- **OMLP** — Lender deposit and withdraw.
- **Accounts** — PDA derivation and account fetchers for options, pools, vaults.

Each flow exposes `build*Instruction` for single instruction composition and `build*Transaction` for full-flow `Instruction[]` construction.

## Usage

### Build + send (recommended)

```ts
import {
  buildBuyFromPoolTransaction,
  sendBuiltTransaction,
} from "@epicentral/sos-sdk";

const built = await buildBuyFromPoolTransaction(params);
const signature = await sendBuiltTransaction({
  rpc,
  rpcSubscriptions,
  feePayer: walletSigner,
  instructions: built.instructions,
});
```

### Build + send (manual)

```ts
import {
  appendTransactionMessageInstructions,
  createTransactionMessage,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from "@solana/kit";
import { buildBuyFromPoolTransaction } from "@epicentral/sos-sdk";

const built = await buildBuyFromPoolTransaction(params);
const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

const txMessage = pipe(
  createTransactionMessage({ version: 0 }),
  (tx) => setTransactionMessageFeePayerSigner(walletSigner, tx),
  (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
  (tx) => appendTransactionMessageInstructions(built.instructions, tx)
);

const signedTx = await signTransactionMessageWithSigners(txMessage);
await sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions })(signedTx, {
  commitment: "confirmed",
});
```

### LONG

```ts
import {
  buildBuyFromPoolTransaction,
  buildCloseLongToPoolTransaction,
  buildOptionExerciseTransaction,
} from "@epicentral/sos-sdk";

// Open LONG
const openLong = await buildBuyFromPoolTransaction(openLongParams);

// Close LONG
const closeLong = await buildCloseLongToPoolTransaction(closeLongParams);

// Exercise LONG
const exercise = buildOptionExerciseTransaction({ optionAccount, positionAccount, /* ... */ });
```

### SHORT

```ts
import {
  buildOptionMintTransaction,
  buildUnwindWriterUnsoldTransaction,
  buildSyncWriterPositionTransaction,
  buildSettleMakerCollateralTransaction,
  buildClaimPremiumTransaction,
  buildCloseOptionTransaction,
} from "@epicentral/sos-sdk";
import { OptionType } from "@epicentral/sos-sdk";

// Mint (open SHORT)
const built = await buildOptionMintTransaction({
  optionType: OptionType.Call,
  strikePrice,
  expirationDate,
  quantity,
  underlyingAsset,
  underlyingSymbol,
  makerCollateralAmount,
  borrowedAmount,
  maker,
  makerCollateralAccount,
  underlyingMint,
});

// Unwind / Sync / Settle
const unwind = await buildUnwindWriterUnsoldTransaction(unwindParams);
const sync = buildSyncWriterPositionTransaction(syncParams);
const settle = await buildSettleMakerCollateralTransaction(settleParams);

// Claim premium / close option
const claim = await buildClaimPremiumTransaction({ optionPool, makerPaymentAccount, premiumVault, maker });
const close = buildCloseOptionTransaction({ optionAccount, optionMint, makerOptionAccount, maker });
```

### Pool

```ts
import {
  buildDepositToPoolTransaction,
  buildWithdrawFromPoolTransaction,
  buildBorrowFromPoolTransaction,
  buildRepayPoolLoanTransaction,
} from "@epicentral/sos-sdk";

const deposit = await buildDepositToPoolTransaction(depositToPoolParams);
const withdraw = await buildWithdrawFromPoolTransaction(withdrawFromPoolParams);
const borrow = await buildBorrowFromPoolTransaction(borrowFromPoolParams);
const repay = await buildRepayPoolLoanTransaction(repayPoolLoanParams);
```

### OMLP

```ts
import {
  buildDepositToPositionTransaction,
  buildWithdrawFromPositionTransaction,
} from "@epicentral/sos-sdk";

const deposit = await buildDepositToPositionTransaction({
  vault,
  lenderTokenAccount,
  vaultTokenAccount,
  lender,
  amount,
});
const withdraw = await buildWithdrawFromPositionTransaction({
  vault,
  vaultTokenAccount,
  lenderTokenAccount,
  lender,
  amount,
});
```

### Fetch accounts

```ts
import { fetchOptionAccount, fetchOptionPool, fetchVault } from "@epicentral/sos-sdk";

const option = await fetchOptionAccount(rpc, optionAddress);
const pool = await fetchOptionPool(rpc, optionPoolAddress);
const vault = await fetchVault(rpc, vaultAddress);
```
