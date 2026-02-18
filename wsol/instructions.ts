import {
  AccountRole,
  address,
  isTransactionSigner,
  type AccountMeta,
  type Address,
  type Instruction,
  type TransactionSigner,
  upgradeRoleToSigner,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import { deriveAssociatedTokenAddress } from "../accounts/pdas";
import { toAddress } from "../client/program";
import type { AddressLike, KitRpc } from "../client/types";

/** Wrapped SOL mint address (WSOL). */
export const NATIVE_MINT = address("So11111111111111111111111111111111111111112");

const TOKEN_PROGRAM_ADDRESS = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ADDRESS = address(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);
const SYSTEM_PROGRAM_ADDRESS = address("11111111111111111111111111111111");

/** SPL Token instruction discriminator: SyncNative. */
const SYNC_NATIVE_DISCRIMINATOR = 17;
/** SPL Token instruction discriminator: CloseAccount. */
const CLOSE_ACCOUNT_DISCRIMINATOR = 9;
/** Associated Token Program instruction discriminator: CreateIdempotent. */
const CREATE_ASSOCIATED_TOKEN_IDEMPOTENT_DISCRIMINATOR = 1;

/** SPL Token account data: amount field offset (u64 LE). */
const TOKEN_ACCOUNT_AMOUNT_OFFSET = 64;

function accountMeta(
  addr: Address,
  role: AccountRole,
  signer?: TransactionSigner
): AccountMeta<string> {
  const base = { address: addr, role };
  if (signer !== undefined) {
    return Object.freeze({ ...base, role: upgradeRoleToSigner(role), signer }) as AccountMeta<string>;
  }
  return Object.freeze(base) as AccountMeta<string>;
}

/**
 * Builds the SPL Token SyncNative instruction (for WSOL wrap). Syncs the native token
 * account's amount with its lamport balance.
 */
export function getSyncNativeInstruction(
  account: AddressLike,
  tokenProgram: AddressLike = TOKEN_PROGRAM_ADDRESS
): Instruction<string> {
  const programAddress = toAddress(tokenProgram);
  return Object.freeze({
    programAddress,
    accounts: [
      accountMeta(toAddress(account), AccountRole.WRITABLE),
    ],
    data: new Uint8Array([SYNC_NATIVE_DISCRIMINATOR]),
  });
}

/**
 * Builds the SPL Token CloseAccount instruction (for WSOL unwrap). Closes the token
 * account and sends lamports to destination. Owner must sign the transaction.
 */
export function getCloseAccountInstruction(
  account: AddressLike,
  destination: AddressLike,
  owner: AddressLike | TransactionSigner<string>,
  tokenProgram: AddressLike = TOKEN_PROGRAM_ADDRESS
): Instruction<string> {
  const programAddress = toAddress(tokenProgram);
  const ownerAddress = toAddress(
    typeof owner === "object" && owner !== null && "address" in owner
      ? (owner as TransactionSigner<string>).address
      : owner
  );
  const ownerSigner: TransactionSigner<string> | undefined =
    typeof owner === "object" && owner !== null && "address" in owner && isTransactionSigner(owner)
      ? owner
      : undefined;
  const ownerMeta: AccountMeta<string> = ownerSigner
    ? Object.freeze({
        address: ownerAddress,
        role: upgradeRoleToSigner(AccountRole.READONLY),
        signer: ownerSigner,
      }) as AccountMeta<string>
    : accountMeta(ownerAddress, AccountRole.READONLY);
  return Object.freeze({
    programAddress,
    accounts: [
      accountMeta(toAddress(account), AccountRole.WRITABLE),
      accountMeta(toAddress(destination), AccountRole.WRITABLE),
      ownerMeta,
    ],
    data: new Uint8Array([CLOSE_ACCOUNT_DISCRIMINATOR]),
  });
}

/**
 * Builds the Associated Token Program CreateIdempotent instruction. Safe to add
 * even if the ATA already exists.
 */
async function getCreateAssociatedTokenIdempotentInstruction(
  payer: TransactionSigner<string>,
  owner: AddressLike,
  mint: AddressLike,
  associatedToken: Address
): Promise<Instruction<string>> {
  const programAddress = ASSOCIATED_TOKEN_PROGRAM_ADDRESS;
  return Object.freeze({
    programAddress,
    accounts: [
      accountMeta(payer.address as Address, AccountRole.WRITABLE, payer),
      accountMeta(associatedToken, AccountRole.WRITABLE),
      accountMeta(toAddress(owner), AccountRole.READONLY),
      accountMeta(toAddress(mint), AccountRole.READONLY),
      accountMeta(SYSTEM_PROGRAM_ADDRESS, AccountRole.READONLY),
      accountMeta(TOKEN_PROGRAM_ADDRESS, AccountRole.READONLY),
    ],
    data: new Uint8Array([CREATE_ASSOCIATED_TOKEN_IDEMPOTENT_DISCRIMINATOR]),
  });
}

/**
 * Returns instructions to wrap SOL into WSOL: create WSOL ATA (idempotent),
 * transfer lamports to it, then sync native. Uses SDK's deriveAssociatedTokenAddress.
 */
export async function getWrapSOLInstructions(params: {
  payer: TransactionSigner<string>;
  lamports: bigint;
  owner?: AddressLike;
  tokenProgram?: AddressLike;
  wsolMint?: AddressLike;
}): Promise<Instruction<string>[]> {
  const owner = params.owner ?? params.payer.address;
  const wsolMint = params.wsolMint ?? NATIVE_MINT;
  const tokenProgram = params.tokenProgram ?? TOKEN_PROGRAM_ADDRESS;

  const wsolAta = await deriveAssociatedTokenAddress(owner, wsolMint);

  const createAta = await getCreateAssociatedTokenIdempotentInstruction(
    params.payer,
    owner,
    wsolMint,
    wsolAta
  );

  const transfer = getTransferSolInstruction({
    source: params.payer,
    destination: wsolAta,
    amount: params.lamports,
  });

  const syncNative = getSyncNativeInstruction(wsolAta, tokenProgram);

  return [createAta, transfer, syncNative];
}

/**
 * Reads token account amount from raw account data (SPL token account layout).
 */
function decodeTokenAccountAmount(data: Uint8Array): bigint {
  if (data.length < TOKEN_ACCOUNT_AMOUNT_OFFSET + 8) return BigInt(0);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return view.getBigUint64(TOKEN_ACCOUNT_AMOUNT_OFFSET, true);
}

/**
 * Fetches WSOL ATA balance via RPC. Returns 0n if account missing or invalid.
 */
async function fetchWsolAtaBalance(rpc: KitRpc, ata: Address): Promise<bigint> {
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
 * Returns the instruction to unwrap WSOL (close WSOL ATA and send SOL to destination),
 * or null if the WSOL ATA has zero balance. Uses SDK's deriveAssociatedTokenAddress.
 * Owner must be provided as a signer when the app signs the transaction.
 */
export async function getUnwrapSOLInstructions(params: {
  owner: AddressLike | TransactionSigner<string>;
  rpc: KitRpc;
  destination?: AddressLike;
  tokenProgram?: AddressLike;
  wsolMint?: AddressLike;
}): Promise<Instruction<string>[] | null> {
  const destination = params.destination ?? (typeof params.owner === "object" && params.owner !== null && "address" in params.owner
    ? (params.owner as TransactionSigner<string>).address
    : toAddress(params.owner));
  const wsolMint = params.wsolMint ?? NATIVE_MINT;
  const tokenProgram = params.tokenProgram ?? TOKEN_PROGRAM_ADDRESS;

  const ownerAddress = toAddress(
    typeof params.owner === "object" && params.owner !== null && "address" in params.owner
      ? (params.owner as TransactionSigner<string>).address
      : params.owner
  );
  const wsolAta = await deriveAssociatedTokenAddress(ownerAddress, wsolMint);
  const balance = await fetchWsolAtaBalance(params.rpc, wsolAta);
  if (balance === BigInt(0)) return null;

  const close = getCloseAccountInstruction(
    wsolAta,
    destination,
    params.owner,
    tokenProgram
  );
  return [close];
}
