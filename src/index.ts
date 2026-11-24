import { loadEnvFile } from "./config.js";
import { runCli } from "./cli.js";

loadEnvFile();

runCli(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.stack ?? err.message : String(err));
    process.exit(1);
  });
