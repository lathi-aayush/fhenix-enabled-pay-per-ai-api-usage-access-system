import mongoose from "mongoose";
import dotenv from "dotenv";
import { Service } from "./src/models/Service.js";
import { encryptSecret } from "./src/utils/encrypt.js";

dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const official = await Service.findOne({ isSentinalOfficial: true });
    if (!official) {
      console.log("Official service not found! Please seed it first.");
      return;
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.log("GROQ_API_KEY is not defined in .env!");
      return;
    }

    console.log("Encrypting API key...");
    const encrypted = encryptSecret(apiKey);
    
    official.encryptedApiKey = encrypted;
    official.aiProvider = "groq";
    official.modelName = "llama-3.3-70b-versatile";
    await official.save();

    console.log("Successfully updated official service with encryptedApiKey!");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
