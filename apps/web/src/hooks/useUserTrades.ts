import { useState, useEffect } from 'react';

export interface Trade {
  id: string;
  symbol: string;
  side: string;
  amount: string;
  price: string;
  fee: string;
  pnl: string | null;
  leverage: number | null;
  executedAt: string;
}

export function useUserTrades(userId: string) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTrades() {
      try {
        setLoading(true);
        const response = await fetch(`/api/users/${userId}/trades?limit=1000`);
        const data = await response.json();

        if (data.success) {
          setTrades(data.data.trades);
          setError(null);
        } else {
          setError(data.error || 'Failed to fetch trades');
        }
      } catch (err) {
        setError('Network error');
        console.error('Error fetching trades:', err);
      } finally {
        setLoading(false);
      }
    }

    if (userId) {
      fetchTrades();
    }
  }, [userId]);

  return { trades, loading, error };
}
