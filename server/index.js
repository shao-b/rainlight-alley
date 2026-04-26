import app from './app.js';
import { env } from './config/env.js';
import { startDailyUnlockJob } from './jobs/dailyUnlock.js';

app.listen(env.port, () => {
  console.info(`Rainlight backend listening on :${env.port}`);
});

startDailyUnlockJob();
