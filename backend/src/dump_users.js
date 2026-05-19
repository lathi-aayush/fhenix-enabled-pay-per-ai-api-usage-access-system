import mongoose from "mongoose";

const MONGO_URI = "mongodb+srv://de-007:rB9byvhFige5Vbi8@learn-backend.skatr8c.mongodb.net/";

const userSchema = new mongoose.Schema(
  {
    walletAddress: { type: String },
    firebaseUid: { type: String },
    email: { type: String },
    displayName: { type: String },
    role: { type: String },
  },
  { collection: "users" }
);

const User = mongoose.model("User", userSchema);

async function run() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("Connected successfully. Fetching users...");
  const users = await User.find({});
  console.log(`Found ${users.length} users:`);
  console.log(JSON.stringify(users, null, 2));
  await mongoose.disconnect();
  console.log("Disconnected.");
}

run().catch(console.error);
