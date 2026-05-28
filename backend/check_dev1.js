import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "./src/models/User.js";

dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const user = await User.findById("6a0cbda44b2ceed95975eff9");
    console.log("User dev1:", user);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
