"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { adminApi } from "@/lib/api";
import { Wallet, Transaction, WalletWithTransactions } from "@/types";
import { formatDate } from "@/lib/utils";

function WalletsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialWalletId = searchParams.get("walletId") || "";

  const [walletIdInput, setWalletIdInput] = useState(initialWalletId);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | number | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchWalletData = async (id: string, cursor?: string | number, isLoadMore = false) => {
    if (!id) return;
    
    try {
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
        // Don't clear wallet if we are searching for the same one, but the user expects a fresh load on new search
        if (!isLoadMore) {
          setTransactions([]);
          setNextCursor(null);
        }
      }

      // Fetch balance and transactions
      // We explicitly fetch balance via getWalletBalance and transactions via getWalletTransactions
      const [walletData, transactionsData] = await Promise.all([
        !isLoadMore ? adminApi.getWalletBalance(id) : Promise.resolve(null),
        adminApi.getWalletTransactions(id, {
          pageSize: 20,
          cursor,
        }),
      ]);

      if (walletData) {
        setWallet(walletData);
      } else if (transactionsData && !wallet) {
        // Fallback if loadMore but wallet state missing
        setWallet({
          id: transactionsData.id,
          balance: transactionsData.balance,
          currency: transactionsData.currency,
        });
      }

      const items = transactionsData.transactions?.items || [];
      if (isLoadMore) {
        setTransactions((prev) => [...prev, ...items]);
      } else {
        setTransactions(items);
      }

      setNextCursor(transactionsData.transactions?.nextCursor ?? null);
      setHasMore(transactionsData.transactions?.hasMore ?? false);

    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to fetch wallet data. Make sure the Wallet ID is correct.");
      console.error(err);
      if (!isLoadMore) {
        setWallet(null);
        setTransactions([]);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Initial fetch if walletId is in URL
  useEffect(() => {
    if (initialWalletId) {
      fetchWalletData(initialWalletId);
    }
  }, [initialWalletId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletIdInput.trim()) return;
    
    // Update URL
    const params = new URLSearchParams(searchParams);
    params.set("walletId", walletIdInput.trim());
    router.push(`/wallets?${params.toString()}`);
    
    fetchWalletData(walletIdInput.trim());
  };

  const handleLoadMore = () => {
    if (nextCursor && !loadingMore && initialWalletId) {
      fetchWalletData(initialWalletId, nextCursor, true);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto min-h-full">
      {/* Header section with gradient background */}
      <div className="relative mb-10 p-8 rounded-3xl bg-gradient-to-br from-emerald-500/10 via-cyan-500/5 to-transparent border border-white/5 overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px]" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
              </svg>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Wallet Explorer</h1>
          </div>
          <p className="text-slate-400 text-sm max-w-xl leading-relaxed mb-8">
            Inspect any user or system wallet in the ecosystem. Access real-time balances, currency details, and full transaction logs with pagination.
          </p>

          <form onSubmit={handleSearch} className="flex gap-3 max-w-2xl mb-4">
            <div className="relative flex-1 group">
              <div className="absolute inset-y-0 left-0 pl-1 flex items-center pointer-events-none group-focus-within:text-emerald-400 text-slate-500 transition-colors pl-4">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Enter Wallet ID (e.g. user_123_usd)..."
                value={walletIdInput}
                onChange={(e) => setWalletIdInput(e.target.value)}
                className="w-full bg-[#050508]/60 border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all placeholder:text-slate-600 text-white"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !walletIdInput.trim()}
              className="px-8 py-3 bg-white text-black font-bold rounded-2xl hover:bg-emerald-400 transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 transform active:scale-95"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
              ) : (
                "Search"
              )}
            </button>
          </form>

          {/* Suggestions */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mr-2">Quick Access:</span>
            {["CONTEST_COLLECTION", "SYSTEM_STRIPE", "SYSTEM_WITHDRAWAL"].map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  setWalletIdInput(suggestion);
                  // Update URL and trigger search implicitly via initial fetch or explicitly
                  const params = new URLSearchParams(searchParams);
                  params.set("walletId", suggestion);
                  router.push(`/wallets?${params.toString()}`);
                  fetchWalletData(suggestion);
                }}
                className="text-[10px] font-bold px-3 py-1.5 rounded-full bg-white/5 hover:bg-emerald-500/10 hover:text-emerald-400 border border-white/5 hover:border-emerald-500/20 text-slate-400 transition-all active:scale-95"
              >
                {suggestion}
              </button>
            ))}
          </div>

        </div>
      </div>

      {error && (
        <div className="mb-10 p-5 rounded-2xl bg-red-500/5 border border-red-500/20 text-red-400 text-sm flex items-start gap-4 animate-in fade-in zoom-in-95 duration-300">
          <div className="p-2 rounded-lg bg-red-500/10">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-red-300">Error Encountered</p>
            <p className="mt-1 opacity-90">{error}</p>
          </div>
        </div>
      )}

      {wallet ? (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="group bg-[#0d0d14] border border-white/5 p-8 rounded-[32px] shadow-2xl relative overflow-hidden transition-all hover:border-emerald-500/20">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <svg className="w-20 h-20 text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.63 0-1.82 1.47-3.05 3.11-3.41V4h2.67v1.91c1.51.31 2.83 1.24 3 3.1h-1.96c-.18-1.08-.73-1.62-2.05-1.62-1.49 0-2.35.61-2.35 1.63 0 .74.45 1.39 2.25 1.83 2.63.64 4.59 1.57 4.59 3.84 0 2.1-1.39 3.42-3.48 3.82z" />
                </svg>
              </div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-3 border-b border-white/5 pb-3">Available Balance</p>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-extrabold text-white">
                  {wallet.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-sm font-bold bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/20">
                  {wallet.currency}
                </span>
              </div>
            </div>
            
            <div className="bg-[#0d0d14] border border-white/5 p-8 rounded-[32px] shadow-2xl relative overflow-hidden transition-all hover:border-cyan-500/20">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-3 border-b border-white/5 pb-3">Identification</p>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-600 mb-1 font-medium">WALLET ID</span>
                <p className="text-sm font-mono text-slate-300 break-all bg-white/[0.02] p-3 rounded-2xl border border-white/5">{wallet.id}</p>
              </div>
            </div>

            <div className="bg-[#0d0d14] border border-white/5 p-8 rounded-[32px] shadow-2xl flex flex-col justify-center transition-all hover:border-white/10">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-4 border-b border-white/5 pb-3 text-center">Status Overview</p>
              <div className="flex flex-col items-center gap-3">
                <div className="px-5 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse"></div>
                  <span className="text-sm font-bold text-emerald-400 uppercase tracking-wider">Live & Active</span>
                </div>
                <p className="text-[10px] text-slate-600 italic">Fully synchronized with processing core</p>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="group bg-[#0d0d14] border border-white/5 rounded-[40px] overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)]">
            <div className="px-10 py-7 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-2xl bg-white/5 border border-white/5">
                  <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">Transaction History</h2>
                  <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest mt-1">Audit Log & Flow</p>
                </div>
              </div>
              <div className="px-4 py-1.5 rounded-full bg-white/5 border border-white/5 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                <span className="text-[11px] text-slate-300 font-bold font-mono">
                  {transactions.length} ENTRIES LOADED
                </span>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#0f0f18] text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
                  <tr>
                    <th className="pl-10 pr-6 py-5">Status & Timestamp</th>
                    <th className="px-6 py-5">Classification</th>
                    <th className="px-6 py-5">Audit Description</th>
                    <th className="px-6 py-5">Network Nodes</th>
                    <th className="pl-6 pr-10 py-5 text-right">Balance Delta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-24 text-center">
                        <div className="flex flex-col items-center">
                          <div className="w-16 h-16 rounded-full bg-white/[0.02] flex items-center justify-center mb-4">
                            <svg className="w-8 h-8 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4a2 2 0 012-2m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                            </svg>
                          </div>
                          <p className="text-slate-500 font-medium italic">Empty register — No activity found</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => {
                      const isIncoming = tx.toWalletId === wallet.id;
                      return (
                        <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors group/row">
                          <td className="pl-10 pr-6 py-6">
                            <div className="flex items-center gap-4">
                              <StatusBadge status={tx.status} />
                              <div>
                                <p className="text-xs text-slate-300 font-semibold">{formatDate(tx.createdAt)}</p>
                                <p className="text-[9px] text-slate-600 font-mono mt-1 group-hover/row:text-slate-400 transition-colors">#{tx.id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-6">
                            <span className="text-[9px] font-black px-2.5 py-1 rounded-lg bg-white/5 text-slate-400 border border-white/10 tracking-wider">
                              {tx.type || 'TRANSFER'}
                            </span>
                          </td>
                          <td className="px-6 py-6">
                            <p className="text-xs text-slate-400 group-hover/row:text-slate-200 transition-colors line-clamp-1 max-w-[200px]">
                              {isIncoming ? tx.toDescription : tx.fromDescription}
                            </p>
                          </td>
                          <td className="px-6 py-6">
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-2 group/node">
                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md ${isIncoming ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-500'} transition-all`}>SOURCE</span>
                                <span className="text-[9px] font-mono text-slate-500 group-hover/row:text-slate-400 truncate max-w-[120px]">{tx.fromWalletId}</span>
                              </div>
                              <div className="flex items-center gap-2 group/node">
                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md ${!isIncoming ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-500'} transition-all`}>TARGET</span>
                                <span className="text-[9px] font-mono text-slate-500 group-hover/row:text-slate-400 truncate max-w-[120px]">{tx.toWalletId}</span>
                              </div>
                            </div>
                          </td>
                          <td className="pl-6 pr-10 py-6 text-right">
                             <div className="flex flex-col items-end">
                               <span className={`text-sm font-black tracking-tight ${isIncoming ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {isIncoming ? '+' : '-'}{(tx.amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                               </span>
                               <div className="flex items-center gap-1 mt-1">
                                 <span className="text-[8px] text-slate-700 font-bold">BAL:</span>
                                 <span className="text-[10px] text-slate-500 group-hover/row:text-slate-400 font-mono">
                                   {(isIncoming ? tx.toWalletBalance ?? 0 : tx.fromWalletBalance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                 </span>
                               </div>
                             </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {hasMore && (
              <div className="p-10 border-t border-white/5 flex justify-center bg-white/[0.01]">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-10 py-3.5 bg-white/[0.03] hover:bg-emerald-400 hover:text-black text-slate-300 text-xs font-black rounded-2xl border border-white/10 transition-all duration-300 disabled:opacity-50 flex items-center gap-3 uppercase tracking-widest shadow-lg shadow-black/20"
                >
                  {loadingMore ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      Load Next Segment
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : !loading && !error && (
        <div className="mt-12 py-32 bg-[#0d0d14]/50 border border-white/5 border-dashed rounded-[48px] flex flex-col items-center justify-center text-center px-6 animate-in fade-in duration-1000">
          <div className="w-24 h-24 rounded-3xl bg-white/[0.02] border border-white/10 flex items-center justify-center mb-8 relative">
            <div className="absolute inset-0 bg-emerald-500/10 rounded-3xl blur-xl" />
            <svg className="w-10 h-10 text-slate-600 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Initialize Inquest</h2>
          <p className="text-slate-500 max-w-sm leading-relaxed text-sm">
            Please provide a valid Wallet Identifier to start auditing balance flow and historical registers.
          </p>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PROCESSED: "bg-emerald-400 text-black",
    SUBMITTED: "bg-cyan-400 text-black",
    FAILED: "bg-rose-500 text-white shadow-[0_0_12px_rgba(244,63,94,0.3)]",
  };

  return (
    <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${styles[status] || 'bg-slate-700 text-slate-300'}`}>
      {status}
    </span>
  );
}

export default function WalletsPage() {
  return (
    <Suspense fallback={
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
      </div>
    }>
      <WalletsContent />
    </Suspense>
  );
}
