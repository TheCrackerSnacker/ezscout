import { useEffect, useState } from "react";
import { db } from "./db";
import { drainOutbox } from "./sync";

export function OfflineIndicator() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      const n = await db.outbox.count();
      if (active) setCount(n);
    };

    void refresh();

    const interval = setInterval(() => {
      void refresh();
    }, 3000);

    window.addEventListener("online", () => {
      void drainOutbox().then(refresh);
    });

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  if (count === 0) return null;

  return (
    <span className="offline-indicator" title="Responses waiting to sync">
      ({count} pending)
    </span>
  );
}
