import { useState, useEffect, useCallback, useRef } from 'react';
import { listFixtures, type Fixture } from '../api/catalog';

export function useFixture(fixtureId: number) {
  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const fetch = useCallback(async () => {
    try {
      const data = await listFixtures({ fixtureId });
      if (data.length > 0) setFixture(data[0]);
    } catch { /* ignore */ }
    setLoading(false);
  }, [fixtureId]);

  useEffect(() => {
    fetch();
    // Auto-refresh every 30s for live matches
    timerRef.current = setInterval(fetch, 30_000);
    return () => clearInterval(timerRef.current);
  }, [fetch]);

  return { fixture, loading, refetch: fetch };
}
