import {
  appendTransactionMessageInstructions,
  createTransactionMessage,
  getSignatureFromTransaction,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type RpcSubscriptions,
  type SolanaRpcSubscriptionsApi,
  type TransactionSigner,
} from "@solana/kit";
import type { BuiltTransaction, KitRpc } from "../client/types";

export interface SendBuiltTransactionParams extends BuiltTransaction {
  rpc: KitRpc;
  rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>;
  feePayer: TransactionSigner<string>;
  commitment?: "processed" | "confirmed" | "finalized";
}

/**
 * Sends a built SDK transaction with common Solana Kit defaults.
 * The caller still controls the RPC clients and fee-payer signer.
 */
export async function sendBuiltTransaction(
  params: SendBuiltTransactionParams
): Promise<string> {
  const commitment = params.commitment ?? "confirmed";
  const { value: latestBlockhash } = await params.rpc.getLatestBlockhash().send();

  const txMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(params.feePayer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstructions(params.instructions, tx)
  );

  const signedTx = await signTransactionMessageWithSigners(txMessage);
  const sendAndConfirm = sendAndConfirmTransactionFactory({
    rpc: params.rpc,
    rpcSubscriptions: params.rpcSubscriptions,
  });
  type SendableTransaction = Parameters<typeof sendAndConfirm>[0];

  await sendAndConfirm(signedTx as SendableTransaction, { commitment });
  return getSignatureFromTransaction(signedTx);
}
