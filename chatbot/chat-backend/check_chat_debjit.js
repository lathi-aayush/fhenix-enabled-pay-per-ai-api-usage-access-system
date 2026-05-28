import mongoose from "mongoose";
import dotenv from "dotenv";
import { Conversation, Message } from "./models.js";

dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to Chat MongoDB");

    const convos = await Conversation.find({ userId: "6a0db771f2881b150a8ed046" });
    console.log(`Found ${convos.length} conversations for Debjit123.`);

    for (const c of convos) {
      console.log(`\nConversation ID: ${c._id}`);
      console.log(`Title: ${c.title}`);
      
      const msgs = await Message.find({ conversationId: c._id }).sort({ createdAt: 1 });
      console.log(`Messages (${msgs.length}):`);
      msgs.forEach(m => {
        console.log(`- [${m.role}] (Paid: ${m.paymentTxId || "No"}): ${m.content.slice(0, 80)}`);
      });
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
