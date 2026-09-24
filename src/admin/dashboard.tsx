"use client";

/**
 * Instagram admin dashboard — connection status, archive counters, actions.
 *
 * Presentation only. Every action posts to a permission-gated server route;
 * hiding a button is never the security boundary. The token is not fetched,
 * not rendered, and not present in any payload this component receives — the
 * server sends a `PublicConnection`, which has no secret fields.
 */

import { useCallback, useEffect, useState } from "react";
import type { PublicConnection } from "../schemas/settings";

interface DashboardData {
  connection: PublicConnection;
  stats: {
    imported: number;
    pending: number;
    failed: number;
    published: number;
    publishFailed: number;
  };
}

const TOKEN_STATUS_LABELS: Record<PublicConnection["tokenStatus"], string> = {
  valid: "Valid",
  expiring_soon: "Expiring soon",
  expired: "Expired",
  unknown: "Unknown",
};

export default function InstagramDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/v1/plugins/instagram-post/dashboard");
    if (response.ok) setData(await response.json());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const syncNow = useCallback(async () => {
    setBusy("sync");
    setMessage(null);
    try {
      const response = await fetch("/api/v1/plugins/instagram-post/sync", { method: "POST" });
      const result = await response.json();
      setMessage(
        response.ok
          ? `Synchronisation complete. Imported ${result.imported ?? 0}, skipped ${result.skipped ?? 0}.`
          : (result.error ?? "Synchronisation failed."),
      );
      await load();
    } finally {
      setBusy(null);
    }
  }, [load]);

  const disconnect = useCallback(async () => {
    // Explicit about what is and is not destroyed — the archive stays.
    const confirmed = window.confirm(
      "Disconnecting Instagram will stop synchronisation and Instagram publishing.\n\n" +
        "Existing archived posts will remain on this website.",
    );
    if (!confirmed) return;

    setBusy("disconnect");
    try {
      await fetch("/api/v1/plugins/instagram-post/connection", { method: "DELETE" });
      await load();
    } finally {
      setBusy(null);
    }
  }, [load]);

  if (!data) return <p>Loading Instagram status…</p>;

  const { connection, stats } = data;

  if (connection.status === "not_connected") {
    return (
      <section className="np-card">
        <h2>Instagram</h2>
        <p>
          <strong>Status:</strong> Not connected
        </p>
        <p>
          Connect a professional (Business or Creator) Instagram account to archive its posts on
          this website and publish new posts from NextPress.
        </p>
        <a className="np-button np-button--primary" href="/api/v1/plugins/instagram-post/oauth/start">
          Connect Instagram
        </a>
      </section>
    );
  }

  return (
    <section className="np-stack">
      {connection.status === "needs_reauth" && (
        <div className="np-notice np-notice--warning">
          <h3>Instagram connection requires attention.</h3>
          <p>
            {connection.lastSyncError ??
              "Your Instagram authorisation may have expired. Synchronisation and publishing are paused until the account is reconnected."}
          </p>
          <a className="np-button" href="/api/v1/plugins/instagram-post/oauth/start">
            Reconnect Instagram
          </a>
        </div>
      )}

      <div className="np-card">
        <h2>Instagram</h2>
        <dl className="np-definition-list">
          <dt>Status</dt>
          <dd>{connection.status === "connected" ? "Connected" : "Requires attention"}</dd>

          <dt>Account</dt>
          <dd>@{connection.username}</dd>

          <dt>Account ID</dt>
          <dd>{connection.accountId}</dd>

          <dt>Account type</dt>
          <dd>{connection.accountType ?? "Professional"}</dd>

          <dt>Token status</dt>
          <dd>{TOKEN_STATUS_LABELS[connection.tokenStatus]}</dd>

          <dt>Connected</dt>
          <dd>{formatDate(connection.connectedAt)}</dd>

          <dt>Last sync</dt>
          <dd>{formatDateTime(connection.lastSyncAt)}</dd>
        </dl>
      </div>

      <div className="np-card">
        <h3>Archive</h3>
        <dl className="np-definition-list">
          <dt>Imported</dt>
          <dd>{stats.imported}</dd>
          <dt>Pending</dt>
          <dd>{stats.pending}</dd>
          <dt>Failed</dt>
          <dd>{stats.failed}</dd>
        </dl>

        <h3>Publishing</h3>
        <dl className="np-definition-list">
          <dt>Published</dt>
          <dd>{stats.published}</dd>
          <dt>Failed</dt>
          <dd>{stats.publishFailed}</dd>
        </dl>
      </div>

      {message && <div className="np-notice">{message}</div>}

      <div className="np-actions">
        <button type="button" onClick={() => void syncNow()} disabled={busy !== null}>
          {busy === "sync" ? "Syncing…" : "Sync Now"}
        </button>
        <a className="np-button" href="/admin/plugins/instagram-post/import">
          Import Posts
        </a>
        <button
          type="button"
          className="np-button--danger"
          onClick={() => void disconnect()}
          disabled={busy !== null}
        >
          Disconnect
        </button>
      </div>
    </section>
  );
}

function formatDate(value: string | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

function formatDateTime(value: string | undefined): string {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Never" : date.toLocaleString();
}
