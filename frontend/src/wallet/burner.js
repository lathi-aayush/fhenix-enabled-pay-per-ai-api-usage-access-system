import algosdk from "algosdk";
import { signAndSendPayment } from "./pera.js";

// Storage key for the burner wallet
const BURNER_WALLET_KEY = "burner_wallet_mnemonic";

/**
 * Retrieves the Burner Wallet. If it doesn't exist, generates one and stores it.
 * @returns {algosdk.Account}
 */
export function getBurnerWallet() {
  const storedMnemonic = localStorage.getItem(BURNER_WALLET_KEY);
  if (storedMnemonic) {
    try {
      const acct = algosdk.mnemonicToSecretKey(storedMnemonic);
      return { addr: acct.addr.toString(), sk: acct.sk };
    } catch (e) {
      console.warn("Invalid mnemonic in local storage. Regenerating...");
    }
  }

  const newAccount = algosdk.generateAccount();
  const mnemonic = algosdk.secretKeyToMnemonic(newAccount.sk);
  localStorage.setItem(BURNER_WALLET_KEY, mnemonic);
  
  return { addr: newAccount.addr.toString(), sk: newAccount.sk };
}

/**
 * Fetch the current on-chain balance of the Burner Wallet.
 * @param {string} algodServer - Node URL
 * @returns {Promise<number>} - Balance in microAlgos
 */
export async function getBurnerBalance(algodServer) {
  const account = getBurnerWallet();
  const algod = new algosdk.Algodv2("", algodServer.trim(), "");
  
  try {
    const accountInfo = await algod.accountInformation(account.addr).do();
    return Number(accountInfo.amount);
  } catch (err) {
    if (err?.status === 404 || err?.response?.status === 404 || err?.message?.includes("404")) {
      // Account does not exist on-chain yet (zero balance)
      return 0;
    }
    throw err;
  }
}

/**
 * Fund the burner wallet from the connected Pera wallet.
 * @param {string} peraAddress - The connected Pera wallet address sent from
 * @param {number} amountMicroAlgos - The amount to fund
 * @param {string} algodServer - Node URL
 * @returns {Promise<{txId: string}>}
 */
export async function fundBurnerWallet(peraAddress, amountMicroAlgos, algodServer) {
  const burner = getBurnerWallet();
  
  // Use existing pera.js Pera wallet flow to fund the Burner.
  const { txId } = await signAndSendPayment({
    from: peraAddress,
    to: burner.addr,
    amountMicroAlgos,
    noteStr: "Fund Burner Wallet",
    algodServer
  });
  
  return { txId };
}

/**
 * Refund the entire remainder of the burner wallet back to the Pera address.
 * Close the account out entirely to recover the minimum balance.
 * 
 * @param {string} peraAddress - The connected Pera wallet address to refund to
 * @param {string} algodServer - Node URL
 * @returns {Promise<{txId: string}>}
 */
export async function refundBurnerWallet(peraAddress, algodServer) {
  const burner = getBurnerWallet();
  const algod = new algosdk.Algodv2("", algodServer.trim(), "");
  
  let accountInfo;
  try {
    accountInfo = await algod.accountInformation(burner.addr).do();
  } catch (err) {
    throw new Error(`Could not fetch burner balance: ${err.message}`);
  }

  const totalBalance = Number(accountInfo.amount);
  const params = await algod.getTransactionParams().do();
  const txFee = Number(params.fee) || 1000;
  
  if (totalBalance <= txFee) {
    throw new Error("Insufficient funds to cover network fee for refund.");
  }
  
  const refundAmount = totalBalance - txFee;
  
  // closeRemainderTo will send any additional MBR (minimum balance requirement) back to Pera
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: burner.addr,
    receiver: peraAddress,
    amount: refundAmount,
    note: new TextEncoder().encode("Refund from Burner Wallet"),
    suggestedParams: params,
    closeRemainderTo: peraAddress 
  });
  
  const signedTxn = txn.signTxn(burner.sk);
  const sendResult = await algod.sendRawTransaction(signedTxn).do();
  const txId = sendResult.txid || sendResult.txId;
  
  await algosdk.waitForConfirmation(algod, txId, 4);
  
  // Optional: clear out local storage since we closed the account
  localStorage.removeItem(BURNER_WALLET_KEY);
  
  return { txId };
}
