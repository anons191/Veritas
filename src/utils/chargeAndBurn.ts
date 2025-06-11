// src/utils/chargeAndBurn.ts
import {
  Connection, PublicKey, Keypair
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  transferChecked, burnChecked
} from "@solana/spl-token";

const RPC  = "https://api.devnet.solana.com";
const conn = new Connection(RPC, "confirmed");

const MINT        = new PublicKey(process.env.VERITAS_TOKEN_MINT!);
const FEE_WALLET  = new PublicKey(process.env.VERITAS_FEE_WALLET!);

// fee-payer key == delegate authority
const DELEGATE    = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(process.env.FEE_PAYER_SECRET!))
);

/**
 * Charge `amount` VT from user (we are delegate), send to fee wallet, burn 1 %.
 */
export async function chargeAndBurn(
  userAddress: string,
  amount: number
): Promise<{ success: boolean; message?: string }> {
  try {
    const user = new PublicKey(userAddress);
    const userATA = await getAssociatedTokenAddress(MINT, user);
    const feeATA = await getAssociatedTokenAddress(MINT, FEE_WALLET);

    // convert token amount to raw units (assuming 9 decimals)
    const rawAmount = BigInt(Math.round(amount * 1e9));

    const burnAmount = rawAmount / 100n;
    const feeAmount = rawAmount - burnAmount;

    // 1. transfer from user → fee wallet (delegate signs)
    await transferChecked(
      conn,
      DELEGATE, // payer + signer (delegate)
      userATA,
      MINT,
      feeATA,
      DELEGATE, // authority = delegate
      feeAmount,
      9
    );

    // 2. burn from *fee wallet* account
    await burnChecked(
      conn,
      DELEGATE,
      feeATA,
      MINT,
      FEE_WALLET, // owner of fee ATA
      burnAmount,
      9
    );

    return { success: true };
  } catch (err: any) {
    console.error('chargeAndBurn failed:', err);
    return { success: false, message: err?.message ?? 'Charge failed' };
  }
}

