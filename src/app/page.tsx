// src/app/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletConnectionProvider } from "@/components/WalletConnectionProvider";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Connection, Transaction } from "@solana/web3.js";

require("@solana/wallet-adapter-react-ui/styles.css");

interface Message {
  role: "user" | "veritas";
  content: string;
  sources?: { index: number; url: string }[];
}
interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  messages: Message[];
}

export default function HomePage() {
  /* -------------- state -------------- */
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("truth");
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [conversations, setConversations] = useState<Record<string, Conversation>>({});
  const [activeId, setActiveId] = useState<string>("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const { publicKey, sendTransaction } = useWallet();
  const connection = new Connection("https://api.devnet.solana.com");

  /* -------------- init / persistence -------------- */
  useEffect(() => {
    const stored = localStorage.getItem("veritas-conversations");
    if (stored) {
      const data = JSON.parse(stored);
      setConversations(data);
      const first = Object.keys(data)[0];
      if (first) setActiveId(first);
    } else createNewConversation();
  }, []);

  useEffect(() => {
    localStorage.setItem("veritas-conversations", JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversations, activeId]);

  /* -------------- helpers -------------- */
  function createNewConversation() {
    const id = Date.now().toString();
    setConversations((p) => ({
      ...p,
      [id]: { id, title: "Untitled", createdAt: new Date().toISOString(), messages: [] },
    }));
    setActiveId(id);
  }

  function updateTitle(id: string, title: string) {
    setConversations((p) => ({ ...p, [id]: { ...p[id], title } }));
  }

  function copyToClipboard(content: string, i: number) {
    navigator.clipboard?.writeText(content);
    setCopiedIndex(i);
    setTimeout(() => setCopiedIndex(null), 1500);
  }

  /* -------------- main submit -------------- */
  async function handleSubmit() {
    if (!input.trim() || !publicKey) return;
    setLoading(true);

    try {
      /* 1️⃣  request tx */
      const resTx = await fetch("/api/tx-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: publicKey.toBase58() }),
      });
      if (!resTx.ok) throw new Error("Tx-request failed");
      const { transaction } = await resTx.json();           // <-- expect `transaction`
      const tx = Transaction.from(Buffer.from(transaction, "base64"));

      /* 2️⃣  sign + send */
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");

      /* 3️⃣  store user msg */
      const userMsg: Message = { role: "user", content: input };
      setConversations((p) => ({
        ...p,
        [activeId]: { ...p[activeId], messages: [...p[activeId].messages, userMsg] },
      }));
      setInput("");

      /* 4️⃣  call Veritas */
      const resAI = await fetch("/api/veritas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input,
          mode,
          search: searchEnabled,
          walletAddress: publicKey.toBase58(),
        }),
      });
      const { result } = await resAI.json();

      /* 5️⃣  parse sources */
      const urls: string[] = [];
      const refs = [...result.matchAll(/\\[(\\d+)\\]/g)].map((m) => parseInt(m[1]));
      result.split(/\\n+/).forEach((line) => {
        const m = line.match(/^(\\d+)\\. .*?— (https?:[^\\s]+)/);
        if (m) urls[parseInt(m[1])] = m[2];
      });
      const veritasMsg: Message = {
        role: "veritas",
        content: result,
        sources: refs.map((i) => ({ index: i, url: urls[i] })).filter((s) => s.url),
      };

      setConversations((p) => ({
        ...p,
        [activeId]: { ...p[activeId], messages: [...p[activeId].messages, veritasMsg] },
      }));
    } catch (err: any) {
      console.error(err);
      alert(err.message ?? "Error");
    } finally {
      setLoading(false);
    }
  }

  /* -------------- render helpers -------------- */
  const activeMessages = conversations[activeId]?.messages || [];
  const renderMsg = (m: Message) =>
    m.role === "veritas"
      ? m.sources?.reduce(
          (acc, s) => acc.replace(`[${s.index}]`, `<a href=\"${s.url}\" target=\"_blank\">[${s.index}]</a>`),
          m.content
        )
      : m.content;

  /* -------------- UI -------------- */
  return (
    <WalletConnectionProvider>
      <div className="app-layout">
        <aside className="sidebar">
          <WalletMultiButton />
          <button className="new-chat" onClick={createNewConversation}>+ New Chat</button>
          <ul>
            {Object.values(conversations).map((c) => (
              <li key={c.id} className={`chat-item ${c.id === activeId ? "active" : ""}`}>
                <input
                  className="title-input"
                  value={c.title}
                  onChange={(e) => updateTitle(c.id, e.target.value)}
                  onClick={() => setActiveId(c.id)}
                />
              </li>
            ))}
          </ul>
        </aside>

        <main className="chat-container">
          <h1 className="title">Veritas</h1>

          <div className="mode-select">
            {["truth", "bias", "steelman", "audit"].map((m) => (
              <label key={m}>
                <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} />{" "}
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </label>
            ))}
          </div>

          <label style={{ margin: "0.5rem 0 1rem" }}>
            <input type="checkbox" checked={searchEnabled} onChange={() => setSearchEnabled(!searchEnabled)} /> Use Web
            Search 🔎
          </label>

          <div className="chat-box">
            {activeMessages.map((m, i) => (
              <div key={i} className={`message ${m.role}`}>
                <strong>{m.role === "user" ? "You" : "Veritas"}:</strong>{" "}
                <span dangerouslySetInnerHTML={{ __html: renderMsg(m) }} />
                {m.role === "veritas" && (
                  <button className="copy-button" onClick={() => copyToClipboard(m.content, i)}>
                    {copiedIndex === i ? "✅" : "📋"}
                  </button>
                )}
              </div>
            ))}
            {loading && (
              <div className="message veritas">
                <strong>Veritas:</strong> thinking...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="input-area">
            <textarea
              className="text-input"
              placeholder="Ask Veritas anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button className="submit-button" disabled={loading} onClick={handleSubmit}>
              {loading ? "Analyzing…" : "Send"}
            </button>
          </div>
        </main>
      </div>
    </WalletConnectionProvider>
  );
}

