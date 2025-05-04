// src/app/api/tx-request/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  getMint,
} from "@solana/spl-token";

const DEVNET = "https://api.devnet.solana.com";
const connection = new Connection(DEVNET, "confirmed");

const MINT = new PublicKey(process.env.VERITAS_TOKEN_MINT!);
const FEE_WALLET = new PublicKey(process.env.VERITAS_FEE_WALLET!);

export async function POST(req: NextRequest) {
  try {
    const { walletAddress } = await req.json();
    if (!walletAddress) {
      return NextResponse.json({ error: "Missing wallet address" }, { status: 400 });
    }

    const user = new PublicKey(walletAddress);

    // Get associated token accounts
    const userATA = await getAssociatedTokenAddress(MINT, user);
    const feeWalletATA = await getAssociatedTokenAddress(MINT, FEE_WALLET);

    // Get mint info to calculate token precision
    const mintInfo = await getMint(connection, MINT);
    const decimals = mintInfo.decimals;

    // Convert 100 tokens to smallest unit (e.g., 100 * 10^6)
    const rawAmount = BigInt(100 * 10 ** decimals);

    // Check user balance
    const balanceRes = await connection.getTokenAccountBalance(userATA);
    const userBalance = BigInt(balanceRes.value.amount);
    if (userBalance < rawAmount) {
      return NextResponse.json({ error: "Insufficient token balance" }, { status: 402 });
    }

    // Create instruction and transaction
    const ix = createTransferInstruction(userATA, feeWalletATA, user, rawAmount);
    const tx = new Transaction().add(ix);
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.feePayer = user;

    // Serialize and encode as base64 safely
    const serializedTx = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
    const base64Tx = serializedTx.toString("base64");

    return NextResponse.json({ transaction: base64Tx });

  } catch (err) {
    console.error("Transaction build failed:", err);
    return NextResponse.json({ error: "Transaction creation failed" }, { status: 500 });
  }
}

