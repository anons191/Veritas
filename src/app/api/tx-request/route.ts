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
  getMint,
} from "@solana/spl-token";

const RPC = "https://api.devnet.solana.com";
const connection = new Connection(RPC, "confirmed");

const MINT       = new PublicKey(process.env.VERITAS_TOKEN_MINT!);
const FEE_WALLET = new PublicKey(process.env.VERITAS_FEE_WALLET!);

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, amount } = await req.json();
    if (!walletAddress || typeof amount !== "number") {
      return NextResponse.json({ error: "Missing wallet address or amount" }, { status: 400 });
    }

    const user    = new PublicKey(walletAddress);
    const userATA = await getAssociatedTokenAddress(MINT, user);
    const feeATA  = await getAssociatedTokenAddress(MINT, FEE_WALLET);

    // convert human‑readable token amount → raw u64 units
    const mintInfo = await getMint(connection, MINT);
    const decimals = mintInfo.decimals;
    const rawAmount = BigInt(Math.round(amount * 10 ** decimals));

    // check balance
    const bal = await connection.getTokenAccountBalance(userATA);
    if (BigInt(bal.value.amount) < rawAmount) {
      return NextResponse.json({ error: "Insufficient token balance" }, { status: 402 });
    }

    const tx = new Transaction();

    // create fee ATA if needed (payer = user)
    if (!(await connection.getAccountInfo(feeATA))) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          user,        // payer & signer
          feeATA,
          FEE_WALLET,
          MINT
        )
      );
    }

    // transfer dynamic amount
    tx.add(createTransferInstruction(userATA, feeATA, user, rawAmount));

    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.feePayer = user;

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

