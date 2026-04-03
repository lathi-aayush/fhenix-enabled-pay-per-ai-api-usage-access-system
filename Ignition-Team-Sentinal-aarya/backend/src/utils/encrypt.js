import crypto from "crypto";

function deriveKey() {
  const raw = process.env.ENCRYPTION_KEY || "";
  if (!raw) {
    throw new Error("ENCRYPTION_KEY is not set");
  }
  return crypto.createHash("sha256").update(raw, "utf8").digest();
}

export function encryptSecret(plain) {
  if (typeof plain !== "string" || !plain) {
    throw new Error("Invalid secret to encrypt");
  }
  const iv = crypto.randomBytes(16);
  const key = deriveKey();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(b64) {
  const buf = Buffer.from(b64, "base64");
  if (buf.length < 32) {
    throw new Error("Invalid ciphertext");
  }
  const iv = buf.subarray(0, 16);
  const tag = buf.subarray(16, 32);
  const data = buf.subarray(32);
  const key = deriveKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
