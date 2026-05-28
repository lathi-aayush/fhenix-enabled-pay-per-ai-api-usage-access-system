import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { getBurnerWallet } from "../../wallet/burner.js";
import ReactMarkdown from "react-markdown";
import { toast } from "react-hot-toast";
import algosdk from "algosdk";

const EXPLORER_TX = "https://testnet.algoexplorer.io/tx/";

export default function StudioChat() {
  const { user, burnerReady } = useAuth();
  const location = useLocation();

  const [services, setServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);

  const messagesEndRef = useRef(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streaming]);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const { data } = await api.get("/api/x402/services");
        setServices(data.services || []);
        
        const params = new URLSearchParams(location.search);
        const sid = params.get("serviceId");
        if (sid && data.services.some(s => s.id === sid)) {
          setSelectedServiceId(sid);
        } else if (data.services.length > 0) {
          setSelectedServiceId(data.services[0].id);
        }
      } catch (err) {
        console.error("Failed to load services", err);
      }
    };
    fetchServices();
  }, [location.search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || !selectedServiceId) return;

    const userMessage = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      if (!burnerReady) throw new Error("Burner wallet is not ready.");
      const burnerWallet = getBurnerWallet();

      // Step 1: Request quote (402 Payment Required expected)
      let challengeData;
      try {
        await api.post(`/api/x402/use/${selectedServiceId}`, {
          messages: newMessages,
          stream: true
        });
        throw new Error("Expected 402 Payment Required, but request succeeded without payment.");
      } catch (err) {
        if (err.response && err.response.status === 402) {
          challengeData = err.response.data;
        } else {
          throw err;
        }
      }

      const acceptReq = challengeData.accepts[0];
      const amountMicroAlgos = Number(acceptReq.maxAmountRequired);

      // Step 2: Pay on-chain
      toast.info(`Paying ${amountMicroAlgos / 1e6} ALGO to start stream...`);
      const algodUrl = import.meta.env.VITE_ALGORAND_NODE || "https://testnet-api.algonode.cloud";
      const algodClient = new algosdk.Algodv2("", algodUrl, "");
      
      const params = await algodClient.getTransactionParams().do();
      const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: burnerWallet.addr,
        receiver: acceptReq.payTo,
        amount: BigInt(amountMicroAlgos),
        suggestedParams: params,
        note: new TextEncoder().encode("SentinelAI Chat Stream"),
      });

      const signedTxn = txn.signTxn(burnerWallet.sk);
      const txId = txn.txID();
      await algodClient.sendRawTransaction(signedTxn).do();

      // Wait for confirmation
      let confirmedTx = null;
      let attempts = 0;
      while (!confirmedTx && attempts < 10) {
        try {
          confirmedTx = await algodClient.pendingTransactionInformation(txId).do();
          if (confirmedTx["confirmed-round"]) break;
        } catch (e) {}
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      if (!confirmedTx) {
        throw new Error("Transaction confirmation timed out.");
      }

      const paymentPayload = {
        paymentGroup: [Buffer.from(signedTxn).toString("base64")],
        paymentIndex: 0,
      };
      const xPaymentHeader = Buffer.from(JSON.stringify(paymentPayload)).toString("base64");

      // Step 3: Stream Response
      setStreaming(true);
      
      // Add empty assistant message placeholder
      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      const response = await fetch(`${api.defaults.baseURL || ""}/api/x402/use/${selectedServiceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment': xPaymentHeader,
          ...(api.defaults.headers.common || {})
        },
        body: JSON.stringify({ messages: newMessages, stream: true })
      });

      if (!response.ok) {
        throw new Error(`Stream request failed with status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split(/\r?\n\r?\n/);
        buffer = parts.pop(); // keep the last incomplete chunk in the buffer

        for (const part of parts) {
          const lines = part.split(/\r?\n/);
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                const text = parsed.choices?.[0]?.delta?.content || "";
                if (text) {
                  setMessages(prev => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    last.content += text;
                    return updated;
                  });
                }
              } catch (e) {}
            }
          }
        }
      }
      
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || err.message || "Failed to chat.");
      // Remove placeholder if it failed
      setMessages(prev => prev.filter(m => m.content !== ""));
    } finally {
      setLoading(false);
      setStreaming(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm m-6" style={{ height: "calc(100vh - 120px)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">AI Chat</h2>
          <p className="text-sm text-slate-500">Pay per token using your Burner Wallet.</p>
        </div>
        <div>
          <select 
            className="border border-slate-300 rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            value={selectedServiceId}
            onChange={(e) => setSelectedServiceId(e.target.value)}
          >
            <option value="" disabled>Select an AI Service</option>
            {services.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.model})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400">
            <p>Send a message to start chatting.</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-xl px-4 py-3 shadow-sm ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-white border border-slate-200 text-slate-800'}`}>
                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <div className="prose prose-sm max-w-none prose-slate">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {(loading && !streaming) && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm flex items-center gap-2 text-slate-500">
              <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
              <span className="text-sm">Paying & Confirming...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-slate-200 shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            className="flex-1 border border-slate-300 rounded-full px-5 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-inner"
            placeholder="Type your message..."
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={loading || streaming}
          />
          <button 
            type="submit"
            disabled={!input.trim() || loading || streaming || !selectedServiceId}
            className="bg-primary text-white w-12 h-12 rounded-full flex items-center justify-center hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined">send</span>
          </button>
        </form>
      </div>
    </div>
  );
}
