import React, { useEffect, useState } from 'react';
import api from '../services/api';

export default function Home() {
  const [health, setHealth] = useState<string>('loading...');

  useEffect(() => {
    api.get('/health').then((r) => setHealth(JSON.stringify(r.data))).catch(() => setHealth('error'));
  }, []);

  return (
    <div>
      <h2>Home</h2>
      <p>API health: {health}</p>
    </div>
  );
}

