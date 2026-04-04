import { Service } from "../models/Service.js";

/**
 * Migrates legacy flat `price` to token pricing (price/500, price/10) and removes `price`.
 */
export async function migrateServicePricing() {
  try {
    const res = await Service.collection.updateMany(
      {
        price: { $exists: true },
        pricePerThousandTokens: { $exists: false },
      },
      [
        {
          $set: {
            pricePerThousandTokens: {
              $cond: [{ $gt: ["$price", 0] }, { $divide: ["$price", 500] }, 0],
            },
            minimumChargeAlgo: {
              $max: [
                { $cond: [{ $gt: ["$price", 0] }, { $divide: ["$price", 10] }, 0] },
                0.001,
              ],
            },
          },
        },
        { $unset: "price" },
      ]
    );
    if (res.modifiedCount > 0) {
      console.log(`[migrate] servicePricing: updated ${res.modifiedCount} service(s)`);
    }
    const leftover = await Service.collection.updateMany({ price: { $exists: true } }, [
      { $unset: "price" },
    ]);
    if (leftover.modifiedCount > 0) {
      console.log(`[migrate] servicePricing: removed legacy price from ${leftover.modifiedCount} service(s)`);
    }
  } catch (e) {
    console.error("[migrate] servicePricing failed:", e?.message || e);
  }
}
