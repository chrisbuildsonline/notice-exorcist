import { readConfig } from '../config';
import { waitForOllama } from './probe';

/** CLI: waits up to 60 s for Ollama to serve the configured model, else exits non-zero with the reason. */
const config = readConfig();
const r = await waitForOllama(config, { timeoutMs: 60000 });
if (r.up) {
  process.stdout.write(`ollama ready: ${config.model} at ${config.baseUrl}\n`);
} else {
  process.stderr.write(`ollama not ready after 60 s: ${r.reason}\n`);
  process.exit(1);
}
