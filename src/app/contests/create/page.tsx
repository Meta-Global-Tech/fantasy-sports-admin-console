"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { CreateContestForm } from "@/components/CreateContestForm";
import { useState, Suspense } from "react";

function CreateContestContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [matchId, setMatchId] = useState(searchParams.get("matchId") || "");

  const handleSuccess = () => {
    alert("Contest created successfully!");
    if (matchId) {
      router.push("/matches");
    }
  };

  return (
    <div className="min-h-screen bg-[#050508] text-white p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Create New Contest</h1>
          <p className="text-slate-400">
            Set up a new fantasy contest for a specific match.
          </p>
        </div>

        <div className="bg-[#0d0d14] border border-white/10 rounded-2xl p-8 shadow-2xl">
          {!searchParams.get("matchId") && (
            <div className="mb-8">
              <label className="text-xs text-slate-500 uppercase block mb-2 ml-1">
                Match ID
              </label>
              <input
                type="text"
                value={matchId}
                onChange={(e) => setMatchId(e.target.value)}
                placeholder="Enter Match ID"
                className="w-full bg-[#050508] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors shadow-inner"
              />
            </div>
          )}

          {matchId ? (
            <CreateContestForm
              matchId={matchId}
              onSuccess={handleSuccess}
            />
          ) : (
            <div className="text-center py-12 border border-dashed border-white/5 rounded-xl">
              <p className="text-slate-500 italic">Please enter a Match ID to proceed</p>
            </div>
          )}
        </div>

        <div className="mt-8 flex justify-center">
          <button
            onClick={() => router.back()}
            className="text-slate-500 hover:text-white transition-colors text-sm font-medium"
          >
            ← Back to Application
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CreateContestPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050508] flex items-center justify-center"><div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div></div>}>
      <CreateContestContent />
    </Suspense>
  );
}
