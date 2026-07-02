import { Server } from 'socket.io';
import db from './db.js';
import redis from './redis.js';

let io;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*', // Allow all origins for simplicity in self-hosting
      methods: ['GET', 'POST'],
    },
    // Heartbeat configurations to prevent Cloudflare Tunnel idle timeouts (100s)
    pingInterval: 10000, 
    pingTimeout: 5000,
  });

  io.on('connection', (socket) => {
    let currentRoom = null;
    let userRole = null;
    let userJoinCode = null;

    console.log(`Socket connected: ${socket.id}`);

    // Join a presentation session room
    socket.on('join-session', async ({ joinCode, role }) => {
      userRole = role;
      userJoinCode = joinCode;
      currentRoom = `session:${joinCode}`;
      
      socket.join(currentRoom);
      console.log(`Socket ${socket.id} joined room ${currentRoom} as ${role}`);

      try {
        // Fetch session and active question details
        const sessionRes = await db.query(
          `SELECT s.*, q.id as q_id, q.type, q.text, q.options 
           FROM sessions s 
           LEFT JOIN questions q ON s.active_question_id = q.id 
           WHERE s.join_code = $1`,
          [joinCode]
        );

        if (sessionRes.rows.length === 0) {
          socket.emit('error', 'Session not found');
          return;
        }

        const session = sessionRes.rows[0];

        // Broadcast updated participant count to the room
        const participantCount = io.sockets.adapter.rooms.get(currentRoom)?.size || 0;
        io.to(currentRoom).emit('participant-count', participantCount);

        // If there's an active question, send it to the client
        if (session.active_question_id) {
          const activeQuestion = {
            id: session.q_id,
            type: session.type,
            text: session.text,
            options: session.options,
          };
          socket.emit('question-changed', activeQuestion);

          // If host is joining, send current live results
          if (role === 'host') {
            const results = await redis.getQuestionResults(session.q_id);
            socket.emit('results-update', results);
          }
        }
      } catch (err) {
        console.error('Error on join-session:', err);
        socket.emit('error', 'Failed to join session');
      }
    });

    // Handle vote submission from voter client
    socket.on('submit-vote', async ({ questionId, value }) => {
      if (!questionId || !value) {
        socket.emit('error', 'Invalid vote payload');
        return;
      }

      try {
        // Clean value (trim, lowercase for wordcloud to aggregate correctly)
        const cleanValue = value.toString().trim();
        if (!cleanValue) return;

        // Increment in Redis and push to database queue
        const newCount = await redis.incrementVote(questionId, cleanValue);

        // 1. Send instant feedback confirmation to the individual voter
        socket.emit('vote-confirmed', {
          value: cleanValue,
          count: newCount,
        });

        // 2. Broadcast the aggregated results to the presenter (room)
        if (userJoinCode) {
          const results = await redis.getQuestionResults(questionId);
          io.to(`session:${userJoinCode}`).emit('results-update', results);
        }
      } catch (err) {
        console.error('Error submitting vote:', err);
        socket.emit('error', 'Failed to submit vote');
      }
    });

    // Handle Host advancing slides/questions
    socket.on('change-question', async ({ joinCode, questionId }) => {
      if (userRole !== 'host') {
        socket.emit('error', 'Unauthorized action');
        return;
      }

      try {
        // 1. Update session active_question_id in PostgreSQL
        await db.query(
          'UPDATE sessions SET active_question_id = $1 WHERE join_code = $2',
          [questionId, joinCode]
        );

        // 2. Fetch the question details
        const questionRes = await db.query(
          'SELECT id, type, text, options FROM questions WHERE id = $1',
          [questionId]
        );

        if (questionRes.rows.length === 0) {
          socket.emit('error', 'Question not found');
          return;
        }

        const question = questionRes.rows[0];

        // 3. Broadcast question change to everyone in the room
        io.to(`session:${joinCode}`).emit('question-changed', {
          id: question.id,
          type: question.type,
          text: question.text,
          options: question.options,
        });

        // 4. Fetch and broadcast any initial results for the new question from Redis
        const results = await redis.getQuestionResults(question.id);
        io.to(`session:${joinCode}`).emit('results-update', results);
      } catch (err) {
        console.error('Error changing question:', err);
        socket.emit('error', 'Failed to change question');
      }
    });

    // Handle Host resetting a question's results
    socket.on('reset-question', async ({ questionId, joinCode }) => {
      if (userRole !== 'host') {
        socket.emit('error', 'Unauthorized action');
        return;
      }

      try {
        // 1. Clear results in Redis
        await redis.clearQuestionResults(questionId);
        
        // 2. Clear results in PostgreSQL
        await db.query('DELETE FROM votes WHERE question_id = $1', [questionId]);

        // 3. Broadcast empty results
        io.to(`session:${joinCode}`).emit('results-update', {});
      } catch (err) {
        console.error('Error resetting question:', err);
        socket.emit('error', 'Failed to reset question');
      }
    });

    // Handle client disconnect
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      if (currentRoom) {
        const participantCount = io.sockets.adapter.rooms.get(currentRoom)?.size || 0;
        io.to(currentRoom).emit('participant-count', participantCount);
      }
    });
  });

  return io;
};

export { io };
