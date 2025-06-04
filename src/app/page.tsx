"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet }         from "@solana/wallet-adapter-react";
import { WalletConnectionProvider } from "@/components/WalletConnectionProvider";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Connection, Transaction } from "@solana/web3.js";

require("@solana/wallet-adapter-react-ui/styles.css");

/* ---------- types ---------- */
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

/* ---------- component ---------- */
export default function HomePage() {
  const [input,   setInput]   = useState("");
  const [mode,    setMode]    = useState("truth");
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [conversations, setConvos] = useState<Record<string,Conversation>>({});
  const [activeId, setActiveId] = useState("");
  const [copied,   setCopied ]  = useState<number|null>(null);
  const [loading,  setLoading]  = useState(false);
  const endRef = useRef<HTMLDivElement|null>(null);

  /* wallet */
  const { publicKey, sendTransaction } = useWallet();
  const connection = new Connection("https://api.devnet.solana.com");

  /* ---------- init / persistence ---------- */
  useEffect(() => {
    const stored = localStorage.getItem("veritas-conversations");
    if (stored) {
      const data = JSON.parse(stored);
      setConvos(data);
      const first = Object.keys(data)[0];
      if (first) setActiveId(first);
    } else createNewConversation();
  }, []);

  useEffect(() => {
    localStorage.setItem("veritas-conversations", JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }),
            [conversations, activeId]);

  /* ---------- helpers ---------- */
  function createNewConversation() {
    const id = Date.now().toString();
    setConvos(p => ({
      ...p,
      [id]: { id, title:"Untitled", createdAt:new Date().toISOString(), messages:[] }
    }));
    setActiveId(id);
  }

  const copy = (txt:string,i:number) => {
    navigator.clipboard.writeText(txt);
    setCopied(i);
    setTimeout(()=>setCopied(null),1500);
  };

  /* ---------- MAIN submit ---------- */
  async function handleSubmit() {
    if (!input.trim()) return;

    /* ensure wallet */
    if (!publicKey) {
      alert("Connect your wallet first (purple button top-left).");
      return;
    }

    setLoading(true);
    try {
      /* 1️⃣ ask backend for a tx that will take 100 tokens (static for now) */
      const body = {
        walletAddress: publicKey.toBase58(),
        amount: 100     // <-- hard-coded while we finish pricing logic
      };

      /* DEBUG: see exactly what we send */
      console.log("[tx-request body]", body);

      const resTx = await fetch("/api/tx-request", {
        method : "POST",
        headers: { "Content-Type":"application/json" },
        body   : JSON.stringify(body)
      });

      if (!resTx.ok) {
        const { error } = await resTx.json().catch(()=>({ error:"Tx-request failed" }));
        throw new Error(error || "Tx-request failed");
      }

      /* 2️⃣ sign & send */
      const { transaction } = await resTx.json();
      const tx = Transaction.from(Buffer.from(transaction,"base64"));
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig,"confirmed");

      /* 3️⃣ store user message */
      const userMsg:Message = { role:"user", content:input };
      setConvos(p=>({
        ...p,
        [activeId]: { ...p[activeId], messages:[...p[activeId].messages,userMsg]}
      }));
      setInput("");

      /* 4️⃣ call Veritas */
      const resAI = await fetch("/api/veritas", {
        method : "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({
          input, mode, search:searchEnabled,
          walletAddress: publicKey.toBase58(),
          amount: 100
        })
      });

      const data = await resAI.json();
      if (!resAI.ok) throw new Error(data.error || "AI response failed");

      const raw = data.result as string;
      const urls:string[] = [];
      const refs = [...raw.matchAll(/\[(\d+)\]/g)].map(m=>+m[1]);
      raw.split(/\n+/).forEach(line=>{
        const m = line.match(/^(\d+)\.\s.*?—\s(https?:\S+)/);
        if (m) urls[+m[1]] = m[2];
      });
      const aiMsg:Message = {
        role:"veritas",
        content:raw,
        sources: refs.map(i=>({ index:i, url:urls[i]})).filter(s=>s.url)
      };
      setConvos(p=>({
        ...p,
        [activeId]: { ...p[activeId], messages:[...p[activeId].messages, aiMsg]}
      }));

    } catch (err:any) {
      console.error(err);
      alert(err.message || "Unexpected error");
    } finally { setLoading(false); }
  }

  /* ---------- render helpers ---------- */
  const msgs = conversations[activeId]?.messages || [];
  const render = (m:Message)=>
    m.role==="veritas"
      ? m.sources?.reduce(
          (acc,s)=>acc.replace(`[${s.index}]`,`<a href="${s.url}" target="_blank">[${s.index}]</a>`),
          m.content)
      : m.content;

  /* ---------- UI ---------- */
  return (
    <WalletConnectionProvider>
      <div className="app-layout">
        <aside className="sidebar">
          <WalletMultiButton />
          <button className="new-chat" onClick={createNewConversation}>+ New Chat</button>
          <ul>{Object.values(conversations).map(c=>(
            <li key={c.id} className={`chat-item ${c.id===activeId?"active":""}`}>
              <input
                className="title-input"
                value={c.title}
                onChange={e=>updateTitle(c.id,e.target.value)}
                onClick={()=>setActiveId(c.id)}
              />
            </li>
          ))}</ul>
        </aside>

        <main className="chat-container">
          <h1 className="title">Veritas</h1>

          <div className="mode-select">
            {["truth","bias","steelman","audit"].map(m=>(
              <label key={m}>
                <input type="radio" name="mode" value={m}
                       checked={mode===m} onChange={()=>setMode(m)} />{" "}
                {m[0].toUpperCase()+m.slice(1)}
              </label>
            ))}
          </div>

          <label style={{margin:"0.5rem 0 1rem"}}>
            <input type="checkbox" checked={searchEnabled}
                   onChange={()=>setSearchEnabled(!searchEnabled)} /> Use Web Search 🔎
          </label>

          <div className="chat-box">
            {msgs.map((m,i)=>(
              <div key={i} className={`message ${m.role}`}>
                <strong>{m.role==="user"?"You":"Veritas"}:</strong>{" "}
                <span dangerouslySetInnerHTML={{__html:render(m)}} />
                {m.role==="veritas" && (
                  <button className="copy-button" onClick={()=>copy(m.content,i)}>
                    {copied===i?"✅":"📋"}
                  </button>
                )}
              </div>
            ))}
            {loading && <div className="message veritas"><strong>Veritas:</strong> thinking…</div>}
            <div ref={endRef}/>
          </div>

          <div className="input-area">
            <textarea className="text-input" placeholder="Ask Veritas anything…"
                      value={input} onChange={e=>setInput(e.target.value)}/>
            <button className="submit-button"
                    disabled={loading || !publicKey}
                    onClick={handleSubmit}>
              {loading?"Analyzing…":"Send"}
            </button>
          </div>
        </main>
      </div>
    </WalletConnectionProvider>
  );
}

