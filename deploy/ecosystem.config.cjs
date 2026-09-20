// deploy/ecosystem.config.cjs
// PM2 process file. Usage (from the project root, after `npm run build`):
//   pm2 start deploy/ecosystem.config.cjs && pm2 save && pm2 startup
const path = require("path")

module.exports = {
  apps: [
    {
      name: "zamorax",
      cwd: path.resolve(__dirname, ".."),          // project root
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      // IMPORTANT: keep this at ONE process (fork mode). middleware.ts keeps its rate-limit
      // counters in memory, so cluster mode would split them across workers and multiply
      // every limit by the worker count.
      exec_mode: "fork",
      instances: 1,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        // Next.js reads .env.production from the project root automatically.
        INTERNAL_APP_URL: "http://127.0.0.1:3000",  // keeps middleware's self-fetch on loopback
      },
    },
  ],
}
