/**
 * Job Queue Worker — runs as a separate PM2 process on the Droplet.
 * Polls every 5 seconds for QUEUED generation jobs and processes them
 * by calling the local /api/worker/process endpoint.
 *
 * No Vercel timeout issues — this runs indefinitely on the Droplet.
 */

const POLL_INTERVAL = 5000;
const WORKER_PORT = process.env.PORT || 3001;
const CRON_SECRET = process.env.CRON_SECRET || "";
const BASE_URL = `http://127.0.0.1:${WORKER_PORT}`;

let processing = false;

async function poll() {
  if (processing) return;
  processing = true;

  try {
    const res = await fetch(`${BASE_URL}/api/worker/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CRON_SECRET}`,
      },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(180000),
    });

    const data = await res.json();

    if (data.processed) {
      console.log(`[worker] Processed job ${data.jobId}`);
      // Immediately check for more queued jobs
      processing = false;
      poll();
      return;
    }
  } catch (err) {
    // Server might not be ready yet or request failed — will retry
  }

  processing = false;
}

console.log(`[worker] Started — polling ${BASE_URL} every ${POLL_INTERVAL / 1000}s`);
setInterval(poll, POLL_INTERVAL);

// Initial poll after short delay to let the server start
setTimeout(poll, 2000);
