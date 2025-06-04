// src/app/api/allowance-request/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  Connection, PublicKey, Transaction, Keypair
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  getAccount,
  approveChecked   // delegate-approval helper
} from "@solana/spl-token";

const RPC  = "https://api.devnet.solana.com";
const conn = new Connection(RPC, "confirmed");

const MINT        = new PublicKey(process.env.VERITAS_TOKEN_MINT!);
const DELEGATE    = new PublicKey(process.env.VERITAS_FEE_WALLET!);   // our fee-payer key acts as delegate
const ALLOWANCE   = 1_000;                                            // 💰 ask user once for 1 000 VT

export async function POST(req: NextRequest) {
  const { walletAddress } = await req.json();
  if (!walletAddress) {
    return NextResponse.json({ error: "Missing wallet address" }, { status: 400 });
  }

  const user      = new PublicKey(walletAddress);
  const userATA   = await getAssociatedTokenAddress(MINT, user);

  // does a delegate + sufficient allowance already exist?
  const info = await getAccount(conn, userATA);
  if (info.delegate && info.delegate.equals(DELEGATE) && info.delegatedAmount >= BigInt(ALLOWANCE)) {
    return NextResponse.json({ alreadyApproved: true });
  }

  const tx = new Transaction().add(
    approveChecked(
      userATA,        // source
      MINT,
      DELEGATE,       // delegate (= backend)
      user,           // owner (signer)
      BigInt(ALLOWANCE),
      9               // decimals (devnet mint uses 9)
    )
  );
  tx.feePayer        = user;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;

  const b64 = tx.serialize({
    requireAllSignatures: false,
    verifySignatures:     false,
  }).toString("base64");

  return NextResponse.json({ transaction: b64 });
}

