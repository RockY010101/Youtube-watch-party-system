// socket.js — Socket.IO client singleton
//
// WHY A SINGLETON?
// React components re-render constantly.  If we created a new socket inside a
// component, we'd get a fresh connection every render — connections piling up,
// events firing multiple times, chaos.  By creating the socket ONCE here and
// exporting it, every file that imports `socket` gets the SAME instance.
//
// WHY autoConnect: false?
// We don't want to open a WebSocket the moment the app loads (the user might
// just be on the Home page, not in a room yet).  Instead, the Room page calls
// socket.connect() explicitly after the user has provided their name + code,
// and socket.disconnect() when they leave.  This keeps connections intentional.

import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';
// import.meta.env is Vite's way of reading .env variables.
// Any variable prefixed with VITE_ is exposed to the browser bundle.
// Non-VITE_ prefixed variables are server-only and NOT exposed.

const socket = io(SERVER_URL, {
  autoConnect: false,   // don't connect until we explicitly call socket.connect()
  reconnection: true,   // automatically try to reconnect if the connection drops
  reconnectionAttempts: 5,          // give up after 5 failed attempts
  reconnectionDelay: 1000,          // wait 1s before first retry
  reconnectionDelayMax: 5000,       // cap retry delay at 5s
});

// Optional: log connection lifecycle events in development
if (import.meta.env.DEV) {
  socket.on('connect',    () => console.log('[socket] connected:', socket.id));
  socket.on('disconnect', (r) => console.log('[socket] disconnected:', r));
  socket.on('connect_error', (e) => console.error('[socket] connection error:', e.message));
}

export default socket;
