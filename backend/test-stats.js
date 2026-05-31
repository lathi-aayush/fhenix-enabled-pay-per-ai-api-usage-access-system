import "./src/loadEnv.js";
import { connectDb } from "./src/config/db.js";
import { getPlatformStats } from "./src/services/platformStats.js";

async function run() {
  try {
    console.log("Connecting to db...");
    await connectDb();
    console.log("Fetching platform stats...");
    const stats = await getPlatformStats();
    console.log("Stats successfully fetched:", JSON.stringify(stats, null, 2));
  } catch (e) {
    console.error("FAILED with error:", e);
  } finally {
    process.exit(0);
  }
}

run();
