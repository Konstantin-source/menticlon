import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT || '6379';
const redisPassword = process.env.REDIS_PASSWORD || '';

const client = createClient({
  url: `redis://${redisPassword ? `:${redisPassword}@` : ''}${redisHost}:${redisPort}`
});

client.on('error', (err) => console.error('Redis Client Error', err));
client.on('connect', () => console.log('Redis Client Connected'));

export const connectRedis = async () => {
  await client.connect();
};

/**
 * Increments the vote counter in Redis and queues the individual vote for PostgreSQL persistence.
 * @param {string} questionId 
 * @param {string} value 
 * @returns {Promise<number>} The updated vote count for this specific value
 */
export const incrementVote = async (questionId, value) => {
  const hashKey = `question:${questionId}:results`;
  const queueKey = 'votes:queue';
  
  // 1. Increment value in Redis Hash
  const count = await client.hIncrBy(hashKey, value, 1);
  
  // 2. Queue the individual vote record for async DB insertion
  const votePayload = JSON.stringify({
    question_id: questionId,
    value: value,
    created_at: new Date().toISOString()
  });
  await client.lPush(queueKey, votePayload);
  
  return count;
};

/**
 * Fetches the accumulated results for a specific question.
 * @param {string} questionId 
 * @returns {Promise<Record<string, string>>} Object mapping options/words to their vote counts
 */
export const getQuestionResults = async (questionId) => {
  const hashKey = `question:${questionId}:results`;
  return await client.hGetAll(hashKey);
};

/**
 * Pre-populates Redis cache with existing results (e.g. after a server restart).
 * @param {string} questionId 
 * @param {Record<string, number>} results 
 */
export const cacheQuestionResults = async (questionId, results) => {
  const hashKey = `question:${questionId}:results`;
  // If results is empty, skip
  if (Object.keys(results).length === 0) return;
  
  const entries = Object.entries(results);
  for (const [value, count] of entries) {
    await client.hSet(hashKey, value, count.toString());
  }
};

/**
 * Pops a batch of votes from the queue to insert into PostgreSQL.
 * @param {number} batchSize 
 * @returns {Promise<Array<{question_id: string, value: string, created_at: string}>>}
 */
export const popVotesBatch = async (batchSize = 200) => {
  const queueKey = 'votes:queue';
  const batch = [];
  
  for (let i = 0; i < batchSize; i++) {
    const rawVote = await client.rPop(queueKey);
    if (!rawVote) break;
    try {
      batch.push(JSON.parse(rawVote));
    } catch (e) {
      console.error("Failed to parse queued vote:", rawVote, e);
    }
  }
  
  return batch;
};

/**
 * Clears the Redis results hash for a question (used when resetting question state)
 * @param {string} questionId 
 */
export const clearQuestionResults = async (questionId) => {
  const hashKey = `question:${questionId}:results`;
  await client.del(hashKey);
};

export default {
  client,
  connectRedis,
  incrementVote,
  getQuestionResults,
  cacheQuestionResults,
  popVotesBatch,
  clearQuestionResults,
};
