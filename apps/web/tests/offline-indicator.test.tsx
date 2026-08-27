import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OfflineIndicator } from "../src/offline/OfflineIndicator";

const dbMocks = vi.hoisted(() => ({
  outbox: { count: vi.fn() },
  dropped: { count: vi.fn() }
}));

const syncMocks = vi.hoisted(() => ({
  drainOutbox: vi.fn(),
  clearDropped: vi.fn()
}));

vi.mock("../src/offline/db", () => ({ db: dbMocks }));
vi.mock("../src/offline/sync", () => syncMocks);

describe("OfflineIndicator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.outbox.count.mockResolvedValue(0);
    dbMocks.dropped.count.mockResolvedValue(0);
    syncMocks.clearDropped.mockResolvedValue(undefined);
  });

  it("renders nothing when there is nothing pending or lost", async () => {
    render(<OfflineIndicator />);

    await waitFor(() => {
      expect(screen.queryByText(/pending/)).toBeNull();
      expect(screen.queryByText(/couldn't be sent/)).toBeNull();
    });
  });

  it("shows only the pending count", async () => {
    dbMocks.outbox.count.mockResolvedValue(1);

    render(<OfflineIndicator />);

    expect(await screen.findByText("(1 pending)")).toBeTruthy();
    expect(screen.queryByText(/couldn't be sent/)).toBeNull();
  });

  it("shows the lost notice with a dismiss control", async () => {
    dbMocks.dropped.count.mockResolvedValue(2);

    render(<OfflineIndicator />);

    expect(await screen.findByText("(2 couldn't be sent)")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Dismiss 2 unsent messages" })
    ).toBeTruthy();
  });

  it("shows both counts when pending and lost coexist", async () => {
    dbMocks.outbox.count.mockResolvedValue(3);
    dbMocks.dropped.count.mockResolvedValue(1);

    render(<OfflineIndicator />);

    expect(await screen.findByText("(3 pending)")).toBeTruthy();
    expect(await screen.findByText("(1 couldn't be sent)")).toBeTruthy();
  });

  it("dismissing clears the dropped archive and keeps pending", async () => {
    dbMocks.outbox.count.mockResolvedValue(3);
    dbMocks.dropped.count.mockResolvedValue(1);

    render(<OfflineIndicator />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Dismiss 1 unsent messages" })
    );

    await waitFor(() => {
      expect(syncMocks.clearDropped).toHaveBeenCalledTimes(1);
      expect(screen.queryByText(/couldn't be sent/)).toBeNull();
    });
    expect(screen.getByText("(3 pending)")).toBeTruthy();
  });
});