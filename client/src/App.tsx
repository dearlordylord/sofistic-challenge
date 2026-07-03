import { useEffect, useState } from 'react';

/**
 * Starting point — replace this with your transactions feed.
 * The /api proxy is already wired to the Nest server (see vite.config.ts).
 */
export function App() {
  const [health, setHealth] = useState<string>('checking…');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) =>
        setHealth(`API ok — ${data.transactionsInDb} transactions in DB`),
      )
      .catch(() => setHealth('API unreachable — is the server running?'));
  }, []);

  return (
    <main style={{ fontFamily: 'sans-serif', maxWidth: 640, margin: '2rem auto' }}>
      <h1>Transactions Feed</h1>
      <p>{health}</p>
      <p>Build your feed here.</p>
    </main>
  );
}
