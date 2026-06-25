# WEDOS deployment

The project targets PHP 8.3 and Laravel 12.61.1 or newer.

## Build

From the repository root, run:

```powershell
node scripts/build-wedos.mjs
```

The command creates:

- `deploy/wedos/frontend` for `/www/subdom/ontop`
- `deploy/wedos/backend` for `/www/subdom/ontop-be`

Before uploading, edit:

```text
deploy/wedos/backend/_app/.env
```

Set the real values for `DB_USERNAME` and `DB_PASSWORD`. The build script
already generates a new `APP_KEY`. For repeatable private configuration, create
the ignored file `deployment/wedos/backend.env` from
`deployment/wedos/backend.env.template`; the build script will use it.

## Upload

Upload the contents of `deploy/wedos/frontend`, not the directory itself, to:

```text
/www/subdom/ontop
```

Upload the contents of `deploy/wedos/backend`, not the directory itself, to:

```text
/www/subdom/ontop-be
```

Do not overwrite the production `_app/.env` on later deployments unless its
settings should change.

The backend document root contains only the HTTP loader. Laravel and `.env` are
inside `_app`, which is denied by both the root and nested `.htaccess`.

## Database

Preferred option, if WEDOS SSH is available:

```bash
cd /www/subdom/ontop-be/_app
php artisan migrate --force
```

Without SSH, import `deployment/wedos/runs.sql` through phpMyAdmin.

The PHP installation must have at least `pdo_mysql`, `mbstring`, `openssl`,
`tokenizer`, `xml`, `ctype`, `json`, and `fileinfo`.

## Writable directories

PHP must be able to write to:

```text
/www/subdom/ontop-be/_app/storage
/www/subdom/ontop-be/_app/bootstrap/cache
```

Use WEDOS file permissions recommended for PHP, typically `775` for these
directories. Do not use `777` unless WEDOS support explicitly requires it.

## Verification

1. Open `https://ontop-be.bata.eu/up`; it should return a healthy response.
2. Open `https://ontop.bata.eu/` and start a run.
3. In browser developer tools, verify requests go to
   `https://ontop-be.bata.eu/api`.
4. Verify `https://ontop-be.bata.eu/_app/.env` returns `403`.

The production API accepts browser requests only with the exact origin
`https://ontop.bata.eu` and applies rate limits. This prevents calls from other
websites, but it is not client authentication: scripts can forge an `Origin`
header. Run tokens, server-side timing, validation, HTTPS, and rate limiting
remain the security controls for public API clients.
