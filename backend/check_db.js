import mongoose from "mongoose";
import dotenv from "dotenv";
import { Service } from "./src/models/Service.js";

dotenv.config();

async function run() {
  try {
    console.log("Connecting to:", process.env.MONGO_URI);
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB successfully!");

    const services = await Service.find({});
    console.log(`Found ${services.length} services:`);
    services.forEach(s => {
      console.log(`- Title: ${s.title}, Official: ${s.isSentinalOfficial}, Creator: ${s.creatorWallet}`);
    });

    // Check if an official service exists
    const official = await Service.findOne({ isSentinalOfficial: true });
    if (official) {
      console.log("Official service exists:", official.title);
    } else {
      console.log("No official service found! Seeding a default one...");
      
      // Let's clean up any empty/invalid services first
      await Service.deleteMany({ title: { $exists: false } });
      await Service.deleteMany({ title: "" });

      const newService = await Service.create({
        title: "Sentinal AI Official Chat",
        description: "Official Sentinal AI assistant powered by Groq LLama 3",
        pricePerThousandTokens: 0.005,
        minimumChargeAlgo: 0.01,
        creatorWallet: "ICM4Y4YVJWSBOV4LQIBXYVTHF2NDOJSUAPTX2DE4HQTPVDS5ZQCXP3MHLI",
        aiProvider: "groq",
        modelName: "llama3-8b-8192",
        isSentinalOfficial: true,
      });
      console.log("Successfully seeded official service:", newService.title);
    }
  } catch (err) {
    console.error("Error in scratch script:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected.");
  }
}

run();
