import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

/** Test helper: a local HTTP server with a handler, on a free port. */
export type Stub = { url: string; requests: { method: string; path: string; body: string }[]; close: () => Promise<void> };

export async function startStub(handler: (req: IncomingMessage, body: string, res: ServerResponse) => void): Promise<Stub> {
  const requests: Stub['requests'] = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      requests.push({ method: req.method ?? '', path: req.url ?? '', body });
      handler(req, body, res);
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    close: () =>
      new Promise<void>((r) => {
        server.closeAllConnections();
        server.close(() => r());
      }),
  };
}

export const sendJson = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

/** A port that was free a moment ago and has nothing listening on it now. */
export async function closedPort(): Promise<string> {
  const s = await startStub(() => {});
  await s.close();
  return s.url;
}
