import { io } from 'socket.io-client';

const socketUrl = import.meta.env.VITE_WS_URL || window.location.origin;

console.log(`Configuring WebSocket connection to: ${socketUrl}`);

/**
 * Socket.io Client Instance
 * Configured with robust reconnection logic:
 * - reconnectionDelay: starts reconnect attempts after 1 second.
 * - reconnectionDelayMax: caps the delay between attempts at 10 seconds.
 * - randomizationFactor (Jitter): applies a 50% random variation to the delay.
 *   This ensures that if 1,000 users disconnect simultaneously, they do not reconnect
 *   at the exact same micro-second, avoiding server-crushing thundering herd scenarios.
 */
export const socket = io(socketUrl, {
  autoConnect: false, // Wait until explicit join action
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10000,
  randomizationFactor: 0.5, 
});

// Debug logs in development
if (import.meta.env.DEV) {
  socket.on('connect', () => console.log('WebSocket Connected'));
  socket.on('disconnect', (reason) => console.log('WebSocket Disconnected:', reason));
  socket.on('reconnect_attempt', (attempt) => console.log(`WebSocket Reconnect Attempt #${attempt}`));
  socket.on('reconnect_failed', () => console.error('WebSocket Reconnection Failed'));
  socket.on('reconnect', (attempt) => console.log(`WebSocket Reconnected after ${attempt} attempts`));
}

export default socket;
