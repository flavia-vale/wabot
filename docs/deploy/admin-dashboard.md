# Admin dashboard deploy notes

The admin dashboard is protected by authenticated Wabot users that have either an active `AdminUser` record or a bootstrap email configured in the API process.

## Bootstrap owner

The production owner bootstrap email is `flavia.vale@usp.br`.

This email is included as the built-in bootstrap owner so the first production admin can access `/admin` after logging in with the same regular Wabot account email. Additional bootstrap emails can be added with the `ADMIN_EMAILS` environment variable as a comma-separated list.

If an `AdminUser` row already exists for a user, its `status` is authoritative: inactive admin rows are not bypassed by the bootstrap email list. This prevents a disabled admin record from regaining access through bootstrap configuration.

## Required deployment steps

1. Pull the branch that contains the admin changes.
2. Run Prisma migrations before restarting the API, because the admin dashboard depends on `AdminUser`, `AdminAuditLog`, `CustomerContactLog`, and new `User` fields.
3. Rebuild the dashboard so the `/admin` route and latest client API helpers are available.
4. Restart both PM2 processes: `api` and `dashboard`.

## Resetting the admin password

Use the password reset helper on the VPS instead of committing passwords to the repository:

```bash
cd /home/deploy/wabot
RESET_EMAIL="flavia.vale@usp.br" RESET_PASSWORD="<new-password>" node scripts/reset-user-password.mjs
pm2 restart api --update-env
pm2 restart dashboard --update-env
```

The helper updates the regular Wabot `User.passwordHash`, keeps the account `active`, and never prints the password or hash to stdout.
