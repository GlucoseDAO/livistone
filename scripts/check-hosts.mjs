import assert from 'node:assert/strict';
import { request } from 'node:http';
import { createServer, preview } from 'vite';

function get(port, host, path = '/') {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path, headers: { Host: host } }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks) }));
    });
    req.setTimeout(15000, () => req.destroy(new Error('Host check timed out')));
    req.on('error', reject); req.end();
  });
}
for (const mode of ['development', 'preview']) {
  const options = { host: '127.0.0.1', port: 0, strictPort: false };
  const server = mode === 'development' ? await createServer({ server: options }) : await preview({ preview: options });
  try {
    if (mode === 'development') await server.listen();
    const port = server.httpServer.address().port;
    for (const host of ['localhost', 'livistone.liviazaharia.com', `livistone.liviazaharia.com:${port}`]) {
      const result = await get(port, host);
      assert.equal(result.status, 200, `${mode}: ${host}`);
      assert.match(result.body.toString(), /<html/i);
    }
    for (const host of ['unapproved.invalid', 'livistone.liviazaharia.com.unapproved.invalid']) {
      assert.equal((await get(port, host)).status, 403, `${mode}: reject ${host}`);
    }
    if (mode === 'preview') {
      const audio = await get(port, 'livistone.liviazaharia.com', '/audio/kalimba/kalimba-01.m4a');
      assert.equal(audio.status, 200); assert.equal(audio.body.subarray(4, 8).toString(), 'ftyp');
      assert.ok(audio.body.length > 100000, 'Preview must serve audio, not an LFS pointer');
    }
    console.log(`${mode}: allowed hosts accepted, other hosts rejected${mode === 'preview' ? ', audio served' : ''}.`);
  } finally {
    if (mode === 'development') await server.close();
    else { server.httpServer.closeAllConnections(); await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve())); }
  }
}
