import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "./src/models/User.js";
import { decryptSecret } from "./src/utils/encrypt.js";

dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const user = await User.findById("6a0cbda44b2ceed95975eff9");
    if (!user) {
      console.log("User by ID 6a0cbda44b2ceed95975eff9 not found!");
      const allUsers = await User.find({});
      console.log("All users in DB:");
      allUsers.forEach(u => console.log(`- ID: ${u._id}, Name: ${u.displayName}, Email: ${u.email}`));
      return;
    }

    console.log("User found:", {
      id: user._id,
      displayName: user.displayName,
      email: user.email,
      walletAddress: user.walletAddress,
      burnerWalletEncrypted: user.burnerWalletEncrypted ? "Present" : "Missing/None",
    });

    if (user.burnerWalletEncrypted) {
      try {
        const decrypted = decryptSecret(user.burnerWalletEncrypted);
        console.log("Decrypted Mnemonic:", decrypted);
      } catch (err) {
        console.error("Failed to decrypt mnemonic:", err.message);
      }
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
