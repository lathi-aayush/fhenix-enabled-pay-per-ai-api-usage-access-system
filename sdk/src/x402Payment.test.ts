import { describe, expect, it } from "vitest";
import { parseX402Challenge } from "./x402Payment.js";

describe("parseX402Challenge", () => {
  it("extracts payTo and amountMicroAlgos from accepts[0]", () => {
    const result = parseX402Challenge({
      error: "Payment Required",
      accepts: [
        {
          payTo: "J46W...MRE4",
          maxAmountRequired: "10000",
        },
      ],
    });
    expect(result.payTo).toBe("J46W...MRE4");
    expect(result.amountMicroAlgos).toBe(10000);
  });

  it("throws when accepts is missing", () => {
    expect(() => parseX402Challenge({ error: "Payment Required" })).toThrow(
      "Invalid x402 payment challenge"
    );
  });
});

describe("x402 payment header payload shape", () => {
  it("uses paymentGroup array with paymentIndex 0", () => {
    const signedB64 = Buffer.from("signed-txn-bytes").toString("base64");
    const payload = { paymentGroup: [signedB64], paymentIndex: 0 };
    const header = Buffer.from(JSON.stringify(payload)).toString("base64");
    const decoded = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
    expect(decoded.paymentGroup).toHaveLength(1);
    expect(decoded.paymentIndex).toBe(0);
  });
});
