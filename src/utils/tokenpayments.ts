// src/utils/tokenPayment.ts
import { Connection, PublicKey, Keypair, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { createTransferInstruction, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";

const connection = new Connection("https://api.devnet.solana.com", "confirmed");

const TOKEN_MINT = new PublicKey(process.env.VERITAS_TOKEN_MINT!);
const FEE_WALLET = new PublicKey(process.env.VERITAS_FEE_WALLET!);
const FEE_PAYER = Keypair.fromSecretKey(new Uint8Array(JSON.parse(process.env.FEE_PAYER_SECRET!)));
const BURN_ADDRESS = new PublicKey("11111111111111111111111111111111");

export async function handleTokenPayment(userPubkey: string, cost: number) {
  const user = new PublicKey(userPubkey);

  const userTokenAcc = await getAssociatedTokenAddress(TOKEN_MINT, user);
  const feeWalletTokenAcc = await getAssociatedTokenAddress(TOKEN_MINT, FEE_WALLET);
  const burnAmount = Math.floor(cost * 0.01);
  const feeAmount = cost - burnAmount;

  const burnTokenAcc = await getAssociatedTokenAddress(TOKEN_MINT, BURN_ADDRESS);

  const ix1 = createTransferInstruction(userTokenAcc, feeWalletTokenAcc, user, feeAmount, [], TOKEN_PROGRAM_ID);
  const ix2 = createTransferInstruction(userTokenAcc, burnTokenAcc, user, burnAmount, [], TOKEN_PROGRAM_ID);

  const tx = new Transaction().add(ix1, ix2);
  const sig = await sendAndConfirmTransaction(connection, tx, [FEE_PAYER]);

  return sig;
}

