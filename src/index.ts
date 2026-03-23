import 'dotenv/config';
import { loadConfig } from './config.js';
import { startBot } from './whatsapp.js';
import { logProviderStatus } from './llm.js';

async function main(): Promise<void> {
  try {
    const config = loadConfig();
    logProviderStatus();
    await startBot(config);
  } catch (err) {
    console.error('❌ Fatal:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
