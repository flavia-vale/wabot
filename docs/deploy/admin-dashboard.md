# Admin dashboard deploy notes

The admin dashboard is protected by authenticated BOTinho users that have either an active `AdminUser` record or a bootstrap email configured in the API process.

## Bootstrap owner

The canonical owner bootstrap emails are `flavia.vale@usp.br`, `flaviaroberta.1496@gmail.com`, and `tacianeaas02@gmail.com`.

These emails are included as built-in break-glass owners so the canonical admins can access `/admin` after logging in with the same regular BOTinho account email, even if `ALLOW_ADMIN_EMAIL_BOOTSTRAP` is not set or an old `AdminUser` row is inactive. Additional bootstrap emails can be added with the `ADMIN_EMAILS` environment variable as a comma-separated list.

If an `AdminUser` row already exists for a non-canonical user, its `status` remains authoritative: inactive admin rows are not bypassed by the configurable bootstrap email list. This prevents a disabled non-canonical admin record from regaining access through bootstrap configuration. Emergency owner restoration for the canonical admin emails is also backed by an explicit, reviewed migration so staging validates the data change before production.

## Required deployment steps

1. Pull the branch that contains the admin changes.
2. Run Prisma migrations before restarting the API, because the admin dashboard depends on `AdminUser`, `AdminAuditLog`, `CustomerContactLog`, and new `User` fields.
3. Rebuild the dashboard so the `/admin` route and latest client API helpers are available.
4. Restart both PM2 processes: `api` and `dashboard`.
