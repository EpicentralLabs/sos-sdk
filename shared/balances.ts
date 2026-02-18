import type { Address } from "@solana/kit";
import { deriveAssociatedTokenAddress } from "../accounts/pdas";
import { toAddress } from "../client/program";
import type { AddressLike, KitRpc } from "../client/types";
import { NATIVE_MINT } from "../wsol/instructions";

/** SPL Token account data: amount field offset (u64 LE). */
const TOKEN_ACCOUNT_AMOUNT_OFFSET = 64;

function decodeTokenAccountAmount(data: Uint8Array): bigint {
  if (data.length < TOKEN_ACCOUNT_AMOUNT_OFFSET + 8) return BigInt(0);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return view.getBigUint64(TOKEN_ACCOUNT_AMOUNT_OFFSET, true);
}

async function fetchTokenAccountBalance(rpc: KitRpc, ata: Address): Promise<bigint> {
  const response = await rpc.getAccountInfo(ata, { encoding: "base64" }).send();
  const accountInfo = response.value;
  if (!accountInfo) return BigInt(0);
  const [b64] = accountInfo.data;
  if (!b64) return BigInt(0);
  const binary = atob(b64);
  const data = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) data[i] = binary.charCodeAt(i);
  return decodeTokenAccountAmount(data);
}

/**
 * Returns the SPL token balance for an owner and mint in base units (smallest units).
 * Derives the associated token account; returns 0n if the ATA does not exist or has no data.
 */
export async function getTokenBalance(
  owner: AddressLike,
  mint: AddressLike,
  rpc: KitRpc
): Promise<bigint> {
  const ata = await deriveAssociatedTokenAddress(owner, mint);
  return fetchTokenAccountBalance(rpc, ata);
}

/**
 * Returns native SOL balance (lamports), wrapped SOL (WSOL) balance (base units), and total (native + wrapped).
 * Use for SOL pools when the UI should show combined "total SOL".
 */
export async function getCombinedSOLBalance(
  owner: AddressLike,
  rpc: KitRpc
): Promise<{ native: bigint; wrapped: bigint; total: bigint }> {
  const ownerAddress = toAddress(owner);
  const [nativeResponse, wrappedBalance] = await Promise.all([
    rpc.getBalance(ownerAddress).send(),
    getTokenBalance(ownerAddress, NATIVE_MINT, rpc),
  ]);
  const native = nativeResponse.value;
  const total = native + wrappedBalance;
  return { native, wrapped: wrappedBalance, total };
}
