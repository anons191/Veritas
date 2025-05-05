// src/utils/verifyAndBurn.ts
import {
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  burn,
} from "@solana/spl-token";

const DEVNET = "https://api.devnet.solana.com";
const connection = new Connection(DEVNET, "confirmed");

const FEE_WALLET   = new PublicKey(process.env.VERITAS_FEE_WALLET!);
const MINT_ADDRESS = new PublicKey(process.env.VERITAS_TOKEN_MINT!);
const feePayer     = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(process.env.FEE_PAYER_SECRET!))
);

/**
 * Burn 1 % of the amount that was just transferred into the fee wallet.
 * `amount` is the number of tokens the frontend said it sent (in human units).
 */
export async function verifyAndBurnFee(
  _walletAddress: string,           // we don’t actually need it anymore
  amount: number                    // e.g. 100
) {
  try {
    // 1️⃣ locate / create fee wallet’s token account
    const feeTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      feePayer,
      MINT_ADDRESS,
      FEE_WALLET
    );

    // 2️⃣ burn 1 %
    const burnAmount = BigInt(Math.floor(amount * 0.01));

    await burn(
      connection,
      feePayer,                       // ⬅ owner of the fee account
      feeTokenAccount.address,
      MINT_ADDRESS,
      feePayer.publicKey,
      burnAmount
    );

    return { success: true };
  } catch (err) {
    console.error("Burn failed:", err);
    return { success: false, message: "Burn failed." };
  }
}

