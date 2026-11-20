// Zero-localhost in-process bridge between Electron's protocol.handle (Web Request/Response)
// and Moundshroud's Node HTTP handlers (req, res). Supports static files, byte ranges, binary
// uploads, JSON APIs, and live token streaming (/api/chat) without opening any TCP port.
const { Readable, Writable } = require('stream');

const NO_BODY_STATUS = new Set([101, 204, 205, 304]);
const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade']);

function makeReq(webRequest, urlObj) {
  const headers = {};
  if (webRequest.headers && typeof webRequest.headers.forEach === 'function') {
    webRequest.headers.forEach((v, k) => {
      const lk = String(k).toLowerCase();
      if (lk === 'accept-encoding') return; // in-process transfer needs no gzip/br compression
      headers[lk] = v;
    });
  }
  headers.host = urlObj.host.toLowerCase();

  let reader = null;
  let started = false;
  const body = webRequest.body;

  const req = new Readable({
    read() {
      if (!body) {
        this.push(null);
        return;
      }
      if (!started) {
        started = true;
        reader = body.getReader();
      }
      reader.read().then(
        ({ done, value }) => {
          if (done) this.push(null);
          else this.push(Buffer.from(value));
        },
        err => this.destroy(err)
      );
    }
  });

  req.method = (webRequest.method || 'GET').toUpperCase();
  req.url = urlObj.pathname + urlObj.search;
  req.headers = headers;
  req.httpVersion = '1.1';
  req.socket = { remoteAddress: '127.0.0.1', encrypted: true };
  req.connection = req.socket;
  return req;
}

function dispatchToHandler(handler, webRequest) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(webRequest.url);
    const req = makeReq(webRequest, urlObj);

    let resolved = false;
    let statusCode = 200;
    const rawHeaders = new Map(); // lower -> { name, value }
    let streamController = null;
    let streamClosed = false;
    const pendingChunks = [];

    const buildHeaders = () => {
      const h = new Headers();
      for (const [lk, entry] of rawHeaders.entries()) {
        if (HOP_BY_HOP.has(lk)) continue;
        const val = entry.value;
        if (Array.isArray(val)) val.forEach(v => h.append(entry.name, String(v)));
        else if (val !== undefined && val !== null) h.set(entry.name, String(val));
      }
      return h;
    };

    const webStream = new ReadableStream({
      start(controller) {
        streamController = controller;
        while (pendingChunks.length) {
          controller.enqueue(pendingChunks.shift());
        }
        if (streamClosed) {
          try { controller.close(); } catch (e) { }
        }
      },
      cancel() {
        streamClosed = true;
        try { req.destroy(); } catch (e) { }
        res.emit('close');
      }
    });

    const flushHeaders = () => {
      if (resolved) return;
      resolved = true;
      res.headersSent = true;
      const isNoBody = NO_BODY_STATUS.has(statusCode) || req.method === 'HEAD';
      if (isNoBody) {
        streamClosed = true;
        if (streamController) { try { streamController.close(); } catch (e) { } }
        resolve(new Response(null, { status: statusCode, headers: buildHeaders() }));
      } else {
        resolve(new Response(webStream, { status: statusCode, headers: buildHeaders() }));
      }
    };

    const pushChunk = chunk => {
      if (streamClosed || NO_BODY_STATUS.has(statusCode) || req.method === 'HEAD') return;
      const u8 = Buffer.isBuffer(chunk)
        ? new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength)
        : typeof chunk === 'string'
          ? new TextEncoder().encode(chunk)
          : new Uint8Array(chunk);
      if (!u8.byteLength) return;
      if (streamController) {
        try { streamController.enqueue(u8); } catch (e) { streamClosed = true; }
      } else {
        pendingChunks.push(u8);
      }
    };

    const res = new Writable({
      write(chunk, enc, cb) {
        flushHeaders();
        pushChunk(typeof chunk === 'string' ? Buffer.from(chunk, enc) : chunk);
        cb();
      },
      final(cb) {
        flushHeaders();
        if (!streamClosed) {
          streamClosed = true;
          if (streamController) { try { streamController.close(); } catch (e) { } }
        }
        res.writableEnded = true;
        cb();
        res.emit('close');
      }
    });

    res.statusCode = 200;
    res.headersSent = false;
    res.writableEnded = false;

    res.setHeader = (name, value) => {
      rawHeaders.set(String(name).toLowerCase(), { name: String(name), value });
      return res;
    };
    res.getHeader = name => {
      const e = rawHeaders.get(String(name).toLowerCase());
      return e ? e.value : undefined;
    };
    res.hasHeader = name => rawHeaders.has(String(name).toLowerCase());
    res.removeHeader = name => { rawHeaders.delete(String(name).toLowerCase()); };
    res.getHeaders = () => {
      const out = {};
      for (const [k, e] of rawHeaders.entries()) out[k] = e.value;
      return out;
    };
    res.writeHead = (code, msgOrHeaders, maybeHeaders) => {
      statusCode = Number(code) || 200;
      res.statusCode = statusCode;
      const hdrs = typeof msgOrHeaders === 'object' && msgOrHeaders !== null ? msgOrHeaders : maybeHeaders;
      if (hdrs && typeof hdrs === 'object') {
        for (const [k, v] of Object.entries(hdrs)) res.setHeader(k, v);
      }
      flushHeaders();
      return res;
    };
    res.flushHeaders = flushHeaders;

    if (webRequest.signal) {
      const onAbort = () => {
        streamClosed = true;
        try { req.destroy(); } catch (e) { }
        res.emit('close');
      };
      if (webRequest.signal.aborted) onAbort();
      else webRequest.signal.addEventListener('abort', onAbort, { once: true });
    }

    try {
      const maybePromise = handler(req, res);
      if (maybePromise && typeof maybePromise.catch === 'function') {
        maybePromise.catch(err => {
          if (!resolved) {
            statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: String((err && err.message) || err) }));
          } else if (!streamClosed) {
            streamClosed = true;
            if (streamController) { try { streamController.close(); } catch (e) { } }
          }
        });
      }
    } catch (err) {
      if (!resolved) reject(err);
    }
  });
}

module.exports = { dispatchToHandler };
