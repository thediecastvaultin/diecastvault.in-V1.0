# Final Production Polish & Launch Prep

Scope is large but purely polish/consolidation — no new features. Executing in one focused pass, verifying against build + preview.

## 1. Prepare for Production (replaces Master Controls)

- New Settings tab **Prepare for Production** replacing `MasterControlsAdmin`.
- New RPC `admin_prepare_production(_include_flash bool, _include_notifications bool)`:
  - SECURITY DEFINER, admin-only, wraps all deletes in a single transaction (function body = implicit tx; on any RAISE, everything rolls back).
  - Deletes: `admin_notifications`, notification-channel `announcements` (optional), flash-channel `announcements` (optional), `cart_items`, `carts`, `wishlist`, `reviews`, `orders` (all, active + archived — cascades order_items), `order_logs`, `auction_events`, `auction_logs`, `site_settings` key `active_auction`, `coupon_redemptions` + reset `coupons.used_count`, `user_badges`, `activity_events`, and test customers (profiles + auth.users where user has NO `admin`/`staff` role) via `auth.admin` deletes done in a companion server fn using `supabaseAdmin` for user deletion after the SQL rollback-safe portion succeeds.  
  Also remove temporary customer data such as search history, recently viewed products, temporary customer preferences and any development/testing records if such tables or collections exist.
  - Returns JSON `{ scope: rows, ... , total, duration_ms }`.
  - Writes single `audit_log` row `action='prepare_for_production'` with per-scope counts, duration, actor.
- UI: checklist of what will be removed (grouped Preserve vs Remove), two checkboxes for Flash Banner / Notifications, `PREPARE` type-to-confirm gate, progress spinner, results summary card (rows/duration/status).
- Kept: `admin_reset_scope` stays in DB for backward compat but removed from UI; `admin_count_scope` retained for the confirmation preview counts.

## 2. Settings UI redesign (unified)

Adopt the Flash Announcement Banner layout as the benchmark. Create shared primitives in `src/components/admin/settings/`:

- `SettingsSection` — compact card: title (sm uppercase mono), optional description, tight body padding (`p-4`), consistent border.
- `SettingsRow` — label + control on one line at `sm+`, stacked on mobile, `py-2` divider.
- `SettingsFooter` — sticky right-aligned Save / Reset with the same styling everywhere.

Rewrite each tab in `src/routes/admin.tsx` (General, Homepage, Content, Shop, Inventory, Social, Footer, Notifications, Prepare) to use these primitives. Same input/switch/button styles, same margins. Homepage Sections becomes a dense 1-column list of toggle rows (no giant cards). Footer regrouped: Brand / Links / Legal / Contact in a 2-col grid on desktop.

Homepage sections audit: verify Featured, Featured Collections, New Drops, Accessories each have a complete rendering block in src/routes/index.tsx. If any section is incomplete or intentionally unused, remove the corresponding Settings toggle instead of exposing a non-functional option. Do not expose unfinished Homepage settings.

## 3. Notification Center rebuild (`NotificationsBell.tsx`)

- Header: `Notifications` title + `Mark all read` + `Clear all` (only place these actions live).
- Body: card rows with icon (kind → Bell/AlertTriangle/Package/etc.), title, message, relative timestamp (`formatDistanceToNow`), unread dot + subtle bg tint, hover delete button (always visible on mobile).
- Footer: `{total} total · {unread} unread` only — no duplicated actions.
- Fix count mismatch: current query filters `starts_at`/`expires_at` in JS after a `.limit(50)` — bell badge reads full array length. Move the time-window filter into the SQL (`.or('starts_at.is.null,starts_at.lte.now')` etc.), remove the `.slice(20)`, and drive both the badge and list from the same filtered result.
- Mobile: popover switches to a bottom sheet under `sm` (`Sheet` from shadcn) with 44px touch targets.

## 4. Orders polish

- Customer + staff order detail: Timeline becomes primary status widget; remove the separate status/payment badge rows that duplicate the same info (keep a single compact chip pair in the header).
- Timeline items rebuilt from `order_logs` for that order (already exists) — realtime via `queryClient.invalidateQueries` on mutation, and a 30s poll on the detail view.
- Customer `orders_.$id.tsx` gets the same `OrderTimeline` component the staff view uses.

## 5. Order Logs

- Filter bar: action multi-select, date range, actor search, order number — laid out in one `flex flex-wrap gap-2` row matching other admin tables.
- Export buttons right-aligned, same styling as Orders admin.
- Table row spacing tightened to match Orders admin.

## 6. Remove Activity Timeline

- Delete `ActivityTimeline.tsx`, its tab in `account.tsx`, its Community/dashboard entry, and the `activity_events` reset scope from `admin_count_scope`.
- Audit every dependency on activity_events. If the Activity Timeline is no longer used anywhere in the application, remove its UI, navigation, reset logic, dead code, database references, triggers and table. Only preserve the table if another active feature genuinely depends on it.7. Mobile responsiveness sweep

Perform a complete responsive audit across the entire application, not only targeted fixes. Review every customer-facing page and every Staff Dashboard page. Proactively identify and fix overflow, spacing, alignment, responsiveness, touch targets, tablet layouts and any remaining mobile UI issues.Admin route: convert all `overflow-x-auto` tables to have `min-w-0` wrappers, ensure header rows use `grid-cols-[minmax(0,1fr)_auto]` pattern from the responsive-layout knowledge card.

- Dialogs: `max-w-[calc(100vw-2rem)]`, scrollable body.
- Header/hamburger: verify Account + More dropdowns render inside mobile sheet.
- Customer pages: audit shop grid, product page gallery, checkout stepper, cart drawer at 375px.

## 8. Dashboard consistency

- Standard `AdminCard`, `AdminTable`, `AdminEmpty`, `AdminLoading` primitives added under `src/components/admin/`.
- Migrate Products, Orders, Community, Coupons, Auctions, Analytics, Audit, Badges, Roles to use them (styling only; no logic changes).

## 9. Final QA pass

- Manual sweep with Playwright at 375 / 768 / 1280 widths on: home, shop, product, cart drawer, checkout, orders, order detail, account tabs, admin dashboard tabs, notification popover.
- Perform a complete application-wide UI/UX audit. Do not only implement the requested changes. Proactively inspect every page, dialog, modal, dropdown, table, notification panel, settings page, dashboard page and mobile layout. Identify and fix any remaining spacing, alignment, responsiveness, accessibility, consistency or unfinished UI issues so the application feels polished and production-ready.

## Technical notes

- One migration: `admin_prepare_production` RPC + DELETE policy checks + audit action name; `admin_count_scope` updates.
- One server fn `prepareForProduction` (auth-gated, admin-verified via `context.supabase.rpc('has_role')`) that first calls the RPC, then uses `supabaseAdmin.auth.admin.deleteUser` for each non-staff user id returned.
- No changes to: products, categories, coupons definitions, badges definitions, site settings (except `active_auction`), storage buckets, roles.
- Build verified after each major chunk; Playwright screenshots for the notification center + prepare-for-production flows.

## Out of scope

- No new features, no schema changes beyond what's needed for Prepare-for-Production and cleanup.
- No copy rewrites beyond the rename Master Controls → Prepare for Production.