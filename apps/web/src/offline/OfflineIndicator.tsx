import { useEffect, useState } from "react";
import { db } from "./db";
import { clearDropped, drainOutbox } from "./sync";

export function OfflineIndicator() {
  const [count, setCount] = useState(0);
  const [dropped, setDropped] = useState(0);

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      const [n, d] = await Promise.all([db.outbox.count(), db.dropped.count()]);
      if (active) {
        setCount(n);
        setDropped(d);
      }
    };

    void refresh();

    const interval = setInterval(() => {
      void refresh();
    }, 3000);

    const handleOnline = () => {
      void drainOutbox().then(refresh);
    };

    window.addEventListener("online", handleOnline);

    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  const dismissDropped = async () => {
    // Archived entries were never delivered and live only in local storage;
    // clearing the notice deletes those rows.
    await clearDropped();
    setDropped(0);
  };

  if (count === 0 && dropped === 0) return null;

  return (
    <span className="offline-indicator">
      {count > 0 ? (
        <span title="Responses waiting to sync">({count} pending)</span>
      ) : null}
      {dropped > 0 ? (
        <span
          className="offline-indicator--lost"
          title="One or more responses could not be sent"
        >
          ({dropped} couldn&apos;t be sent)
          <button
            type="button"
            className="offline-indicator-dismiss"
            onClick={() => void dismissDropped()}
            aria-label={`Dismiss ${dropped} unsent messages`}
          >
            dismiss
          </button>
        </span>
      ) : null}
    </span>
  );
}
