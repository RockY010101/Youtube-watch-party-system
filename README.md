# 🎬 YouTube Watch Party

> Watch YouTube videos together in real time — perfectly synchronized, with live chat and role-based controls.

[![GitHub repo](https://img.shields.io/badge/GitHub-Youtube--watch--party--system-blue?logo=github)](https://github.com/RockY010101/Youtube-watch-party-system)

---

## 🌐 Live Demo

🔗 **[https://youtube-watch-party-system.vercel.app](https://youtube-watch-party-system.vercel.app)**

---

## 📖 Overview

YouTube Watch Party is a full-stack real-time web application that allows multiple users to watch YouTube videos together in sync. When the host plays, pauses, seeks, or changes the video, every participant in the room sees the same action instantly via WebSockets.

---

## ✨ Features

- 🎥 **Real-time video sync** — Play, pause, seek, and change video synchronized across all participants
- 🏠 **Room-based model** — Create or join rooms with a unique 6-character code
- 👑 **Role-based access control** — Host, Moderator, and Participant roles with different permissions
- 💬 **Live chat** — Real-time chat for all room participants
- 🛡 **Permission enforcement** — Server-side role validation before any state change
- 🔄 **Auto host transfer** — If the host leaves, the next participant is automatically promoted
- 📦 **Persistent rooms** — Room codes survive server restarts via SQLite

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite (plain JavaScript) |
| Backend | Node.js + Express |
| Real-time | Socket.IO (WebSockets) |
| Database | SQLite via sql.js |
| Video | YouTube IFrame API |
| Deployment | Render (backend) + Vercel (frontend) |

---

## 🏗 Architecture

```
Client (React + Vite)               Server (Node.js + Express)
─────────────────────               ──────────────────────────
Home.jsx                            index.js
  └─ Create/Join room  ──REST──►    POST /api/room
                                    GET  /api/room/:code

Room.jsx                            MessageHandler.js
  ├─ socket.js        ◄─WS─────►   ├─ join_room
  ├─ YoutubePlayer.jsx              ├─ play / pause / seek
  ├─ VideoControls.jsx              ├─ change_video
  ├─ ParticipantList.jsx            ├─ assign_role
  └─ Chat.jsx                       ├─ remove_participant
                                    └─ chat_message
                                    RoomManager.js
                                      ├─ Room.js
                                      ├─ Participant.js
                                      └─ db.js (SQLite)
```

---

## 🔐 Role-Based Access Control

| Role | Assigned By | Permissions |
|---|---|---|
| **Host** | Auto (room creator) | Full control: play/pause/seek/change video/assign roles/remove participants |
| **Moderator** | Host | Play/pause/seek/change video |
| **Participant** | Default for joiners | Watch only |

Permission checks happen **server-side** in `MessageHandler.js` before any state mutation.

---

## 📡 WebSocket Events

| Direction | Event | Description |
|---|---|---|
| Client → Server | `join_room` | Join or create a room |
| Client → Server | `play` | Play video (host/mod only) |
| Client → Server | `pause` | Pause video (host/mod only) |
| Client → Server | `seek` | Seek to time (host/mod only) |
| Client → Server | `change_video` | Change video URL (host/mod only) |
| Client → Server | `assign_role` | Assign role to participant (host only) |
| Client → Server | `remove_participant` | Remove user from room (host only) |
| Client → Server | `chat_message` | Send a chat message |
| Client → Server | `request_sync` | Request current video state |
| Server → Client | `joined_room` | Room state on join |
| Server → Client | `sync_state` | Video state broadcast |
| Server → Client | `user_joined` | New participant joined |
| Server → Client | `user_left` | Participant left |
| Server → Client | `role_assigned` | Role was changed |
| Server → Client | `participant_removed` | Participant was removed |
| Server → Client | `you_were_removed` | You were kicked |
| Server → Client | `chat_message` | Incoming chat message |

---

## 📁 Project Structure

```text
Youtube-watch-party-system/
├── .github/
│   └── workflows/
│       └── ci-cd.yml         ← GitHub Actions CI/CD pipeline
├── server/
│   ├── src/
│   │   ├── index.js          ← Express + Socket.IO entry point
│   │   ├── db.js             ← SQLite initialization
│   │   ├── Participant.js    ← Participant class (role, permissions)
│   │   ├── Room.js           ← Room class (state, broadcast)
│   │   ├── RoomManager.js    ← Manages all active rooms
│   │   └── MessageHandler.js ← All Socket.IO event handlers
│   ├── .env.example
│   └── package.json
└── client/
    ├── src/
    │   ├── pages/
    │   │   ├── Features.jsx
    │   │   ├── Home.jsx          ← Create/Join room
    │   │   ├── HowItWorks.jsx
    │   │   └── Room.jsx          ← Watch party page
    │   ├── components/
    │   │   ├── Chat.jsx
    │   │   ├── FloatingReactions.jsx
    │   │   ├── Navbar.jsx
    │   │   ├── ParticipantList.jsx
    │   │   ├── PollWidget.jsx
    │   │   ├── ToastNotifications.jsx
    │   │   ├── VideoControls.jsx
    │   │   ├── VideoQueue.jsx
    │   │   └── YoutubePlayer.jsx
    │   ├── socket.js             ← Socket.IO client singleton
    │   └── App.jsx               ← React Router setup
    ├── vercel.json               ← Vercel rewrite rules for React Router
    ├── index.html
    └── package.json
```

---

## 🚀 CI/CD Pipeline

GitHub Actions automatically deploys on every push to `main`:

```
Frontend — Build Check  →  Deploy — Vercel
Backend  — Test & Build →  Deploy — Render
```

---

## 🌍 Deployment

| Service | Platform | URL |
|---|---|---|
| Frontend | Vercel | [https://youtube-watch-party-system.vercel.app](https://youtube-watch-party-system.vercel.app) |
| Backend | Render | https://youtube-watch-party-system-rv4e.onrender.com |

## 🛠 Local Development

To run this project locally, you'll need Node.js installed on your machine.

### 1. Clone the repository
```bash
git clone https://github.com/RockY010101/Youtube-watch-party-system.git
cd Youtube-watch-party-system
```

### 2. Setup the Server
```bash
cd server
npm install

# Copy the example environment variables
cp .env.example .env

# Start the server (runs on port 3000 by default)
npm run dev
```

### 3. Setup the Client
Open a new terminal window:
```bash
cd client
npm install

# Create a .env file and point it to your local server
echo VITE_SERVER_URL=http://localhost:3000 > .env

# Start the React client
npm run dev
```

The application should now be running! Open your browser and navigate to the URL provided by Vite (typically `http://localhost:5173`).

---

## 📝 Environment Variables

### Server
| Variable | Description |
|---|---|
| `PORT` | Port the server runs on |
| `CLIENT_URL` | Frontend URL for CORS |

### Client
| Variable | Description |
|---|---|
| `VITE_SERVER_URL` | Backend server URL |
