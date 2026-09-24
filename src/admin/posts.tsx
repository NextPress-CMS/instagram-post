"use client";

/**
 * Archived posts management screen.
 *
 * Makes provenance unambiguous — imported from Instagram, created here, or
 * published out to Instagram — because a post's origin decides what actions
 * are legitimate on it.
 *
 * Only safe actions are offered. There is deliberately no bulk delete: an
 * archive's value is that it does not evaporate on a mis-click.
 */

import { useCallback, useEffect, useState } from "react";

type SourceLabel = "Instagram" | "Website";
type SyncLabel = "Synced" | "Pending" | "Failed" | "Retrying";

interface ArchivedPostRow {
  id: string;
  title: string;
  slug: string;
  thumbnailUrl?: string;
  source: SourceLabel;
  syncStatus: SyncLabel;
  mediaType?: string;
  instagramPermalink?: string;
  publishedAt?: string;
  lastSyncedAt?: string;
  error?: string;
}

export default function InstagramPostsPage() {
  const [rows, setRows] = useState<ArchivedPostRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/v1/plugins/instagram-post/posts");
    if (response.ok) setRows((await response.json()).items ?? []);
    else setRows([]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const retry = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        await fetch(`/api/v1/plugins/instagram-post/posts/${id}/resync`, { method: "POST" });
        await load();
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  if (!rows) return <p>Loading archived posts…</p>;

  if (rows.length === 0) {
    return (
      <section className="np-stack">
        <h2>Archived Instagram Posts</h2>
        <p>No Instagram posts have been archived yet.</p>
        <a className="np-button" href="/admin/plugins/instagram-post/import">
          Import Posts
        </a>
      </section>
    );
  }

  return (
    <section className="np-stack">
      <h2>Archived Instagram Posts</h2>

      <table className="np-table">
        <thead>
          <tr>
            <th scope="col">Thumbnail</th>
            <th scope="col">Title</th>
            <th scope="col">Source</th>
            <th scope="col">Sync status</th>
            <th scope="col">Type</th>
            <th scope="col">Published</th>
            <th scope="col">Last synced</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                {row.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.thumbnailUrl} alt="" width={48} height={48} loading="lazy" />
                ) : (
                  <span aria-hidden="true">—</span>
                )}
              </td>
              <td>{row.title}</td>
              <td>
                <span className={`np-badge np-badge--${row.source.toLowerCase()}`}>
                  {row.source}
                </span>
              </td>
              <td>
                <span className={`np-badge np-badge--${row.syncStatus.toLowerCase()}`}>
                  {row.syncStatus}
                </span>
                {row.error && <small className="np-error-text">{row.error}</small>}
              </td>
              <td>{row.mediaType ?? "—"}</td>
              <td>{formatDate(row.publishedAt)}</td>
              <td>{formatDate(row.lastSyncedAt)}</td>
              <td className="np-table-actions">
                <a href={`/admin/content/instagram-post/${row.id}`}>Edit</a>
                <a href={`/${row.slug}`} target="_blank" rel="noreferrer noopener">
                  View
                </a>
                {row.instagramPermalink && (
                  <a href={row.instagramPermalink} target="_blank" rel="noreferrer noopener">
                    Instagram
                  </a>
                )}
                {(row.syncStatus === "Failed" || row.syncStatus === "Retrying") && (
                  <button type="button" onClick={() => void retry(row.id)} disabled={busyId === row.id}>
                    {busyId === row.id ? "Retrying…" : "Retry"}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function formatDate(value: string | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}
