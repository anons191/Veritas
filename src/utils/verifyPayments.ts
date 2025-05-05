// src/utils/verifyPayment.ts
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

const FEE_WALLET = process.env.FEE_WALLET_ADDRESS!; // must be a base58 string
const TOKEN_MINT = process.env.TOKEN_MINT_ADDRESS!;  // base58 mint address
const REQUIRED_AMOUNT = Number(process.env.TOKEN_COST!) || 0; // in token units (e.g. 0.002)

const NULL_ADDRESS = "11111111111111111111111111111111"; // Solana burn address

export async function verifyAndBurnToken(
  userAddress: string,
  connection: Connection
): Promise<{ success: boolean; message?: string }> {
  try {
    const { getParsedTokenAccountsByOwner, getConfirmedSignaturesForAddress2, getParsedTransaction } = connection;

    const user = new PublicKey(userAddress);
    const feeWallet = new PublicKey(FEE_WALLET);
    const mint = new PublicKey(TOKEN_MINT);

    // Get all token accounts for user for this mint
    const userAccounts = await getParsedTokenAccountsByOwner(user, {
      mint,
    });

    // Get recent transactions for fee wallet
    const recentSigs = await getConfirmedSignaturesForAddress2(feeWallet, { limit: 10 });
    for (const sig of recentSigs) {
      const tx = await getParsedTransaction(sig.signature, { commitment: "confirmed" });
      if (!tx) continue;

      const instructions = tx.transaction.message.instructions;
      const tokenTransfers = instructions.filter(
        (ix: any) => ix.program === "spl-token"
      );

      for (const ix of tokenTransfers) {
        const source = ix.parsed?.info?.source;
        const dest = ix.parsed?.info?.destination;
        const amount = parseInt(ix.parsed?.info?.amount || "0", 10);

        if (dest === FEE_WALLET && source && amount >= REQUIRED_AMOUNT * LAMPORTS_PER_SOL) {
          // Burn 1% of the token
          const burnAmount = Math.floor(amount * 0.01);
          // TO DO: Send burn tx here using server wallet (we'll implement after signing solution)
          return { success: true };
        }
      }
    }

    return { success: false, message: "No matching transaction found." };
  } catch (err) {
    console.error("Payment verification failed:", err);
    return { success: false, message: "Verification error." };
  }
}

