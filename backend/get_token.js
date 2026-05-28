import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const secret = process.env.JWT_SECRET;
const token = jwt.sign(
  {
    sub: "6a0db771f2881b150a8ed046", // Debjit123 userId
    walletAddress: "AGQYRQPXUTBLVP6KCLOJWMVRZB7LO2ADKVVUUNKKBW3FEGF5IOUPNPRBWQ",
    role: "user",
    displayName: "Debjit123",
    email: "debjitdebnath2978@gmail.com",
    photoURL: "https://lh3.googleusercontent.com/a/default-user",
  },
  secret,
  { expiresIn: "7d" }
);

console.log("TOKEN=" + token);
