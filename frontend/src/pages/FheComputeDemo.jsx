import React from "react";
import MegaNav from "../components/MegaNav.jsx";
import FheComputeWidget from "../components/FheComputeWidget.jsx";

export default function FheComputeDemo() {
  return (
    <div className="min-h-screen bg-[#f3f4f6] selection:bg-violet-100 selection:text-violet-900">
      <MegaNav />
      <main className="relative pt-20 pb-16 px-4 sm:px-6">
        <FheComputeWidget />
      </main>
    </div>
  );
}
