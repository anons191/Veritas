// src/utils/solanaPayment.ts
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  createTransferInstruction,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";

const TOKEN_MINT = new PublicKey(process.env.VERITAS_TOKEN_MINT!);
const FEE_WALLET = new PublicKey(process.env.VERITAS_FEE_WALLET!);
const BURN_WALLET = new PublicKey("11111111111111111111111111111111");

const payerKey = Uint8Array.from(JSON.parse(process.env.FEE_PAYER_SECRET!));
const PAYER = Keypair.fromSecretKey(payerKey);
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

export async function processTokenPayment(user: PublicKey, amount: number) {
  const feeAmount = Math.floor(amount * 0.99);
  const burnAmount = amount - feeAmount;

  const userATA = await getOrCreateAssociatedTokenAccount(connection, PAYER, TOKEN_MINT, user);
  const feeATA = await getOrCreateAssociatedTokenAccount(connection, PAYER, TOKEN_MINT, FEE_WALLET);
  const burnATA = await getOrCreateAssociatedTokenAccount(connection, PAYER, TOKEN_MINT, BURN_WALLET);

  const tx = new Transaction().add(
    createTransferInstruction(userATA.address, feeATA.address, user, feeAmount),
    createTransferInstruction(userATA.address, burnATA.address, user, burnAmount)
  );

  const signature = await sendAndConfirmTransaction(connection, tx, [PAYER]);
  return signature;
}

