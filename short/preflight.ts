import { toAddress } from "../client/program";
import type { AddressLike, KitRpc } from "../client/types";
import type { OptionType } from "../generated";
import { fetchCollateralPool, fetchVault, fetchWriterPosition } from "../accounts/fetchers";
import { fetchPoolLoansByMaker } from "../accounts/list";
import { deriveAssociatedTokenAddress, deriveVaultPda, deriveWriterPositionPda } from "../accounts/pdas";
import { resolveOptionAccounts } from "../accounts/resolve-option";
import { invariant } from "../shared/errors";

const TOKEN_ACCOUNT_AMOUNT_OFFSET = 64;
const BPS_DENOMINATOR = 10_000n;

function readTokenAccountAmount(data: Uint8Array): bigint {
  if (data.length < TOKEN_ACCOUNT_AMOUNT_OFFSET + 8) return 0n;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return view.getBigUint64(TOKEN_ACCOUNT_AMOUNT_OFFSET, true);
}

async function fetchTokenAmount(rpc: KitRpc, tokenAccount: AddressLike): Promise<bigint> {
  const response = await rpc.getAccountInfo(toAddress(tokenAccount), { encoding: "base64" }).send();
  const info = response.value;
  if (!info) return 0n;
  const [base64Data] = info.data;
  if (!base64Data) return 0n;
  const decoded = atob(base64Data);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
  return readTokenAccountAmount(bytes);
}

function toBigInt(value: bigint | number): bigint {
  return typeof value === "bigint" ? value : BigInt(value);
}

export interface PreflightUnwindWriterUnsoldParams {
  underlyingAsset: AddressLike;
  optionType: OptionType;
  strikePrice: number;
  expirationDate: bigint | number;
  writer: AddressLike;
  unwindQty: bigint | number;
  rpc: KitRpc;
  programId?: AddressLike;
  underlyingMint?: AddressLike;
  writerRepaymentAccount?: AddressLike;
}

export interface UnwindLoanBreakdown {
  loanAddress: string;
  principal: bigint;
  accruedInterest: bigint;
  accruedProtocolFees: bigint;
  newlyAccruedInterest: bigint;
  newlyAccruedProtocolFees: bigint;
  totalInterest: bigint;
  totalProtocolFees: bigint;
  totalOwed: bigint;
}

export interface UnwindPreflightSummary {
  activeLoanCount: number;
  totalPrincipal: bigint;
  totalInterest: bigint;
  totalProtocolFees: bigint;
  totalOwed: bigint;
  /** Proportional obligations for partial unwind (based on unwind ratio) */
  proportionalPrincipal: bigint;
  proportionalInterest: bigint;
  proportionalProtocolFees: bigint;
  proportionalTotalOwed: bigint;
  /** Collateral return calculation */
  proportionalCollateralShare: bigint;
  returnableCollateral: bigint;
  collateralVaultAvailable: bigint;
  walletFallbackAvailable: bigint;
  walletFallbackRequired: bigint;
  shortfall: bigint;
  /** For top-up UX: explicit shortfall fields */
  collateralVaultShortfall: bigint;
  needsWalletTopUp: boolean;
}

export interface UnwindPreflightResult {
  canUnwind: boolean;
  canRepayFully: boolean;
  reason?: string;
  writerPositionAddress: string;
  writerRepaymentAccount: string;
  collateralVaultAddress: string;
  loans: Array<UnwindLoanBreakdown>;
  summary: UnwindPreflightSummary;
}

export async function preflightUnwindWriterUnsold(
  params: PreflightUnwindWriterUnsoldParams
): Promise<UnwindPreflightResult> {
  const resolved = await resolveOptionAccounts({
    underlyingAsset: params.underlyingAsset,
    optionType: params.optionType,
    strikePrice: params.strikePrice,
    expirationDate: params.expirationDate,
    programId: params.programId,
    rpc: params.rpc,
  });

  invariant(
    !!resolved.collateralVault && !!resolved.collateralPool && !!resolved.underlyingMint,
    "Option/collateral pool state is required for unwind preflight."
  );

  const underlyingMint = params.underlyingMint ?? resolved.underlyingMint;
  const [vaultPda] = await deriveVaultPda(underlyingMint, params.programId);
  const vaultPdaAddress = toAddress(vaultPda);
  const writerRepaymentAccount =
    params.writerRepaymentAccount ??
    (await deriveAssociatedTokenAddress(params.writer, underlyingMint));
  const writerRepaymentAddress = toAddress(writerRepaymentAccount);
  const [writerPositionAddress] = await deriveWriterPositionPda(
    resolved.optionPool,
    params.writer,
    params.programId
  );

  const [writerPosition, collateralPool, vault, loans, currentSlot] = await Promise.all([
    fetchWriterPosition(params.rpc, writerPositionAddress),
    fetchCollateralPool(params.rpc, resolved.collateralPool),
    fetchVault(params.rpc, vaultPda),
    fetchPoolLoansByMaker(params.rpc, params.writer),
    params.rpc.getSlot().send(),
  ]);

  invariant(!!writerPosition, "Writer position is required for unwind preflight.");
  invariant(!!collateralPool, "Collateral pool is required for unwind preflight.");
  invariant(!!vault, "Vault state is required for unwind preflight.");

  const unwindQty = toBigInt(params.unwindQty);
  const unsoldQty = toBigInt(writerPosition.unsoldQty);
  if (unwindQty <= 0n) {
    return {
      canUnwind: false,
      canRepayFully: false,
      reason: "unwindQty must be > 0",
      writerPositionAddress: String(writerPositionAddress),
      writerRepaymentAccount: String(writerRepaymentAddress),
      collateralVaultAddress: String(resolved.collateralVault),
      loans: [],
      summary: {
        activeLoanCount: 0,
        totalPrincipal: 0n,
        totalInterest: 0n,
        totalProtocolFees: 0n,
        totalOwed: 0n,
        proportionalPrincipal: 0n,
        proportionalInterest: 0n,
        proportionalProtocolFees: 0n,
        proportionalTotalOwed: 0n,
        proportionalCollateralShare: 0n,
        returnableCollateral: 0n,
        collateralVaultAvailable: 0n,
        walletFallbackAvailable: 0n,
        walletFallbackRequired: 0n,
        shortfall: 0n,
        collateralVaultShortfall: 0n,
        needsWalletTopUp: false,
      },
    };
  }
  if (unwindQty > unsoldQty) {
    return {
      canUnwind: false,
      canRepayFully: false,
      reason: "unwindQty exceeds writer unsold quantity",
      writerPositionAddress: String(writerPositionAddress),
      writerRepaymentAccount: String(writerRepaymentAddress),
      collateralVaultAddress: String(resolved.collateralVault),
      loans: [],
      summary: {
        activeLoanCount: 0,
        totalPrincipal: 0n,
        totalInterest: 0n,
        totalProtocolFees: 0n,
        totalOwed: 0n,
        proportionalPrincipal: 0n,
        proportionalInterest: 0n,
        proportionalProtocolFees: 0n,
        proportionalTotalOwed: 0n,
        proportionalCollateralShare: 0n,
        returnableCollateral: 0n,
        collateralVaultAvailable: 0n,
        walletFallbackAvailable: 0n,
        walletFallbackRequired: 0n,
        shortfall: 0n,
        collateralVaultShortfall: 0n,
        needsWalletTopUp: false,
      },
    };
  }

  const slotNow = toBigInt(currentSlot);
  const protocolFeeBps = BigInt(vault.protocolFeeBps);
  const slotsPerYear = 63_072_000n;
  const loanBreakdown: Array<UnwindLoanBreakdown> = [];

  for (const loan of loans) {
    if (toAddress(loan.data.vault) !== vaultPdaAddress || Number(loan.data.status) !== 1) continue;
    const principal = toBigInt(loan.data.principal);
    const accruedInterest = toBigInt(loan.data.accruedInterest);
    const accruedProtocolFees = toBigInt(loan.data.accruedProtocolFees);
    const rateBps = BigInt(loan.data.rateBps);
    const lastUpdateSlot = toBigInt(loan.data.lastUpdateSlot);
    const slotsElapsed = slotNow > lastUpdateSlot ? slotNow - lastUpdateSlot : 0n;
    const newlyAccruedInterest =
      slotsElapsed > 0n ? (principal * rateBps * slotsElapsed) / BPS_DENOMINATOR / slotsPerYear : 0n;
    const newlyAccruedProtocolFees =
      slotsElapsed > 0n
        ? (principal * protocolFeeBps * slotsElapsed) / BPS_DENOMINATOR / slotsPerYear
        : 0n;
    const totalInterest = accruedInterest + newlyAccruedInterest;
    const totalProtocolFees = accruedProtocolFees + newlyAccruedProtocolFees;
    const totalOwed = principal + totalInterest + totalProtocolFees;

    loanBreakdown.push({
      loanAddress: String(loan.address),
      principal,
      accruedInterest,
      accruedProtocolFees,
      newlyAccruedInterest,
      newlyAccruedProtocolFees,
      totalInterest,
      totalProtocolFees,
      totalOwed,
    });
  }

  const totals = loanBreakdown.reduce(
    (acc, item) => ({
      principal: acc.principal + item.principal,
      interest: acc.interest + item.totalInterest,
      fees: acc.fees + item.totalProtocolFees,
      owed: acc.owed + item.totalOwed,
    }),
    { principal: 0n, interest: 0n, fees: 0n, owed: 0n }
  );

  const [collateralVaultAvailable, walletFallbackAvailable] = await Promise.all([
    fetchTokenAmount(params.rpc, resolved.collateralVault!),
    fetchTokenAmount(params.rpc, writerRepaymentAddress),
  ]);

  // Calculate proportional obligations for partial unwinds
  const writtenQty = toBigInt(writerPosition.writtenQty);
  const unwindRatio = writtenQty > 0n ? (unwindQty * 1_000_000n) / writtenQty : 0n; // Basis points precision
  const unwindRatioDecimal = Number(unwindRatio) / 1_000_000; // Convert to decimal

  // Proportional obligations (for partial unwind logic)
  const proportionalPrincipal = writtenQty > 0n ? (totals.principal * unwindQty) / writtenQty : 0n;
  const proportionalInterest = writtenQty > 0n ? (totals.interest * unwindQty) / writtenQty : 0n;
  const proportionalProtocolFees = writtenQty > 0n ? (totals.fees * unwindQty) / writtenQty : 0n;
  const proportionalTotalOwed = proportionalPrincipal + proportionalInterest + proportionalProtocolFees;

  // Collateral return calculation (proportional share minus proportional obligations)
  const collateralDeposited = toBigInt(writerPosition.collateralDeposited);
  const proportionalCollateralShare = writtenQty > 0n ? (collateralDeposited * unwindQty) / writtenQty : 0n;
  const returnableCollateral = proportionalCollateralShare > proportionalTotalOwed
    ? proportionalCollateralShare - proportionalTotalOwed
    : 0n;

  // Calculate shortfall against proportional obligations
  const walletFallbackRequired =
    proportionalTotalOwed > collateralVaultAvailable ? proportionalTotalOwed - collateralVaultAvailable : 0n;
  const totalAvailable = collateralVaultAvailable + walletFallbackAvailable;
  const shortfall = proportionalTotalOwed > totalAvailable ? proportionalTotalOwed - totalAvailable : 0n;

  // For top-up UX: explicit collateral vault shortfall
  const collateralVaultShortfall = returnableCollateral > collateralVaultAvailable
    ? returnableCollateral - collateralVaultAvailable
    : 0n;
  const needsWalletTopUp = collateralVaultShortfall > 0n && walletFallbackAvailable < collateralVaultShortfall;

  return {
    canUnwind: true,
    canRepayFully: shortfall === 0n,
    reason: shortfall === 0n ? undefined : "Insufficient combined collateral vault + writer fallback funds",
    writerPositionAddress: String(writerPositionAddress),
    writerRepaymentAccount: String(writerRepaymentAddress),
    collateralVaultAddress: String(resolved.collateralVault),
    loans: loanBreakdown,
    summary: {
      activeLoanCount: loanBreakdown.length,
      totalPrincipal: totals.principal,
      totalInterest: totals.interest,
      totalProtocolFees: totals.fees,
      totalOwed: totals.owed,
      proportionalPrincipal,
      proportionalInterest,
      proportionalProtocolFees,
      proportionalTotalOwed,
      proportionalCollateralShare,
      returnableCollateral,
      collateralVaultAvailable,
      walletFallbackAvailable,
      walletFallbackRequired,
      shortfall,
      collateralVaultShortfall,
      needsWalletTopUp,
    },
  };
}
