import type { Address, Instruction, Rpc, SolanaRpcApi } from "@solana/kit";

export type AddressLike = Address | string;
export type KitRpc = Rpc<SolanaRpcApi>;

export interface BuiltTransaction {
  instructions: Instruction<string>[];
}
