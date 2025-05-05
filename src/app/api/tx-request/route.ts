// src/app/api/tx-request/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddress,
  getAccount,
  getMint,
} from "@solana/spl-token";

const RPC = "https://api.devnet.solana.com";
const connection = new Connection(RPC, "confirmed");

const MINT        = new PublicKey(process.env.VERITAS_TOKEN_MINT!);
const FEE_WALLET  = new PublicKey(process.env.VERITAS_FEE_WALLET!);

export async function POST(req: NextRequest) {
  try {
    const { walletAddress } = await req.json();
    if (!walletAddress) {
      return NextResponse.json({ error: "Missing wallet address" }, { status: 400 });
    }

    // 0. Actor addresses
    const user      = new PublicKey(walletAddress);
    const userATA   = await getAssociatedTokenAddress(MINT, user);        // PDA
    const feeATA    = await getAssociatedTokenAddress(MINT, FEE_WALLET);  // PDA

    // 1. Ensure user has enough balance (100 tokens)
    const mint      = await getMint(connection, MINT);
    const decimals  = mint.decimals;
    const amount    = 100n * 10n ** BigInt(decimals);                     // BigInt u64

    const balRes    = await connection.getTokenAccountBalance(userATA);
    if (BigInt(balRes.value.amount) < amount) {
      return NextResponse.json({ error: "Insufficient token balance" }, { status: 402 });
    }

    // 2. Build transaction
    const tx = new Transaction();

    // (a)  create fee wallet ATA if it doesn’t exist
    const feeInfo = await connection.getAccountInfo(feeATA);
    if (!feeInfo) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          user,          // payer (will sign)
          feeATA,
          FEE_WALLET,
          MINT
        )
      );
    }

    // (b)  transfer 100 tokens → fee wallet
    tx.add(
      createTransferInstruction(userATA, feeATA, user, amount)
    );

    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.feePayer        = user;  // Phantom signs & pays

    const base64Tx = tx.serialize({
      requireAllSignatures: false,
      verifySignatures:     false,
    }).toString("base64");

    return NextResponse.json({ transaction: base64Tx });
  } catch (err) {
    console.error("Transaction build failed:", err);
    return NextResponse.json({ error: "Transaction creation failed" }, { status: 500 });
  }
}

