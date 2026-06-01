import algosdk from "algosdk";

function getIndexerClient(network) {
  const isMainnet = network.toLowerCase() === "mainnet";
  const server = isMainnet
    ? "https://mainnet-idx.algonode.cloud"
    : "https://testnet-idx.algonode.cloud";
  return new algosdk.Indexer("", server, "");
}

export async function runMonitor(options) {
  const { appId, network } = options;
  const applicationIndex = Number(appId);
  if (isNaN(applicationIndex) || applicationIndex <= 0) {
    throw new Error(`Invalid Sentinel application ID: ${appId}`);
  }

  const indexer = getIndexerClient(network);
  console.log(`\nStarting monitor for Sentinel App ID: ${applicationIndex} on ${network.toUpperCase()}`);
  console.log("Press Ctrl+C to terminate the monitor...\n");

  const seenTxs = new Set();
  let firstRun = true;

  async function poll() {
    try {
      const res = await indexer.searchForTransactions().applicationID(applicationIndex).do();
      const txs = res.transactions || [];
      
      // Sort older first so they print in chronological order
      txs.sort((a, b) => (a["round-time"] || 0) - (b["round-time"] || 0));

      let hasNew = false;
      for (const tx of txs) {
        const id = tx.id;
        if (seenTxs.has(id)) continue;
        seenTxs.add(id);

        if (firstRun) continue; // Don't spam terminal on start with historic logs

        hasNew = true;
        const sender = tx.sender;
        const block = tx["confirmed-round"];
        const time = tx["round-time"] ? new Date(tx["round-time"] * 1000).toLocaleTimeString() : "—";
        const noteBase64 = tx.note;
        let noteText = "No payload note";
        
        if (noteBase64) {
          try {
            noteText = Buffer.from(noteBase64, "base64").toString("utf-8");
          } catch {
            noteText = `Binary note: ${noteBase64}`;
          }
        }

        console.log(`[${time}] Block: #${block} | Tx: ${id.slice(0, 10)}…`);
        console.log(`  Sender:  ${sender}`);
        console.log(`  Payload: ${noteText}`);
        console.log("--------------------------------------------------------------------------------");
      }

      if (firstRun) {
        console.log(`Loaded ${seenTxs.size} historic transaction(s). Listening for new on-chain events...`);
        console.log("--------------------------------------------------------------------------------");
        firstRun = false;
      }
    } catch (e) {
      console.warn(`[monitor error] ${e.message}`);
    }
  }

  // Poll every 10 seconds
  await poll();
  setInterval(poll, 10000);
}
