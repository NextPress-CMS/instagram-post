"use client";

/**
 * Instagram settings screen.
 *
 * Reads and writes the plugin's settings group through a permission-gated
 * route. Only settings that change real behaviour are exposed — configuration
 * nobody uses is a maintenance cost, not a feature.
 */

import { useCallback, useEffect, useState } from "react";
import type { InstagramSettings, SyncInterval } from "../schemas/settings";

const SYNC_INTERVALS: Array<{ value: SyncInterval; label: string }> = [
  { value: "manual", label: "Manual only" },
  { value: "15m", label: "Every 15 minutes" },
  { value: "30m", label: "Every 30 minutes" },
  { value: "1h", label: "Hourly" },
  { value: "6h", label: "Every 6 hours" },
  { value: "12h", label: "Every 12 hours" },
  { value: "24h", label: "Daily" },
];

export default function InstagramSettingsPage() {
  const [settings, setSettings] = useState<InstagramSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void fetch("/api/v1/plugins/instagram-post/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: InstagramSettings | null) => setSettings(data));
  }, []);

  const update = useCallback(<K extends keyof InstagramSettings>(key: K, value: InstagramSettings[K]) => {
    setSettings((current) => (current ? { ...current, [key]: value } : current));
    setSaved(false);
  }, []);

  const save = useCallback(async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const response = await fetch("/api/v1/plugins/instagram-post/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (response.ok) {
        setSettings(await response.json());
        setSaved(true);
      }
    } finally {
      setSaving(false);
    }
  }, [settings]);

  if (!settings) return <p>Loading settings…</p>;

  return (
    <section className="np-stack">
      <h2>Instagram Settings</h2>

      <div className="np-card">
        <h3>Synchronisation</h3>

        <label className="np-field np-field--checkbox">
          <input
            type="checkbox"
            checked={settings.autoSync}
            onChange={(e) => update("autoSync", e.target.checked)}
          />
          <span>Automatically import new Instagram posts</span>
        </label>

        <label className="np-field">
          <span>Sync frequency</span>
          <select
            value={settings.syncInterval}
            disabled={!settings.autoSync}
            onChange={(e) => update("syncInterval", e.target.value as SyncInterval)}
          >
            {SYNC_INTERVALS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <small>
            Instagram provides no notification when an account posts, so NextPress checks on a
            schedule. Shorter intervals consume more of the account&apos;s API quota.
          </small>
        </label>
      </div>

      <div className="np-card">
        <h3>Import</h3>

        <label className="np-field">
          <span>Imported post status</span>
          <select
            value={settings.importStatus}
            onChange={(e) => update("importStatus", e.target.value as "DRAFT" | "PUBLISHED")}
          >
            <option value="DRAFT">Draft — review before publishing</option>
            <option value="PUBLISHED">Published immediately</option>
          </select>
        </label>

        <label className="np-field np-field--checkbox">
          <input
            type="checkbox"
            checked={settings.archiveMedia}
            onChange={(e) => update("archiveMedia", e.target.checked)}
          />
          <span>Archive media in the Media Library</span>
        </label>
        <small>
          Instagram image and video URLs expire. Archiving stores a permanent copy on this
          website, which is what makes the archive durable.
        </small>
      </div>

      <div className="np-card">
        <h3>Publishing</h3>

        <label className="np-field np-field--checkbox">
          <input
            type="checkbox"
            checked={settings.publishByDefault}
            onChange={(e) => update("publishByDefault", e.target.checked)}
          />
          <span>Enable Instagram publishing on new content by default</span>
        </label>

        <label className="np-field np-field--checkbox">
          <input
            type="checkbox"
            checked={settings.captionFromExcerpt}
            onChange={(e) => update("captionFromExcerpt", e.target.checked)}
          />
          <span>Use the entry excerpt as the Instagram caption when none is set</span>
        </label>
      </div>

      <div className="np-actions">
        <button type="button" onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save Settings"}
        </button>
        {saved && <span className="np-notice np-notice--success">Settings saved.</span>}
      </div>
    </section>
  );
}
