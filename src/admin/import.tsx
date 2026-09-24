"use client";

/**
 * Historical import screen — preview, then import.
 *
 * The preview exists because importing an entire account is a large, slow
 * operation and an admin deserves to know the shape of it first: how many
 * posts exist, how many are already archived, how many are genuinely new.
 *
 * Import runs SERVER-SIDE in resumable batches. Closing this tab does not
 * cancel it, and re-running is safe: imports are keyed on the Instagram media
 * id, so a second run creates no duplicates.
 */

import { useCallback, useState } from "react";

type ImportSize = "10" | "25" | "50" | "100" | "all";

interface PreviewItem {
  mediaId: string;
  caption?: string;
  mediaType: string;
  timestamp: string;
  thumbnailUrl?: string;
  alreadyImported: boolean;
}

interface PreviewResult {
  discovered: number;
  alreadyArchived: number;
  newPosts: number;
  items: PreviewItem[];
}

interface ImportProgress {
  processed: number;
  total: number;
  imported: number;
  skipped: number;
  failed: number;
  done: boolean;
  cursor: string | null;
  message?: string;
}

const SIZE_OPTIONS: Array<{ value: ImportSize; label: string }> = [
  { value: "10", label: "Latest 10" },
  { value: "25", label: "Latest 25" },
  { value: "50", label: "Latest 50" },
  { value: "100", label: "Latest 100" },
  { value: "all", label: "All available" },
];

export default function InstagramImport() {
  const [size, setSize] = useState<ImportSize>("25");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runPreview = useCallback(async () => {
    setBusy(true);
    setError(null);
    setProgress(null);
    try {
      const response = await fetch("/api/v1/plugins/instagram-post/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: size === "all" ? null : Number(size) }),
      });
      const data = await response.json();
      if (response.ok) setPreview(data);
      else setError(data.error ?? "Preview failed.");
    } catch {
      setError("Preview could not be completed.");
    } finally {
      setBusy(false);
    }
  }, [size]);

  /**
   * Drive the import in batches, each a separate request.
   *
   * Batching keeps every request short (no gateway timeouts on a large
   * account) and gives honest progress. The server returns a cursor; the next
   * batch resumes from it, so an interrupted import loses at most one batch.
   */
  const runImport = useCallback(async () => {
    setBusy(true);
    setError(null);

    const total = preview?.newPosts ?? 0;
    let cursor: string | null = null;
    let aggregate: ImportProgress = {
      processed: 0,
      total,
      imported: 0,
      skipped: 0,
      failed: 0,
      done: false,
      cursor: null,
    };
    setProgress(aggregate);

    try {
      for (;;) {
        const response: Response = await fetch("/api/v1/plugins/instagram-post/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batchSize: 10, cursor }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error ?? "Import failed.");
          break;
        }

        aggregate = {
          processed: aggregate.processed + (data.discovered ?? 0),
          total: Math.max(total, aggregate.processed + (data.discovered ?? 0)),
          imported: aggregate.imported + (data.imported ?? 0),
          skipped: aggregate.skipped + (data.skipped ?? 0),
          failed: aggregate.failed + (data.failed ?? 0),
          done: !data.nextCursor,
          cursor: data.nextCursor ?? null,
          message: data.abortReason,
        };
        setProgress(aggregate);

        if (!data.nextCursor) break;
        cursor = data.nextCursor;
      }
    } catch {
      setError("The import was interrupted. It can be resumed safely — no duplicates are created.");
    } finally {
      setBusy(false);
    }
  }, [preview]);

  return (
    <section className="np-stack">
      <h2>Instagram Import</h2>

      <div className="np-card">
        <fieldset>
          <legend>Import</legend>
          {SIZE_OPTIONS.map((option) => (
            <label key={option.value} className="np-field np-field--radio">
              <input
                type="radio"
                name="import-size"
                value={option.value}
                checked={size === option.value}
                onChange={() => setSize(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>

        <button type="button" onClick={() => void runPreview()} disabled={busy}>
          {busy && !progress ? "Loading preview…" : "Preview"}
        </button>
      </div>

      {error && <div className="np-notice np-notice--error">{error}</div>}

      {preview && !progress && (
        <div className="np-card">
          <h3>Import Preview</h3>
          <dl className="np-definition-list">
            <dt>Instagram posts discovered</dt>
            <dd>{preview.discovered}</dd>
            <dt>Already archived</dt>
            <dd>{preview.alreadyArchived}</dd>
            <dt>New posts</dt>
            <dd>{preview.newPosts}</dd>
          </dl>

          <ul className="np-preview-list">
            {preview.items.slice(0, 24).map((item) => (
              <li key={item.mediaId} className="np-preview-item">
                {item.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.thumbnailUrl} alt="" width={80} height={80} loading="lazy" />
                )}
                <div>
                  <p>{truncate(item.caption ?? "(no caption)", 80)}</p>
                  <small>
                    {new Date(item.timestamp).toLocaleDateString()} · {item.mediaType} ·{" "}
                    {item.alreadyImported ? "Already archived" : "New"}
                  </small>
                </div>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => void runImport()}
            disabled={busy || preview.newPosts === 0}
          >
            Import {preview.newPosts} Post{preview.newPosts === 1 ? "" : "s"}
          </button>
        </div>
      )}

      {progress && (
        <div className="np-card">
          <h3>{progress.done ? "Import complete" : "Importing Instagram posts…"}</h3>
          <p>
            {progress.processed} / {progress.total || progress.processed}
          </p>
          <progress
            value={progress.processed}
            max={Math.max(progress.total, progress.processed, 1)}
          />
          <dl className="np-definition-list">
            <dt>Imported</dt>
            <dd>{progress.imported}</dd>
            <dt>Skipped</dt>
            <dd>{progress.skipped}</dd>
            <dt>Failed</dt>
            <dd>{progress.failed}</dd>
          </dl>
          {progress.message && <p className="np-notice">{progress.message}</p>}
          {!progress.done && (
            <small>
              This import continues on the server. You can safely close this page — running it
              again will not create duplicates.
            </small>
          )}
        </div>
      )}
    </section>
  );
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max).trimEnd()}…`;
}
