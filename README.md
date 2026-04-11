# Directory List

Directory List is a lightweight local dashboard for checking whether your web apps and TCP services are reachable. It serves a small JSON API with live probe results and a static UI through Nginx.

## What it does

- Reads your local service list from `htdocs/list.json`
- Probes HTTP, HTTPS, and TCP endpoints
- Returns live status data from `/apps`
- Displays everything in a simple browser dashboard

`htdocs/list.json` is intentionally ignored by Git so each person can keep their own private local setup. The repo includes [htdocs/list.sample.json](/Users/justine/MEGA/dev/docker/live/directory_list/htdocs/list.sample.json) as the shared example.

## Quick start

1. Copy the sample config:

   ```bash
   cp htdocs/list.sample.json htdocs/list.json
   ```

2. Edit `htdocs/list.json` for your own local services.
3. Start the API:

   ```bash
   npm install
   npm start
   ```

4. Or run the full stack with Docker:

   ```bash
   docker compose up -d
   ```

5. Open `http://localhost` in your browser.

## JSON format

The list file is grouped by category. Each category contains an array of apps or services.

```json
{
  "host": "host.docker.internal",
  "webapps": [
    {
      "name": "Admin Panel",
      "path": "8080",
      "protocol": "http",
      "webapp": true
    },
    {
      "name": "Secure Dashboard",
      "path": "8443",
      "protocol": "https",
      "allowInsecureTls": true,
      "webapp": true
    }
  ],
  "services": [
    {
      "name": "Backend API",
      "port": "3001",
      "protocol": "tcp",
      "webapp": false
    },
    {
      "name": "MySQL",
      "port": "3306",
      "protocol": "tcp",
      "webapp": false
    },
    {
      "name": "Manual Service",
      "port": "9999",
      "protocol": "tcp",
      "probe": false,
      "status": "checking",
      "webapp": false
    }
  ]
}
```

## Field reference

- `name`: Display name shown in the dashboard.
- `host`: Optional default hostname or IP address for all entries. Defaults to `host.docker.internal`.
- `path`: Commonly used for web apps. If `port` is not set, this value is also used as the probe port.
- `port`: Explicit port to probe.
- `protocol`: Use `http` or `https` for web checks. Any other value is treated as a TCP check.
- `host` on an item: Optional per-entry override for the default host.
- `webapp`: UI hint that marks an item as a browser-based app.
- `probe`: Set to `false` to skip live probing for that item.
- `status`: Optional fallback status when probing is skipped. Valid values are `up`, `down`, and `checking`.
- `allowInsecureTls`: Optional for `https` checks. Set to `true` for local services that use self-signed or otherwise untrusted certificates.

## API endpoints

- `GET /health`: Basic health check.
- `GET /apps`: Returns all configured categories with live status results.
- `GET /status?host=host.docker.internal&port=3001&protocol=tcp`: Probes a single target on demand.

## Notes

- The API defaults to port `3002`.
- Probe timeout defaults to `2500ms`.
- The UI and API are designed for local development environments.
- If an item has `probe: false`, the API keeps the provided `status` instead of performing a live check.
