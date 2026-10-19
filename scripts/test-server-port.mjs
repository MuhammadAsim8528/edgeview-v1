import net from 'node:net';

export async function unusedTestPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  // A bind race is still possible after close. Tests must also verify the PID
  // returned by health before they can send any mutating request.
  return port;
}
