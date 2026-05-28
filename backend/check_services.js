import mongoose from "mongoose";
import dotenv from "dotenv";
import { Service } from "./src/models/Service.js";

dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const services = await Service.find({});
    console.log(`Found ${services.length} services:`);
    for (const s of services) {
      console.log(`\nService ID: ${s._id}`);
      console.log(`Name: ${s.name}`);
      console.log(`Creator Wallet: ${s.creatorWallet}`);
      console.log(`isSentinalOfficial: ${s.isSentinalOfficial}`);
      console.log(`aiProvider: ${s.aiProvider}`);
      console.log(`modelName: ${s.modelName}`);
      console.log(`encryptedApiKey: ${s.encryptedApiKey ? "Present" : "Missing"}`);
      console.log(`isPaused: ${s.isPaused}`);
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
