import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

const poolConfig = connectionString 
  ? { connectionString } 
  : {
      user: process.env.DB_USER || 'vibepoll_admin',
      password: process.env.DB_PASSWORD || 'choose_a_strong_database_password',
      host: process.env.DB_HOST || 'postgres',
      database: process.env.DB_NAME || 'vibepoll',
      port: parseInt(process.env.DB_PORT || '5432', 10),
    };

// Small pool for low resource footprint
poolConfig.max = 10;
poolConfig.idleTimeoutMillis = 30000;
poolConfig.connectionTimeoutMillis = 2000;

const pool = new Pool(poolConfig);

export const query = (text, params) => pool.query(text, params);

export const initDb = async () => {
  const client = await pool.connect();
  try {
    console.log("Initializing PostgreSQL database...");
    
    // Create Sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        join_code VARCHAR(6) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        active_question_id UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Questions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL, -- 'bar' or 'wordcloud'
        text TEXT NOT NULL,
        options JSONB, -- list of strings for bar chart; null for wordcloud
        "order" INT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Votes table (indexed on question_id for fast reads)
    await client.query(`
      CREATE TABLE IF NOT EXISTS votes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
        value TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Index on votes.question_id
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_votes_question_id ON votes(question_id);
    `);

    // Add foreign key constraint to sessions for active_question_id if not present
    // Using a separate try/catch since ALTER TABLE can fail if already existing
    try {
      await client.query(`
        ALTER TABLE sessions 
        ADD CONSTRAINT fk_active_question 
        FOREIGN KEY (active_question_id) REFERENCES questions(id) ON DELETE SET NULL;
      `);
    } catch (err) {
      // Constraint already exists
    }

    console.log("Database initialized successfully.");
  } catch (error) {
    console.error("Database initialization failed:", error);
    throw error;
  } finally {
    client.release();
  }
};

export default {
  query,
  initDb,
  pool,
};
