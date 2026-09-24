# Host integration files

The plugin's own code lives in `src/` and is self-contained. The files in this
directory are the **host wiring**. They belong in your NextPress app, not in
the plugin, and must be copied into place during installation.

## Why these are separate

NextPress's `PluginContext` lets a plugin *register* API routes, but the host
does not yet ship a catch-all dispatcher that mounts them, and plugin route
handlers receive only a bare `Request` with no auth context. Since every
Instagram endpoint must enforce permissions and site scoping server-side, the
real endpoints are mounted as ordinary Next.js route handlers that call
`getAuthContext()` and `can()`.

This mirrors the convention already used by the official Photo Gallery plugin.

## Installation

Copy the tree in this directory over your repository root. The paths already
match their destinations:

```bash
cp -R install/apps/web/. /path/to/your-nextpress/apps/web/
```

That places:

| Source | Destination | Purpose |
| --- | --- | --- |
| `lib/instagram/adapters.ts` | `apps/web/lib/instagram/` | Binds plugin services to Prisma, media, settings |
| `app/api/v1/plugins/instagram-post/**` | same path | OAuth, dashboard, settings, sync, import, publish |
| `app/api/cron/instagram-sync/route.ts` | same path | Scheduled synchronisation |
| `app/(admin)/admin/plugins/instagram-post/**` | same path | Admin pages |

Then add the workspace dependency:

```jsonc
// apps/web/package.json
"@nextpress/plugin-instagram-post": "workspace:*"
```

```bash
pnpm install
```

## Notes

- `adapters.ts` is the **only** place plugin interfaces are bound to Prisma.
  Every query there is filtered by `siteId`, which is what enforces multi-tenant
  isolation, including on the scheduled path.
- All route handlers enforce permissions with `can()` before doing any work.
  Hiding a button is never the security boundary.
- The cron route reuses your existing `CRON_SECRET`, matching
  `/api/cron/publish`.

See the main [README](../README.md) for Meta app setup, environment variables,
and usage.
