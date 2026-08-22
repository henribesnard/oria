import { useState, useCallback, useRef } from 'react';
import { searchCatalog, type SearchResult } from '../api/catalog';

export function useSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback((text: string) => {
    setQuery(text);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (text.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    timeoutRef.current = setTimeout(async () => {
      try {
        const data = await searchCatalog(text.trim());
        setResults(data);
      } catch {
        setResults([]);
      }
      setLoading(false);
    }, 300);
  }, []);

  const clear = useCallback(() => {
    setQuery('');
    setResults([]);
    setLoading(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  return { query, results, loading, search, clear };
}
