import { serve } from "bun";
import { connect } from "net";

const config = await Bun.file("config.json").json();
const { token, login } = config;

// Кэш для пинга
let pingCache = null;
let lastPingTime = 0;
const CACHE_DURATION = 180 * 1000; // 3 минуты в миллисекундах

// Функция для TCP-пинга
async function tcpPing(address) {
  const [host, port] = address.split(":");
  return new Promise((resolve) => {
    const start = performance.now();
    const socket = connect({ host, port: parseInt(port) });

    socket.setTimeout(2000); // Таймаут 2 секунды

    socket.on("connect", () => {
      const ping = Math.round(performance.now() - start);
      socket.end();
      resolve(`${ping} ms`);
    });

    socket.on("timeout", () => {
      socket.end();
      resolve("Timeout");
    });

    socket.on("error", () => {
      socket.end();
      resolve("Unreachable");
    });
  });
}

// Функция для получения данных пинга
async function getPingData() {
  const addresses = await Bun.file("addresses.json").json();
  const result = structuredClone(addresses); // Глубокая копия

  for (const pool of result.pools) {
    for (const tunnel of pool.tunnels) {
      tunnel.ping = await tcpPing(tunnel.address);
    }
  }

  pingCache = result;
  lastPingTime = Date.now();
  return result;
}

serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);

    // Эндпоинт для списка серверов
    if (req.method === "GET" && url.pathname === "/servers") {
      const apiUrl = `http://launcher.stalcraft.net/listServers?full=false&token=${token}&login=${login}`;
      const response = await fetch(apiUrl);
      if (!response.ok) {
        return new Response("API Error", { status: 500 });
      }
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Эндпоинт для пинга серверов
    if (req.method === "GET" && url.pathname === "/ping") {
      if (pingCache && Date.now() - lastPingTime < CACHE_DURATION) {
        return new Response(JSON.stringify(pingCache), {
          headers: { "Content-Type": "application/json" },
        });
      }
      const pingData = await getPingData();
      return new Response(JSON.stringify(pingData), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Обслуживание статических файлов
    if (req.method === "GET") {
      const filePath = url.pathname === "/" ? "public/index.html" : `public${url.pathname}`;
      const file = Bun.file(filePath);
      if (await file.exists()) {
        const contentType = filePath.endsWith('.js') ? 'application/javascript' :
                           filePath.endsWith('.css') ? 'text/css' :
                           filePath.endsWith('.ttf') ? 'font/ttf' :
                           filePath.endsWith('.svg') ? 'image/svg+xml' : 'text/html';
        return new Response(file, {
          headers: { "Content-Type": contentType },
        });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
});