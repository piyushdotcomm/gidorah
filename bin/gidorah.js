#!/usr/bin/env node
import { main } from "../dist/apps/cli/src/main.js";

try {
  const code = await main();
  process.exit(code);
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(6);
}
