const http = require("http");
const https = require("https");
const net = require("net");
const fs = require("fs/promises");
const path = require("path");
const { URL } = require("url");

const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT || 3002);
const PROBE_TIMEOUT_MS = Number(process.env.PROBE_TIMEOUT_MS || 2500);
const LIST_PATH = path.join(__dirname, "htdocs", "list.json");

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(payload));
};

const isHttpProtocol = (protocol) => {
  const value = String(protocol || "http").trim().toLowerCase();
  return value === "http" || value === "https";
};

const normalizeStatus = (status) => {
  const value = String(status || "").trim().toLowerCase();
  if (value === "up") return "up";
  if (value === "down") return "down";
  return "checking";
};

const cloneData = (value) => JSON.parse(JSON.stringify(value));

const probeTcp = ({ host, port, timeoutMs }) =>
  new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (status, error = null) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ status, error });
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish("up"));
    socket.once("timeout", () => finish("down", "timeout"));
    socket.once("error", (error) => finish("down", error.code || error.message || "error"));

    socket.connect(port, host);
  });

const getAllowInsecureTls = (app, data) => {
  if (typeof app.allowInsecureTls === "boolean") return app.allowInsecureTls;
  if (typeof app.insecureTls === "boolean") return app.insecureTls;
  if (typeof data.allowInsecureTls === "boolean") return data.allowInsecureTls;
  if (typeof data.insecureTls === "boolean") return data.insecureTls;
  return false;
};

const probeHttp = ({ protocol, host, port, timeoutMs, allowInsecureTls = false }) =>
  new Promise((resolve) => {
    const transport = protocol === "https" ? https : http;
    const req = transport.request(
      {
        host,
        port,
        method: "GET",
        rejectUnauthorized: protocol === "https" ? !allowInsecureTls : undefined
      },
      (response) => {
        response.resume();
        resolve({
          status: response.statusCode < 500 ? "up" : "down",
          httpStatus: response.statusCode
        });
      }
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error("timeout"));
    });

    req.once("error", (error) => {
      resolve({
        status: "down",
        error: error.message
      });
    });

    req.end();
  });

const parseProbeRequest = (req) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const host = (url.searchParams.get("host") || "").trim() || "host.docker.internal";
  const port = Number(url.searchParams.get("port"));
  const protocol = (url.searchParams.get("protocol") || "").trim().toLowerCase();

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { error: "A valid port is required." };
  }

  return {
    host,
    port,
    protocol,
    timeoutMs: PROBE_TIMEOUT_MS
  };
};

const getDefaultHost = (data) => {
  const host = String(data.host || "").trim();
  return host || "host.docker.internal";
};

const getAppHost = (app, defaultHost) => {
  const host = String(app.host || "").trim();
  return host || defaultHost;
};

const getAppPort = (app) => {
  if (app.port !== undefined && app.port !== null && app.port !== "") {
    const port = Number(app.port);
    return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : null;
  }

  const maybePort = Number(app.path);
  return Number.isInteger(maybePort) && maybePort >= 1 && maybePort <= 65535 ? maybePort : null;
};

const getAppProtocol = (app) => String(app.protocol || "http").trim().toLowerCase();

const canProbeApp = (app) => {
  if (app.probe === false) return false;
  return getAppPort(app) !== null;
};

const probeApp = async (app, defaultHost, data) => {
  if (!canProbeApp(app)) {
    return {
      ...app,
      status: normalizeStatus(app.status)
    };
  }

  const protocol = getAppProtocol(app);
  const request = {
    host: getAppHost(app, defaultHost),
    port: getAppPort(app),
    protocol,
    timeoutMs: PROBE_TIMEOUT_MS,
    allowInsecureTls: getAllowInsecureTls(app, data)
  };

  const result = isHttpProtocol(protocol)
    ? await probeHttp(request)
    : await probeTcp(request);

  return {
    ...app,
    status: normalizeStatus(result.status),
    probeMeta: {
      host: request.host,
      port: request.port,
      protocol: protocol || "tcp",
      ...(result.httpStatus ? { httpStatus: result.httpStatus } : {}),
      ...(result.error ? { error: result.error } : {})
    }
  };
};

const readApps = async () => {
  const raw = await fs.readFile(LIST_PATH, "utf8");
  return JSON.parse(raw);
};

const buildAppsPayload = async () => {
  const data = cloneData(await readApps());
  const defaultHost = getDefaultHost(data);
  const categories = Object.keys(data);

  await Promise.all(
    categories.map(async (category) => {
      if (!Array.isArray(data[category])) return;
      data[category] = await Promise.all(data[category].map((app) => probeApp(app, defaultHost, data)));
    })
  );

  return data;
};

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && url.pathname === "/status") {
    const probeRequest = parseProbeRequest(req);
    if (probeRequest.error) {
      sendJson(res, 400, { status: "down", error: probeRequest.error });
      return;
    }

    const result = isHttpProtocol(probeRequest.protocol)
      ? await probeHttp(probeRequest)
      : await probeTcp(probeRequest);

    sendJson(res, 200, {
      host: probeRequest.host,
      port: probeRequest.port,
      protocol: probeRequest.protocol || "tcp",
      ...result
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/apps") {
    try {
      const data = await buildAppsPayload();
      sendJson(res, 200, data);
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

server.listen(PORT, HOST, () => {
  console.log(`Status API listening on ${HOST}:${PORT}`);
});
