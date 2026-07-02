import redis from './redis.js';
import db from './db.js';

let isRunning = false;
let timerId = null;

/**
 * Flush cached votes from Redis queue into PostgreSQL in a single batch.
 */
export const flushVotes = async () => {
  if (isRunning) return; // Prevent overlapping runs
  isRunning = true;

  try {
    const batchSize = 500; // Process in chunks of 500
    const votesBatch = await redis.popVotesBatch(batchSize);

    if (votesBatch.length === 0) {
      isRunning = false;
      return;
    }

    console.log(`Worker: Flushing ${votesBatch.length} votes to PostgreSQL...`);

    // Build batch SQL insert statement
    const valuePlaceholders = [];
    const flatValues = [];
    let paramIndex = 1;

    for (const vote of votesBatch) {
      valuePlaceholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2})`);
      flatValues.push(vote.question_id, vote.value, vote.created_at);
      paramIndex += 3;
    }

    const queryText = `
      INSERT INTO votes (question_id, value, created_at)
      VALUES ${valuePlaceholders.join(', ')}
    `;

    await db.query(queryText, flatValues);
    console.log(`Worker: Successfully flushed ${votesBatch.length} votes to DB.`);
  } catch (error) {
    console.error("Worker: Error during flushing votes to PostgreSQL:", error);
    // Note: If Postgres fails, the popped votes are lost from Redis in this simple model.
    // In a production system, we would push them to a retry queue or use a transaction-safe structure.
    // However, for low-resource self-hosting where Postgres is running on the same Thin Client,
    // this is a balanced trade-off for simplicity and extreme performance.
  } finally {
    isRunning = false;
  }
};

/**
 * Start the background worker.
 * @param {number} intervalMs 
 */
export const startWorker = (intervalMs = 3000) => {
  if (timerId) clearInterval(timerId);
  console.log(`Starting background worker flushing every ${intervalMs}ms...`);
  timerId = setInterval(flushVotes, intervalMs);
};

/**
 * Stop the background worker.
 */
export const stopWorker = () => {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
    console.log("Background worker stopped.");
  }
};

export default {
  startWorker,
  stopWorker,
  flushVotes,
};
