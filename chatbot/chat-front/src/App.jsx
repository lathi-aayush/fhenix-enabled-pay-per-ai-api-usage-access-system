import { useState, useEffect, useRef, useCallback } from 'react';
import logo from './assets/logo.png';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { AuthProvider, useAuth, api } from './AuthContext';
import './style.css';

const SENTINEL_URL = import.meta.env.VITE_SENTINEL_URL || 'https://sentinal-j4ox.onrender.com';

/* ── SVG helpers ── */
const IconShield = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L3 7v6c0 5.25 3.75 10.15 9 11.35C17.25 23.15 21 18.25 21 13V7l-9-5z" />
  </svg>
);
const IconPlus = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}>
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const IconChat = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);
const IconExternalLink = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{width:10,height:10}}>
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);
const IconLogout = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{width:16,height:16}}>
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);
const IconSend = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
  </svg>
);
const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const IconWallet = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}>
    <rect x="2" y="6" width="20" height="14" rx="2" /><path d="M16 14a1 1 0 010-2 1 1 0 010 2z" fill="currentColor" /><path d="M2 10h20" />
  </svg>
);
const IconCopy = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}>
    <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </svg>
);
const IconX = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{width:16,height:16}}>
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const IconRefresh = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}} {...props}>
    <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
  </svg>
);
const IconBot = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <circle cx="12" cy="7" r="3" />
    <line x1="8" y1="16" x2="8" y2="16" strokeWidth={3} />
    <line x1="12" y1="16" x2="12" y2="16" strokeWidth={3} />
    <line x1="16" y1="16" x2="16" y2="16" strokeWidth={3} />
  </svg>
);

/* ─────────────────────────────────────────────
   LOGIN SCREEN
───────────────────────────────────────────── */
function LoginScreen() {
  const { loginWithGoogle, isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/" replace />;

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">
          <IconShield />
        </div>
        <h1 className="login-title">Sentinel Chat</h1>
        <p className="login-sub">Sign in with your Sentinel profile to start chatting. Every message is paid automatically via your Burner Wallet on Algorand.</p>

        <button onClick={loginWithGoogle} className="btn-google">
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" />
          Continue with Google
        </button>

        <p className="login-footer">
          Powered by the <a href={SENTINEL_URL} target="_blank" rel="noopener noreferrer">Sentinel Marketplace</a> · Algorand TestNet
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   TOP-UP MODAL
───────────────────────────────────────────── */
function TopUpModal({ address, balance, onClose, onRefresh, refreshing, onInstantTopUp, funding }) {
  const [copied, setCopied] = useState(false);

  function copyAddress() {
    if (!address) return;
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      toast.success('Address copied!');
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-row">
            <div className="modal-icon"><IconWallet /></div>
            <h2 className="modal-title">Top Up Burner Wallet</h2>
          </div>
          <button onClick={onClose} className="modal-close" aria-label="Close"><IconX /></button>
        </div>

        {/* Balance */}
        <div className="modal-balance-row">
          <span className="modal-balance-label">Current Balance</span>
          <span className="modal-balance-amount">
            {balance !== null ? `${Number(balance).toFixed(4)} ALGO` : '—'}
          </span>
        </div>

        {/* Instant Refill */}
        <div className="modal-section instant-section">
          <label className="modal-section-label">Instant Fund (TestNet Only)</label>
          <p className="modal-section-hint">Instantly transfer 2 ALGO from our on-chain developer faucet directly to your burner wallet.</p>
          <button 
            onClick={onInstantTopUp} 
            className={`btn-instant ${funding ? 'funding' : ''}`}
            disabled={funding || !address}
          >
            {funding ? (
              <>
                <IconRefresh className="spin" style={{marginRight: 6}} />
                Dispensing 2 ALGO...
              </>
            ) : (
              <>
                <IconWallet style={{marginRight: 6}} />
                Instant Refill 2 ALGO
              </>
            )}
          </button>
        </div>

        {/* Address */}
        <div className="modal-section">
          <label className="modal-section-label">Your Burner Wallet Address</label>
          <p className="modal-section-hint">This address is unique to your account. Send ALGO here from any Algorand wallet.</p>
          <div className="modal-address-box">
            <span className="modal-address-text">{address || 'Loading…'}</span>
            <button onClick={copyAddress} className={`btn-copy ${copied ? 'copied' : ''}`} disabled={!address}>
              {copied ? <IconCheck /> : <IconCopy />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Faucet */}
        <div className="modal-section">
          <label className="modal-section-label">Need Test ALGO?</label>
          <p className="modal-section-hint">Use the Algorand TestNet dispenser to get free test ALGO instantly.</p>
          <a
            href={`https://bank.testnet.algorand.network/?account=${address || ''}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-faucet"
          >
            Open Algorand TestNet Faucet <IconExternalLink />
          </a>
        </div>

        {/* Refresh */}
        <div className="modal-footer">
          <p className="modal-footer-note">After sending ALGO, click below to update your balance.</p>
          <button onClick={onRefresh} className="btn-refresh" disabled={refreshing}>
            <IconRefresh className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh Balance'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   CHAT INTERFACE
───────────────────────────────────────────── */
function ChatInterface() {
  const { user, logout } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConvo, setActiveConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [burnerBalance, setBurnerBalance] = useState(null);
  const [burnerAddress, setBurnerAddress] = useState(null);
  const [showTopUp, setShowTopUp] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [funding, setFunding] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const isLowBalance = burnerBalance !== null && Number(burnerBalance) < 0.05;

  useEffect(() => { fetchConversations(); fetchBurnerInfo(); }, []);
  useEffect(() => { if (activeConvo) fetchMessages(activeConvo._id); }, [activeConvo]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function fetchBurnerInfo() {
    try {
      const res = await api.get('/user-info');
      setBurnerBalance(res.data.balance);
      setBurnerAddress(res.data.address);
    } catch (e) { console.error(e); }
  }

  const handleInstantTopUp = useCallback(async () => {
    if (funding) return;
    setFunding(true);
    const loadingToast = toast.loading('Initiating on-chain dispenser transfer...');
    try {
      const res = await api.post('/topup');
      toast.dismiss(loadingToast);
      if (res.data.txId) {
        toast.success(`Success! Dispensed 10 ALGO on-chain.\nTx ID: ${res.data.txId.slice(0, 16)}...`, {
          duration: 6000
        });
      } else {
        toast.success('Successfully dispensed 10 ALGO to burner wallet!');
      }
      
      // Update local wallet address state if returned
      if (res.data.address) {
        setBurnerAddress(res.data.address);
      }
      // Refresh user info
      const infoRes = await api.get('/user-info');
      setBurnerBalance(infoRes.data.balance);
      setBurnerAddress(infoRes.data.address);
    } catch (err) {
      toast.dismiss(loadingToast);
      console.error(err);
      const errMsg = err.response?.data?.error || err.message || 'Unknown error';
      toast.error(`Instant Funding failed: ${errMsg}`, {
        duration: 5000
      });
    } finally {
      setFunding(false);
    }
  }, [funding]);

  const handleRefreshBalance = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await api.get('/user-info');
      setBurnerBalance(res.data.balance);
      setBurnerAddress(res.data.address);
      toast.success(`Balance updated: ${Number(res.data.balance).toFixed(4)} ALGO`);
    } catch (e) {
      toast.error('Failed to refresh balance');
    } finally {
      setRefreshing(false);
    }
  }, []);

  async function fetchConversations() {
    try {
      const res = await api.get('/conversations');
      setConversations(res.data);
      if (res.data.length > 0 && !activeConvo) setActiveConvo(res.data[0]);
    } catch (e) { console.error(e); }
  }

  async function fetchMessages(convoId) {
    try {
      const res = await api.get(`/conversations/${convoId}/messages`);
      setMessages(res.data);
    } catch (e) { console.error(e); }
  }

  function handleNewChat() {
    setActiveConvo(null);
    setMessages([]);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    setInput('');
    setLoading(true);
    setMessages(prev => [...prev, { role: 'user', content: userMessage, _id: Date.now() }]);

    try {
      const res = await api.post('/chat', { conversationId: activeConvo?._id, content: userMessage });
      setMessages(prev => [...prev, res.data.message]);
      if (!activeConvo) {
        fetchConversations();
        setActiveConvo({ _id: res.data.conversationId, title: userMessage.slice(0, 32) });
      }
      fetchBurnerInfo();
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'An error occurred. Please make sure your Burner Wallet has sufficient ALGO on the Sentinel website.',
        _id: Date.now(),
        isError: true,
      }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          {/* Logo */}
          <a href={SENTINEL_URL} target="_blank" rel="noopener noreferrer" className="sidebar-logo" style={{textDecoration:'none'}}>
            <div className="sidebar-logo-mark" style={{ width: 28, height: 28, borderRadius: '6px', overflow: 'hidden', backgroundColor: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--clr-border)', padding: '2px' }}>
              <img src={logo} alt="Sentinel Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div>
              <div className="sidebar-logo-text">Sentinel</div>
              <div className="sidebar-logo-sub">AI Chat</div>
            </div>
          </a>

          <button onClick={handleNewChat} className="btn-new-chat">
            New conversation
            <IconPlus />
          </button>
        </div>

        {/* Conversation list */}
        <nav className="convo-list" aria-label="Conversations">
          {conversations.length === 0 && (
            <p style={{fontSize:12, color:'var(--clr-text-faint)', padding:'12px 10px', margin:0}}>No conversations yet</p>
          )}
          {conversations.map(c => (
            <button
              key={c._id}
              onClick={() => setActiveConvo(c)}
              className={`convo-item ${activeConvo?._id === c._id ? 'active' : ''}`}
              title={c.title}
            >
              {c.title || 'Untitled'}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          {/* Burner wallet card */}
          <div className={`burner-card ${isLowBalance ? 'low-balance' : ''}`}>
            <div className="burner-card-row">
              <span className="burner-label">Burner Wallet</span>
              <span className="burner-amount">
                {burnerBalance !== null ? `${Number(burnerBalance).toFixed(4)} ALGO` : '—'}
              </span>
            </div>
            {isLowBalance && (
              <div className="burner-low-warning">
                <span className="warning-dot"></span>
                <span>Low Balance: Please refill to continue chatting</span>
              </div>
            )}
            <div className="burner-actions">
              <button onClick={() => setShowTopUp(true)} className="btn-topup">
                <IconWallet /> Top Up
              </button>
              <a href={`${SENTINEL_URL}/dashboard/home`} target="_blank" rel="noopener noreferrer" className="burner-link">
                Dashboard <IconExternalLink />
              </a>
            </div>
          </div>

          {/* Top Up Modal */}
          {showTopUp && (
            <TopUpModal
              address={burnerAddress}
              balance={burnerBalance}
              onClose={() => setShowTopUp(false)}
              onRefresh={handleRefreshBalance}
              refreshing={refreshing}
              onInstantTopUp={handleInstantTopUp}
              funding={funding}
            />
          )}

          {/* User row */}
          <div className="user-row">
            {user?.photoURL
              ? <img src={user.photoURL} alt="User" className="user-avatar" />
              : <div className="user-avatar-placeholder" />}
            <span className="user-name">{user?.displayName || user?.email}</span>
            <button onClick={logout} className="btn-logout" title="Sign out" aria-label="Sign out">
              <IconLogout />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main area ── */}
      <main className="chat-main">
        <div className="messages-area">
          {messages.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><IconChat /></div>
              <h2 className="empty-title">How can I help you?</h2>
              <p className="empty-sub">
                Powered by the Sentinel AI marketplace. Each response is automatically paid using your Burner Wallet on Algorand TestNet — no manual signing needed.
              </p>
            </div>
          ) : (
            <div className="messages-list">
              {messages.map((m, i) => (
                <div key={m._id || i} className={`msg-row ${m.role}`}>
                  {m.role === 'assistant' && (
                    <div className="msg-avatar"><IconBot /></div>
                  )}
                  <div className={`msg-bubble ${m.role === 'user' ? 'user' : m.isError ? 'error' : 'assistant'}`}>
                    <p>{m.content}</p>
                    {m.paymentTxId && (
                      <div className="msg-receipt">
                        <IconCheck />
                        Paid via Burner · tx {m.paymentTxId.slice(0, 8)}…
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="msg-row assistant">
                  <div className="msg-avatar"><IconBot /></div>
                  <div className="msg-bubble assistant">
                    <div className="typing-dots">
                      <div className="dot" />
                      <div className="dot" />
                      <div className="dot" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="input-bar">
          <div className="input-inner">
            <form onSubmit={sendMessage} className="input-form">
              <input
                ref={inputRef}
                type="text"
                className="input-field"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Message Sentinel Chat…"
                disabled={loading}
                autoComplete="off"
              />
              <button
                type="submit"
                className="btn-send"
                disabled={!input.trim() || loading}
                aria-label="Send message"
              >
                <IconSend />
              </button>
            </form>
            <p className="input-hint">
              Sentinel Chat may make mistakes. Verify important information independently.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ─────────────────────────────────────────────
   ROUTING
───────────────────────────────────────────── */
function MainLayout() {
  const { loading, isAuthenticated } = useAuth();
  if (loading) return (
    <div className="loading-screen">
      <div className="loading-spinner" />
      <span className="loading-text">Loading Sentinel Chat…</span>
    </div>
  );
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <ChatInterface />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              background: '#031634',
              color: '#fff',
              borderRadius: 8,
            },
          }}
        />
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/" element={<MainLayout />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
