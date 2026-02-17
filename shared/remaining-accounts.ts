import { AccountRole, type AccountMeta, type Instruction } from "@solana/kit";
import { toAddress } from "../client/program";
import type { AddressLike } from "../client/types";

export interface RemainingAccountInput {
  address: AddressLike;
  isWritable: boolean;
  isSigner?: boolean;
}

function toAccountRole(input: RemainingAccountInput): AccountRole {
  if (input.isWritable) {
    return input.isSigner ? AccountRole.WRITABLE_SIGNER : AccountRole.WRITABLE;
  }

  return input.isSigner ? AccountRole.READONLY_SIGNER : AccountRole.READONLY;
}

export function appendRemainingAccounts(
  instruction: Instruction<string>,
  remainingAccounts: RemainingAccountInput[] | undefined
): Instruction<string> {
  if (!remainingAccounts?.length) {
    return instruction;
  }

  const extras = remainingAccounts.map(
    (account) =>
      ({
        address: toAddress(account.address),
        role: toAccountRole(account),
      }) as AccountMeta<string>
  );

  const existingAccounts = instruction.accounts ?? [];

  return {
    ...instruction,
    accounts: [...existingAccounts, ...extras],
  };
}
