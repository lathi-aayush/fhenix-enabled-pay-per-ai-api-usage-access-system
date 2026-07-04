import { useState } from "react";

export default function X402Playground() {
  const [apiKey, setApiKey] = useState("");
  const [prompt, setPrompt] = useState("Say hello in one sentence.");
  const [output, setOutput] = useState("");

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold text-[#031634]">x402 Playground</h1>
      <p className="text-sm text-slate-600">
        Use a service detail page or <code>callProxyX402Use</code> from the SDK for live x402 tests.
        This page is a placeholder for interactive experiments.
      </p>
      <label className="block text-sm">
        API key
        <input
          className="mt-1 w-full border rounded-md px-3 py-2 font-mono text-sm"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-sentinel-..."
        />
      </label>
      <label className="block text-sm">
        Prompt
        <textarea
          className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </label>
      {output && (
        <pre className="bg-slate-50 border rounded-md p-3 text-xs overflow-x-auto">{output}</pre>
      )}
    </div>
  );
}
