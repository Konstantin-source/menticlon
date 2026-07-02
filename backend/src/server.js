import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import db from './db.js';
import redis from './redis.js';
import { initSocket } from './socket.js';
import { startWorker, stopWorker, flushVotes } from './worker.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;

app.use(cors({ origin: '*' }));
app.use(express.json());

// Helper: Generate a unique 6-digit Join Code
const generateJoinCode = async () => {
  let attempts = 0;
  while (attempts < 10) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const res = await db.query('SELECT 1 FROM sessions WHERE join_code = $1', [code]);
    if (res.rows.length === 0) {
      return code;
    }
    attempts++;
  }
  throw new Error("Could not generate a unique join code");
};

// API: Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// API: Create a new presentation session with slides/questions
app.post('/api/sessions', async (req, res) => {
  const { title, questions } = req.body;

  if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'Session title and questions array are required.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const joinCode = await generateJoinCode();
    
    // 1. Insert session
    const sessionRes = await client.query(
      'INSERT INTO sessions (join_code, title) VALUES ($1, $2) RETURNING *',
      [joinCode, title]
    );
    const session = sessionRes.rows[0];

    // 2. Insert questions
    const createdQuestions = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.type || !q.text) {
        throw new Error('Question type and text are required.');
      }
      
      const qRes = await client.query(
        `INSERT INTO questions (session_id, type, text, options, "order") 
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [session.id, q.type, q.text, q.options ? JSON.stringify(q.options) : null, i]
      );
      createdQuestions.push(qRes.rows[0]);
    }

    // 3. Set the first question as active
    const firstQuestionId = createdQuestions[0].id;
    await client.query(
      'UPDATE sessions SET active_question_id = $1 WHERE id = $2',
      [firstQuestionId, session.id]
    );
    session.active_question_id = firstQuestionId;

    await client.query('COMMIT');

    res.status(201).json({
      ...session,
      questions: createdQuestions
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  } finally {
    client.release();
  }
});

// API: Get session details by 6-digit Join Code
app.get('/api/sessions/:joinCode', async (req, res) => {
  const { joinCode } = req.params;

  try {
    // Fetch session details
    const sessionRes = await db.query(
      'SELECT * FROM sessions WHERE join_code = $1',
      [joinCode]
    );

    if (sessionRes.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionRes.rows[0];

    // Fetch all questions for this session
    const questionsRes = await db.query(
      'SELECT * FROM questions WHERE session_id = $1 ORDER BY "order" ASC',
      [session.id]
    );

    res.json({
      ...session,
      questions: questionsRes.rows
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// API: Get results for a question (combines Redis cache & Postgres fallback)
app.get('/api/questions/:questionId/results', async (req, res) => {
  const { questionId } = req.params;

  try {
    // 1. Try to read results from Redis Hash
    let results = await redis.getQuestionResults(questionId);

    // 2. If Redis has no results (cache empty/expired), read from PostgreSQL and populate cache
    if (!results || Object.keys(results).length === 0) {
      console.log(`Cache miss for question ${questionId}. Fetching results from DB...`);
      const dbRes = await db.query(
        'SELECT value, COUNT(*) as count FROM votes WHERE question_id = $1 GROUP BY value',
        [questionId]
      );

      results = {};
      const cacheData = {};
      
      for (const row of dbRes.rows) {
        results[row.value] = parseInt(row.count, 10);
        cacheData[row.value] = parseInt(row.count, 10);
      }

      // Cache back to Redis
      if (Object.keys(cacheData).length > 0) {
        await redis.cacheQuestionResults(questionId, cacheData);
      }
    } else {
      // Redis returns strings for values, convert counts to numbers
      for (const key in results) {
        results[key] = parseInt(results[key], 10);
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Error fetching question results:', error);
    res.status(500).json({ error: 'Failed to fetch question results' });
  }
});

// Initialize services and startup
const startServer = async () => {
  try {
    // 1. Connect to PostgreSQL and init tables
    await db.initDb();

    // 2. Connect to Redis
    await redis.connectRedis();

    // 3. Start batch write worker
    startWorker(3000); // 3 seconds interval

    // 4. Attach WebSockets
    initSocket(server);

    // 5. Listen
    server.listen(PORT, () => {
      console.log(`VibePoll server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

// Handle Graceful Shutdown
const handleShutdown = async (signal) => {
  console.log(`Received ${signal}. Starting graceful shutdown...`);
  
  stopWorker();
  
  // Flush remaining votes in Redis queue to PG
  console.log("Flushing remaining votes to PostgreSQL...");
  await flushVotes();
  
  // Close database pool
  console.log("Closing DB connection pool...");
  await db.pool.end();
  
  // Close Redis client
  console.log("Closing Redis client...");
  await redis.client.disconnect();
  
  console.log("Shutdown complete. Exiting.");
  process.exit(0);
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

startServer();
