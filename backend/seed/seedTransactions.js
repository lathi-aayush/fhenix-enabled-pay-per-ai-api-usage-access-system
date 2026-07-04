/**
 * seedTransactions.js
 * -------------------
 * Populates MongoDB with realistic fake transaction data
 * so the /api/prediction/usage endpoint has something to work with.
 *
 * Usage:
 *   node seed/seedTransactions.js
 *   node seed/seedTransactions.js --clear   â† wipes existing demo transactions first
 */

import "dotenv/config";
import mongoose from "mongoose";
import crypto from "crypto";
import { Transaction } from "../src/models/Transaction.js";

// â”€â”€ Config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("âŒ MONGO_URI not set in .env");
  process.exit(1);
}

// A stable fake ObjectId used as the serviceId for all seed transactions.
// This avoids needing a real Service document in the DB.
const DEMO_SERVICE_ID = new mongoose.Types.ObjectId("aaaaaa000000000000000001");

// Fake wallets â€” replace with real addresses from your User collection if needed
const DEMO_WALLETS = [
  "DEMOWALLETAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  "DEMOWALLETTBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
  "DEMOWALLETTCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
];

// â”€â”€ Realistic usage profile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Monthly base spend (ETH) per wallet â€” grows slightly each month to show a trend
const MONTHLY_BASE = {
  wallet0: [0.8, 1.1, 0.9, 1.4, 1.8, 2.1],  // steady growth
  wallet1: [0.4, 0.3, 0.6, 0.5, 0.7, 0.9],  // slow ramp-up
  wallet2: [1.5, 1.2, 1.8, 2.2, 1.9, 2.6],  // higher usage, slight variance
};

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function randBetween(min, max) {
  return Math.random() * (max - min) + min;
}

/** Spread `totalEth` across `count` transactions with realistic jitter */
function splitIntoTxns(totalEth, count) {
  const pieces = [];
  let remaining = totalEth;
  for (let i = 0; i < count - 1; i++) {
    const share = remaining * randBetween(0.05, 0.35);
    pieces.push(parseFloat(share.toFixed(6)));
    remaining -= share;
  }
  pieces.push(parseFloat(remaining.toFixed(6)));
  return pieces;
}

/** Random date within a given month, biased toward working hours */
function randomDateInMonth(year, month) {
  const start = new Date(year, month, 1);
  const end   = new Date(year, month + 1, 0); // last day of month
  const day   = Math.floor(randBetween(start.getDate(), end.getDate() + 1));
  const hour  = Math.floor(randBetween(8, 22)); // 8amâ€“10pm
  const min   = Math.floor(randBetween(0, 60));
  return new Date(year, month, day, hour, min);
}

// â”€â”€ Seed â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log("âœ… Connected to MongoDB");

  // Optional: clear existing seed data
  if (process.argv.includes("--clear")) {
    const result = await Transaction.deleteMany({ userWallet: { $in: DEMO_WALLETS } });
    console.log(`ðŸ—‘  Cleared ${result.deletedCount} existing demo transactions`);
  }

  const now       = new Date();
  const docs      = [];
  const walletKeys = ["wallet0", "wallet1", "wallet2"];

  // Build 6 months of history (current month - 6 â†’ current month - 1)
  for (let monthOffset = 5; monthOffset >= 0; monthOffset--) {
    const d     = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
    const year  = d.getFullYear();
    const month = d.getMonth(); // 0-indexed

    walletKeys.forEach((key, wi) => {
      const baseEth  = MONTHLY_BASE[key][5 - monthOffset];
      const jitter    = randBetween(0.9, 1.1); // Â±10% natural variance
      const totalEth = parseFloat((baseEth * jitter).toFixed(6));
      const txCount   = Math.floor(randBetween(4, 12)); // 4â€“11 txns per month

      const amounts = splitIntoTxns(totalEth, txCount);

      amounts.forEach((amount) => {
        docs.push({
          amount,
          userWallet:      DEMO_WALLETS[wi],
          serviceId:       DEMO_SERVICE_ID,
          paymentIntentId: crypto.randomUUID(), // required + unique
          status:          "verified",
          createdAt:       randomDateInMonth(year, month),
        });
      });
    });
  }

  // Shuffle so insertion order isn't perfectly chronological
  docs.sort(() => Math.random() - 0.5);

  await Transaction.insertMany(docs, { ordered: false });

  console.log(`\nðŸŒ± Seeded ${docs.length} transactions across ${DEMO_WALLETS.length} demo wallets`);
  console.log("   Wallets:");
  DEMO_WALLETS.forEach((w, i) => console.log(`   [${i}] ${w}`));
  console.log("\n   Monthly totals seeded (ETH):");
  walletKeys.forEach((key, wi) => {
    const totals = MONTHLY_BASE[key].map((v) => v.toFixed(2)).join(" â†’ ");
    console.log(`   Wallet ${wi}: ${totals}`);
  });

  console.log("\nâœ… Done. Test your endpoints:");
  console.log(`   GET /api/prediction/usage?wallet=${DEMO_WALLETS[0]}`);
  console.log(`   GET /api/prediction/usage   (platform-wide, all wallets)`);
  console.log(`   GET /api/prediction/history`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("âŒ Seed failed:", err.message);
  process.exit(1);
});
