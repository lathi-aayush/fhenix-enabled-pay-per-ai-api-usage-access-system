import { Router } from "express";
import { Conversation, Message } from "./models.js";
import { requireAuth } from "./middleware.js";
import { sentinalApi } from "./apiClient.js";
import algosdk from "algosdk";

const router = Router();

// Get all conversations for user
router.get("/conversations", requireAuth, async (req, res) => {
  try {
    const convos = await Conversation.find({ userId: req.user.userId }).sort({ updatedAt: -1 });
    res.json(convos);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

// Get user info and burner balance
router.get("/user-info", requireAuth, async (req, res) => {
  try {
    const profileRes = await sentinalApi.get("/api/profile/burner", {
      headers: { Authorization: `Bearer ${req.token}` }
    });
    const mnemonic = profileRes.data.mnemonic;
    if (!mnemonic) {
      return res.json({ balance: 0, address: null });
    }
    
    let account;
    try {
      account = algosdk.mnemonicToSecretKey(mnemonic.trim());
    } catch (e) {
      console.warn("Invalid burner mnemonic synced:", e.message);
      return res.json({ balance: 0, address: null });
    }

    const algodServer = process.env.ALGOD_SERVER || "https://testnet-api.algonode.cloud";
    const algod = new algosdk.Algodv2("", algodServer, "");
    
    let balanceAlgos = 0;
    try {
      const accountInfo = await algod.accountInformation(account.addr).do();
      balanceAlgos = Number(accountInfo.amount) / 1000000;
    } catch (err) {
      if (
        err?.status === 404 ||
        err?.response?.status === 404 ||
        err?.message?.includes("404") ||
        err?.message?.includes("does not exist")
      ) {
        // Account does not exist on-chain yet (zero balance)
        balanceAlgos = 0;
      } else {
        throw err;
      }
    }
    
    res.json({ balance: balanceAlgos, address: account.addr });
  } catch (err) {
    console.error("Failed to fetch user info:", err.message);
    res.status(500).json({ error: "Failed to fetch user info" });
  }
});

// Create a new conversation
router.post("/conversations", requireAuth, async (req, res) => {
  try {
    const convo = await Conversation.create({
      userId: req.user.userId,
      walletAddress: req.user.walletAddress,
      title: "New Chat",
    });
    res.json(convo);
  } catch (err) {
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

// Get messages for a conversation
router.get("/conversations/:id/messages", requireAuth, async (req, res) => {
  try {
    const convo = await Conversation.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!convo) return res.status(404).json({ error: "Not found" });
    const messages = await Message.find({ conversationId: convo._id }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

/**
 * Send payment from burner wallet to the developer wallet.
 */
async function payWithBurnerWallet(mnemonic, receiverAddress, amountMicroAlgos, paymentRef) {
  const algodServer = process.env.ALGOD_SERVER || "https://testnet-api.algonode.cloud";
  const algod = new algosdk.Algodv2("", algodServer, "");
  
  const account = algosdk.mnemonicToSecretKey(mnemonic.trim());
  const params = await algod.getTransactionParams().do();
  
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: account.addr,
    receiver: receiverAddress,
    amount: amountMicroAlgos,
    note: new TextEncoder().encode(paymentRef),
    suggestedParams: params,
  });
  
  const signedTxn = txn.signTxn(account.sk);
  const sendResult = await algod.sendRawTransaction(signedTxn).do();
  return sendResult.txid || sendResult.txId;
}

// Send a message and get AI response
router.post("/chat", requireAuth, async (req, res) => {
  try {
    const { conversationId, content } = req.body;
    if (!content) return res.status(400).json({ error: "Content is required" });

    let convo = null;
    if (conversationId) {
      convo = await Conversation.findOne({ _id: conversationId, userId: req.user.userId });
    }
    if (!convo) {
      convo = await Conversation.create({
        userId: req.user.userId,
        walletAddress: req.user.walletAddress,
        title: content.slice(0, 30) + (content.length > 30 ? "..." : ""),
      });
    }

    // Save user message
    await Message.create({
      conversationId: convo._id,
      role: "user",
      content,
    });

    // 1. Fetch Burner Wallet Mnemonic from Sentinal Main Backend
    let burnerMnemonic;
    try {
      const profileRes = await sentinalApi.get("/api/profile/burner", {
        headers: { Authorization: `Bearer ${req.token}` }
      });
      burnerMnemonic = profileRes.data.mnemonic;
      if (!burnerMnemonic) {
        return res.status(400).json({ error: "Burner wallet not configured. Please login to Sentinal main site." });
      }
    } catch (err) {
      console.error("Failed to fetch burner mnemonic:", err.message);
      return res.status(500).json({ error: "Failed to communicate with Sentinal" });
    }

    // 2. Fetch official Sentinal AI Proxy key
    let proxyKey;
    try {
      const keysRes = await sentinalApi.get("/api/user/proxy-keys", {
        headers: { Authorization: `Bearer ${req.token}` }
      });
      // Find a key for an official Sentinal Chat API
      const officialKeys = keysRes.data.filter(k => k.service && k.service.isSentinalOfficial);
      if (officialKeys.length === 0) {
        // If they don't have one, generate one!
        const servicesRes = await sentinalApi.get("/api/services");
        const officialService = servicesRes.data.find(s => s.isSentinalOfficial);
        if (!officialService) {
          return res.status(500).json({ error: "No official Sentinal API available" });
        }
        
        // Generate a new key for this official service
        const generateRes = await sentinalApi.post("/api/access/generate", { serviceId: officialService._id }, {
          headers: { Authorization: `Bearer ${req.token}` }
        });
        proxyKey = generateRes.data.key;
      } else {
        proxyKey = officialKeys[0].key;
      }
    } catch (err) {
      console.error("Failed to get official API key:", err.message);
      return res.status(500).json({ error: "Failed to configure Sentinal access" });
    }

    // 3. Request Quote from Sentinal API
    const authHeaders = { Authorization: `Bearer ${proxyKey}` };
    
    // We need to fetch conversation history for context!
    const history = await Message.find({ conversationId: convo._id }).sort({ createdAt: 1 });
    const messagesPayload = history.map(m => ({ role: m.role, content: m.content }));

    let quoteRes;
    try {
      quoteRes = await sentinalApi.post("/api/use", { messages: messagesPayload }, { headers: authHeaders });
    } catch (err) {
      console.error("Quote failed:", err.response?.data || err.message);
      return res.status(500).json({ error: "Failed to get AI quote" });
    }
    
    const { paymentRef, expectedMicroAlgos, developerWallet } = quoteRes.data;

    // 4. Pay using Burner Wallet
    let txId;
    try {
      txId = await payWithBurnerWallet(burnerMnemonic, developerWallet, expectedMicroAlgos, paymentRef);
    } catch (err) {
      console.error("Burner payment failed:", err);
      return res.status(402).json({ error: "Burner wallet payment failed. Ensure it has sufficient ALGO balance." });
    }

    // 5. Claim the AI Response
    let finalRes;
    try {
      // Need a small delay to let indexer catch up
      await new Promise(r => setTimeout(r, 3000));
      
      finalRes = await sentinalApi.post("/api/use", { txId, paymentRef }, { headers: authHeaders });
    } catch (err) {
      console.error("Claim failed:", err.response?.data || err.message);
      return res.status(500).json({ error: "AI response failed to process after payment" });
    }

    const aiText = finalRes.data.choices?.[0]?.message?.content || "No response";

    // 6. Save AI Response
    const aiMessage = await Message.create({
      conversationId: convo._id,
      role: "assistant",
      content: aiText,
      paymentTxId: txId,
    });

    res.json({
      conversationId: convo._id,
      message: aiMessage,
      receipt: finalRes.data.sentinelReceipt,
    });

  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "Internal chat error" });
  }
});

export default router;
