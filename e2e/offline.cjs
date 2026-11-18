// Preloaded (node --require) into the local-mode e2e server. Every outbound socket that is not to this machine is
// refused and written to OFFLINE_LOG, so local-mode.spec.ts can show the server made no cloud call. The first line
// marks that the guard was loaded in this process.
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');

const log = process.env.OFFLINE_LOG;
if (!log) throw new Error('offline.cjs: set OFFLINE_LOG');
fs.mkdirSync(path.dirname(log), { recursive: true });
fs.appendFileSync(log, `loaded ${process.pid}\n`);

const isLocal = (host) => host === undefined || host === '' || host === 'localhost' || host.endsWith('.localhost') || host === '::1' || /^(::ffff:)?127\./.test(host);

const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  // net.connect passes [options, cb] as one array; sockets also take (options, cb) or (port, host, cb)
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  const opts = typeof first === 'object' && first !== null ? first : { port: first, host: typeof args[1] === 'string' ? args[1] : undefined };
  if (opts.path === undefined && !isLocal(opts.host)) {
    fs.appendFileSync(log, `blocked ${opts.host}:${opts.port}\n`);
    process.nextTick(() => this.destroy(new Error(`offline: blocked ${opts.host}:${opts.port}`)));
    return this;
  }
  return connect.apply(this, args);
};
