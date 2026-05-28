import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const secret = process.env.JWT_SECRET;
const token = jwt.sign(
  {
    sub: "6a0db771f2881b150a8ed046", // Debjit123
    walletAddress: "KHSDQJZJ6QDNOZSYULRGD6TDVWH3DB7Q2XNSJ5L2X3XT6EJD5IRLZDGNME",
    role: "user",
  },
  secret,
  { expiresIn: "7d" }
);

async function run() {
  try {
    const res = await axios.get("http://localhost:5000/api/profile/burner", {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log("GET Response:", res.status, res.data);

    const syncRes = await axios.post("http://localhost:5000/api/profile/burner", 
      { mnemonic: "lecture rocket indicate pig veteran mixed planet above eye link crime island opera pass frost butter surprise narrow cook stable hunt topic city ability gown" },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log("POST Sync Response:", syncRes.status, syncRes.data);
  } catch (err) {
    console.error("Error:", err.response?.data || err.message);
  }
}

run();
