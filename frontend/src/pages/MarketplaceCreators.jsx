import React from "react";
const creators = [
  { name: "Sentinel Core Labs", verified: true, apis: 6 },
  { name: "Algo Vision AI", verified: true, apis: 3 },
  { name: "Prompt Foundry", verified: false, apis: 4 },
];

export default function MarketplaceCreators() {
  return (
    <div className="max-w-5xl">
      <h1 className="font-headline text-2xl font-semibold text-primary mb-2">Creator Profiles</h1>
      <p className="text-sm text-on-surface-variant mb-6">Discover API creators, verification status, and listed endpoints.</p>
      <div className="space-y-3">
        {creators.map((creator) => (
          <div key={creator.name} className="bg-white border border-surface-variant rounded-md p-4 flex justify-between items-center">
            <div>
              <p className="font-semibold text-primary">{creator.name}</p>
              <p className="text-xs text-on-surface-variant mt-1">{creator.apis} listed APIs</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded ${creator.verified ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
              {creator.verified ? "Verified" : "Community"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
