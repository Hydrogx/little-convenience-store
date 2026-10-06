#!/usr/bin/env node
/**
 * 小小便利店 / Little Convenience Store
 * 零依赖静态开发服务器 —— 只服务工作区内的静态资源。
 *
 *   node server.mjs            # 默认 http://127.0.0.1:5173
 *   node server.mjs --port 8080
 */
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8'
};

function readArg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1];
  const inline = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  return fallback;
}

const PORT = Number(readArg('port', process.env.PORT || 5173));
const HOST = readArg('host', process.env.HOST || '127.0.0.1');

/** 防止路径穿越：任何解析结果必须留在 ROOT 内。 */
function safeResolve(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const normalized = normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  const target = resolve(join(ROOT, normalized));
  if (target !== ROOT && !target.startsWith(ROOT + sep)) return null;
  return target;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    ...headers
  });
  res.end(body);
}

const server = createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, 'Method Not Allowed', { 'Content-Type': 'text/plain; charset=utf-8' });
    return;
  }

  let target = safeResolve(req.url || '/');
  if (!target) {
    send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain; charset=utf-8' });
    return;
  }

  try {
    const info = statSync(target, { throwIfNoEntry: false });
    if (info && info.isDirectory()) target = join(target, 'index.html');
  } catch {
    /* 交给下面的读取逻辑处理 */
  }

  const info = statSync(target, { throwIfNoEntry: false });
  if (!info || !info.isFile()) {
    send(res, 404, `404 Not Found: ${req.url}`, { 'Content-Type': 'text/plain; charset=utf-8' });
    return;
  }

  const type = MIME[extname(target).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': info.size,
    'Cache-Control': 'no-cache'
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(target).pipe(res);
});

server.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}/`;
  process.stdout.write(`小小便利店 / Little Convenience Store\n`);
  process.stdout.write(`serving ${ROOT}\n`);
  process.stdout.write(`ready at ${url}\n`);
});
