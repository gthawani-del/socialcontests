import { readFile } from 'node:fs/promises';
import { verifySignedReplay } from './index.mjs';
const [inputPath, flag, keyPath] = process.argv.slice(2);
if (!inputPath || flag !== '--key' || !keyPath) {
  console.error('Usage: node server/football-pinball/verify.mjs result-bundle.json --key trusted-public-key.pem');
  process.exitCode = 2;
} else {
  try {
    const bundle = JSON.parse(await readFile(inputPath, 'utf8'));
    // The trusted verification key must be selected separately; do not trust a key embedded in a result bundle.
    const trustedKey = await readFile(keyPath, 'utf8');
    const result = await verifySignedReplay(bundle.envelope, bundle.replay, trustedKey);
    console.log(JSON.stringify({ valid: result.valid, ...(result.reason ? { reason: result.reason } : {}), ...(result.valid ? { result: result.result, notice: 'Verified signature, pinned rules and implementation, and canonical replay. Not independent fairness certification.' } : {}) }, null, 2));
    process.exitCode = result.valid ? 0 : 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
