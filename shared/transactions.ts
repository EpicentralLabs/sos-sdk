import {
  appendTransactionMessageInstructions,
  compressTransactionMessageUsingAddressLookupTables,
  createTransactionMessage,
  getSignatureFromTransaction,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type AddressesByLookupTableAddress,
  type RpcSubscriptions,
  type SolanaRpcSubscriptionsApi,
  type TransactionSigner,
} from "@solana/kit";
import { fetchAddressLookupTable } from "@solana-program/address-lookup-table";
import {
  getSetComputeUnitLimitInstruction,
  getSetComputeUnitPriceInstruction,
} from "@solana-program/compute-budget";
import type { Instruction } from "@solana/kit";
import { toAddress } from "../client/program";
import type { AddressLike, BuiltTransaction, KitRpc } from "../client/types";

export interface SendBuiltTransactionParams extends BuiltTransaction {
  rpc: KitRpc;
  rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>;
  feePayer: TransactionSigner<string>;
  commitment?: "processed" | "confirmed" | "finalized";
  computeUnitLimit?: number;
  computeUnitPriceMicroLamports?: number;
  addressLookupTableAddresses?: AddressLike[];
}

/**
 * Sends a built SDK transaction with common Solana Kit defaults.
 * The caller still controls the RPC clients and fee-payer signer.
 * Supports optional compute budget (limit + priority fee) and ALT compression.
 */
export async function sendBuiltTransaction(
  params: SendBuiltTransactionParams
): Promise<string> {
  const commitment = params.commitment ?? "confirmed";
  const { value: latestBlockhash } = await params.rpc.getLatestBlockhash().send();

  const computeBudgetInstructions: Instruction<string>[] = [];
  if (params.computeUnitLimit !== undefined) {
    computeBudgetInstructions.push(
      getSetComputeUnitLimitInstruction({ units: params.computeUnitLimit })
    );
  }
  if (params.computeUnitPriceMicroLamports !== undefined) {
    computeBudgetInstructions.push(
      getSetComputeUnitPriceInstruction({
        microLamports: params.computeUnitPriceMicroLamports,
      })
    );
  }
  const allInstructions = [...computeBudgetInstructions, ...params.instructions];

  let txMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayerSigner(params.feePayer, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
    (tx) => appendTransactionMessageInstructions(allInstructions, tx)
  );

  if (
    params.addressLookupTableAddresses &&
    params.addressLookupTableAddresses.length > 0
  ) {
    const addressesByAddressLookupTable: AddressesByLookupTableAddress = {};
    for (const altAddress of params.addressLookupTableAddresses) {
      const resolvedAddress = toAddress(altAddress);
      const { data } = await fetchAddressLookupTable(params.rpc, resolvedAddress);
      addressesByAddressLookupTable[resolvedAddress] = data.addresses;
    }
    txMessage = compressTransactionMessageUsingAddressLookupTables(
      txMessage,
      addressesByAddressLookupTable
    );
  }

  const signedTx = await signTransactionMessageWithSigners(txMessage);
  const sendAndConfirm = sendAndConfirmTransactionFactory({
    rpc: params.rpc,
    rpcSubscriptions: params.rpcSubscriptions,
  });
  type SendableTransaction = Parameters<typeof sendAndConfirm>[0];

  await sendAndConfirm(signedTx as SendableTransaction, { commitment });
  return getSignatureFromTransaction(signedTx);
}
