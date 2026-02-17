# SDK (Frontend-First)

This SDK is organized by feature and wraps the Codama-generated client for the `option_program`.
It is Kit-native and uses `@solana/kit` types (`Address`, `Instruction`, `Rpc`) across the public API.
The package entrypoint is `@epicentral/sos-sdk`.

## Install

```bash
pnpm add @solana/kit decimal.js
```

In this repository, the SDK source lives at `epicentral/sos-sdk` and is packaged as
`@epicentral/sos-sdk`.

## Structure

- `client/` shared program constants and address helpers for the option program.
- `accounts/` PDA derivation and account fetch helpers.
- `long/` LONG buy/close/exercise/quote builders.
- `short/` SHORT mint/unwind/sync/settle plus premium/pool/loan builders.
- `omlp/` lender deposit/withdraw instruction builders.
- `shared/` common amount, error, and remaining account helpers.
- `generated/` Codama-generated client (bundled; do not edit).

## Updating the bundled client

The SDK bundles the program client in `generated/`. From the **option-program** repo root:

1. Regenerate the client: `yarn generate:client`.
2. Sync into the SDK and copy to the standalone repo: `yarn sync:sdk`.

Or run the full pipeline: `yarn generate:client:with-sdk`. The script copies the client into `epicentral/sos-sdk/generated` and then copies the entire SDK to the standalone repo (default `../sos-sdk`) so you can commit from there. Override the standalone path with `STANDALONE_SDK_PATH=/path/to/sos-sdk yarn sync:sdk`.

## Usage model

Each flow exposes:

- `build*Instruction(params)` for single instruction composition.
- `build*Transaction(params)` for one-flow `Instruction[]` construction.
- optional domain services for multi-step flows (no send/confirm).

## Core examples

### Build + send (app-owned)

```ts
import {
  appendTransactionMessageInstructions,
  createTransactionMessage,
  getSignatureFromTransaction,
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

const signature = getSignatureFromTransaction(signedTx);
```

### Build + send (SDK helper)

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

### Open LONG / close LONG

```ts
import {
  buildBuyFromPoolTransaction,
  buildCloseLongToPoolTransaction,
} from "@epicentral/sos-sdk";

const openLong = await buildBuyFromPoolTransaction(openLongParams);
const closeLong = await buildCloseLongToPoolTransaction(closeLongParams);
```

### Exercise LONG

```ts
import { buildOptionExerciseTransaction } from "@epicentral/sos-sdk";

const exercise = buildOptionExerciseTransaction({
  optionAccount,
  positionAccount,
  marketData,
  underlyingMint,
  priceUpdate,
  buyerPaymentAccount,
  makerCollateralAccount,
  escrowState,
  escrowTokenAccount,
  escrowAuthority,
  buyer,
});
```

### Open SHORT (option mint)

```ts
import { buildOptionMintTransaction, OptionType } from "@epicentral/sos-sdk";

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
```

### Unwind / Sync / Settle SHORT

```ts
import {
  buildSettleMakerCollateralTransaction,
  buildSyncWriterPositionTransaction,
  buildUnwindWriterUnsoldTransaction,
} from "@epicentral/sos-sdk";

const unwind = await buildUnwindWriterUnsoldTransaction(unwindParams);
const sync = buildSyncWriterPositionTransaction(syncParams);
const settle = await buildSettleMakerCollateralTransaction(settleParams);
```

### Claim premium / close option

```ts
import {
  buildClaimPremiumTransaction,
  buildCloseOptionTransaction,
} from "@epicentral/sos-sdk";

const claim = await buildClaimPremiumTransaction({
  optionPool,
  makerPaymentAccount,
  premiumVault,
  maker,
});

const close = buildCloseOptionTransaction({
  optionAccount,
  optionMint,
  makerOptionAccount,
  maker,
});
```

### Pool liquidity / borrow / repay

```ts
import {
  buildBorrowFromPoolTransaction,
  buildDepositToPoolTransaction,
  buildRepayPoolLoanTransaction,
  buildWithdrawFromPoolTransaction,
} from "@epicentral/sos-sdk";

const deposit = await buildDepositToPoolTransaction(depositToPoolParams);
const withdraw = await buildWithdrawFromPoolTransaction(withdrawFromPoolParams);
const borrow = await buildBorrowFromPoolTransaction(borrowFromPoolParams);
const repay = await buildRepayPoolLoanTransaction(repayPoolLoanParams);
```

Repayment source behavior:

- `buildRepayPoolLoanTransaction`: principal is repaid from `escrowTokenAccount`; accrued interest + protocol fees are repaid from `makerTokenAccount`.
- `buildRepayPoolLoanFromCollateralTransaction`: full repayment is sourced from `collateralVault`.

### OMLP deposit/withdraw

```ts
import {
  buildDepositToPositionTransaction,
  buildWithdrawFromPositionTransaction,
} from "@epicentral/sos-sdk";

const deposit = await buildDepositToPositionTransaction(
  { vault, lenderTokenAccount, vaultTokenAccount, lender, amount }
);

const withdraw = await buildWithdrawFromPositionTransaction(
  { vault, vaultTokenAccount, lenderTokenAccount, lender, amount }
);
```

### Replace Anchor reads with SDK fetchers

```ts
import { fetchOptionAccount, fetchOptionPool, fetchVault } from "@epicentral/sos-sdk";

const option = await fetchOptionAccount(rpc, optionAddress);
const pool = await fetchOptionPool(rpc, optionPoolAddress);
const vault = await fetchVault(rpc, vaultAddress);
```

## Migration notes

- This SDK is the only frontend integration surface for this repository.
- Legacy `frontend/constants`, `frontend/services`, and `frontend/utils` modules were removed.
- Replace Anchor `program.account.*` reads with SDK fetchers.
- Replace Anchor `program.methods.*` writes with SDK builders.
- App code should own message building, signing, send, and confirmation via `@solana/kit`.
- `long/service.ts` and `short/service.ts` were removed in favor of direct builder calls.
