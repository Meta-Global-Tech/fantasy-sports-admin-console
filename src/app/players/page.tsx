"use client";

import { useState, useEffect } from "react";
import { adminApi } from "@/lib/api";
import { PlayerProfile } from "@/types";

export default function PlayersPage() {
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [nextCursor, setNextCursor] = useState<string | number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Update state
  const [updatingPlayer, setUpdatingPlayer] = useState<string | null>(null);
  const [pendingPrices, setPendingPrices] = useState<Record<string, string>>({});
  const [updateUpcoming, setUpdateUpcoming] = useState(false);

  useEffect(() => {
    fetchPlayers();
  }, []);

  const fetchPlayers = async (cursor?: string | number, isLoadMore = false) => {
    try {
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setPlayers([]);
        setNextCursor(null);
      }

      const data = await adminApi.getAllPlayerProfiles({
        pageSize: 20,
        cursor: cursor?.toString(),
      });

      const items = data?.items || [];
      if (isLoadMore) {
        setPlayers((prev) => [...prev, ...items]);
      } else {
        setPlayers(items);
      }

      setNextCursor(data.nextCursor ?? null);
      setHasMore(data.hasMore);
      // If the backend doesn't return total, we just show what we have. 
      // Current swagger doesn't show total count in schema.
    } catch (err) {
      setError("Failed to load players");
      console.error(err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (nextCursor && !loadingMore) {
      fetchPlayers(nextCursor, true);
    }
  };

  const handleUpdatePrice = async (playerProfileId: string) => {
    const priceStr = pendingPrices[playerProfileId];
    const price = parseFloat(priceStr);
    if (isNaN(price)) {
      alert("Please enter a valid price");
      return;
    }

    try {
      setUpdatingPlayer(playerProfileId);
      await adminApi.updatePlayerProfileDefaultPrice({
        playerProfileId,
        defaultPrice: price,
        updateUpcomingMatches: updateUpcoming,
      });
      
      // Refresh list or update locally
      setPlayers(prev => prev.map(p => 
        p.playerProfileId === playerProfileId 
        ? { ...p, defaultPrice: price } 
        : p
      ));
      
      setUpdatingPlayer(null);
      setPendingPrices(prev => {
        const next = { ...prev };
        delete next[playerProfileId];
        return next;
      });
      setUpdateUpcoming(false);
    } catch (err) {
      alert("Failed to update price");
      console.error(err);
      setUpdatingPlayer(null);
    }
  };

  const filteredPlayers = players.filter(p => 
    (p.name || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.country || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Player Profiles</h1>
          <p className="text-slate-500 text-sm mt-1">{players.length} players loaded</p>
        </div>
        
        <div className="relative">
          <input
            type="text"
            placeholder="Search players..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64 bg-[#0d0d14] border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all"
          />
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="bg-[#0d0d14] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-left">
          <thead className="bg-white/5 border-b border-white/5">
            <tr>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Player</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Country</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Role</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Default Price</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={5} className="px-6 py-8">
                    <div className="h-4 bg-white/5 animate-pulse rounded w-full"></div>
                  </td>
                </tr>
              ))
            ) : filteredPlayers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                  No players found
                </td>
              </tr>
            ) : (
              filteredPlayers.map((player) => (
                <tr key={player.playerProfileId} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {player.imageUrl ? (
                        <img 
                          src={player.imageUrl} 
                          alt={player.name} 
                          className="w-10 h-10 rounded-full object-cover bg-white/10 border border-white/10"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
                          {(player.name || "?").charAt(0)}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-white">{player.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono">ID: {player.playerProfileId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-300">{player.country || "N/A"}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {player.defaultPlayerSecondRole || "N/A"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-lg font-bold text-emerald-400">${player.defaultPrice ?? 0}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          placeholder="New Price"
                          defaultValue={player.defaultPrice}
                          onChange={(e) => {
                            setPendingPrices(prev => ({ ...prev, [player.playerProfileId]: e.target.value }));
                          }}
                          className="w-24 bg-[#050508] border border-white/10 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                        />
                        <button
                          onClick={() => handleUpdatePrice(player.playerProfileId)}
                          disabled={updatingPlayer === player.playerProfileId && updatingPlayer === player.playerProfileId}
                          className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-bold rounded-lg border border-emerald-500/30 transition-all disabled:opacity-50"
                        >
                          {updatingPlayer === player.playerProfileId ? "Updating..." : "Update"}
                        </button>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer group/label">
                        <input
                          type="checkbox"
                          checked={updateUpcoming}
                          onChange={(e) => {
                            setUpdateUpcoming(e.target.checked);
                          }}
                          className="w-3 h-3 rounded border-white/10 bg-[#050508] text-emerald-500 focus:ring-0 focus:ring-offset-0"
                        />
                        <span className="text-[10px] text-slate-500 group-hover/label:text-slate-400 transition-colors">Update upcoming matches</span>
                      </label>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="flex items-center gap-2 px-6 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold rounded-xl border border-emerald-500/20 transition-all disabled:opacity-50"
          >
            {loadingMore ? (
              <>
                <div className="w-4 h-4 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
                Loading more...
              </>
            ) : (
              "Load More Players"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
