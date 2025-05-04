"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { WalletConnectionProvider } from "@/components/WalletConnectionProvider";

const WalletButton = dynamic(() => import("@/components/WalletButton"), { ssr: false });

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
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("truth");
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [conversations, setConversations] = useState<Record<string, Conversation>>({});
  const [activeId, setActiveId] = useState<string>("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("veritas-conversations");
    if (stored) {
      const data = JSON.parse(stored);
      setConversations(data);
      const firstId = Object.keys(data)[0];
      if (firstId) setActiveId(firstId);
    } else {
      createNewConversation();
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("veritas-conversations", JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversations, activeId]);

  function createNewConversation() {
    const id = Date.now().toString();
    const newConvo: Conversation = {
      id,
      title: "Untitled",
      createdAt: new Date().toISOString(),
      messages: [],
    };
    setConversations((prev) => ({ ...prev, [id]: newConvo }));
    setActiveId(id);
  }

  function updateTitle(id: string, title: string) {
    setConversations((prev) => ({
      ...prev,
      [id]: { ...prev[id], title },
    }));
  }

  async function handleSubmit() {
    if (!input.trim() || !activeId) return;

    const userMessage: Message = { role: "user", content: input };
    setConversations((prev) => {
      const convo = prev[activeId];
      return {
        ...prev,
        [activeId]: {
          ...convo,
          messages: [...convo.messages, userMessage],
        },
      };
    });
    setInput("");
    setLoading(true);

    const res = await fetch("/api/veritas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: userMessage.content, mode, search: searchEnabled }),
    });
    const data = await res.json();

    const raw = data.result as string;
    const urls: string[] = [];
    const matched = [...raw.matchAll(/\[(\d+)\]/g)].map((m) => parseInt(m[1]));
    const lines = raw.split(/\n+/);

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^(\d+)\. .*?— (https?:[^\s]+)/);
      if (match) {
        urls[parseInt(match[1])] = match[2];
      }
    }

    const veritasReply: Message = {
      role: "veritas",
      content: raw,
      sources: matched.map((i) => ({ index: i, url: urls[i] })).filter(s => s.url),
    };

    setConversations((prev) => {
      const convo = prev[activeId];
      return {
        ...prev,
        [activeId]: {
          ...convo,
          messages: [...convo.messages, veritasReply],
        },
      };
    });
    setLoading(false);
  }

  function copyToClipboard(content: string, index: number) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(content);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = content;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        document.execCommand("copy");
      } catch (err) {
        alert("Copy failed.");
      }
      document.body.removeChild(textarea);
    }

    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  }

  const activeMessages = conversations[activeId]?.messages || [];

  function renderVeritasContent(msg: Message) {
    let rendered = msg.content;
    if (msg.sources?.length) {
      for (const { index, url } of msg.sources) {
        const tag = `[${index}]`;
        const link = `<a href="${url}" target="_blank" rel="noopener noreferrer">[${index}]</a>`;
        rendered = rendered.replace(tag, link);
      }
    }
    return rendered;
  }

  return (
    <WalletConnectionProvider>
      <div className="app-layout">
        <aside className="sidebar">
          <WalletButton />
          <button onClick={createNewConversation} className="new-chat">+ New Chat</button>
          <ul>
            {Object.values(conversations).map((c) => (
              <li key={c.id} className={`chat-item ${c.id === activeId ? "active" : ""}`}>
                <input
                  value={c.title}
                  onChange={(e) => updateTitle(c.id, e.target.value)}
                  onClick={() => setActiveId(c.id)}
                  className="title-input"
                />
              </li>
            ))}
          </ul>
        </aside>

        <main className="chat-container">
          <h1 className="title">Veritas</h1>

          <div className="mode-select">
            <label><input type="radio" name="mode" value="truth" checked={mode === "truth"} onChange={() => setMode("truth")} /> Truth</label>
            <label><input type="radio" name="mode" value="bias" checked={mode === "bias"} onChange={() => setMode("bias")} /> Bias</label>
            <label><input type="radio" name="mode" value="steelman" checked={mode === "steelman"} onChange={() => setMode("steelman")} /> Steelman</label>
            <label><input type="radio" name="mode" value="audit" checked={mode === "audit"} onChange={() => setMode("audit")} /> Audit</label>
          </div>

          <div style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
            <label>
              <input type="checkbox" checked={searchEnabled} onChange={() => setSearchEnabled(!searchEnabled)} /> Use Web Search 🔎
            </label>
          </div>

          <div className="chat-box">
            {activeMessages.map((msg, i) => (
              <div key={i} className={`message ${msg.role}`}>
                <strong>{msg.role === "user" ? "You" : "Veritas"}:</strong>{" "}
                <span
                  dangerouslySetInnerHTML={{ __html: msg.role === "veritas" ? renderVeritasContent(msg) : msg.content }}
                />
                {msg.role === "veritas" && (
                  <button className="copy-button" onClick={() => copyToClipboard(msg.content, i)}>
                    {copiedIndex === i ? "✅" : "📋"}
                  </button>
                )}
              </div>
            ))}
            {loading && <div className="message veritas"><strong>Veritas:</strong> thinking...</div>}
            <div ref={messagesEndRef} />
          </div>

          <div className="input-area">
            <textarea
              className="text-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Veritas anything..."
            />
            <button className="submit-button" onClick={handleSubmit} disabled={loading}>
              {loading ? "Analyzing..." : "Send"}
            </button>
          </div>
        </main>
      </div>
    </WalletConnectionProvider>
  );
}

