// App.jsx — React Router setup
//
// Defines two routes for the entire application:
//
//   /              → Home page  (create or join a room)
//   /room/:code    → Room page  (the actual watch party)
//
// BrowserRouter uses the HTML5 History API so URLs look clean
// (e.g. /room/A3B9QZ) rather than hash-based (#/room/A3B9QZ).
//
// Routes is the container; each Route maps a URL pattern to a component.
// The `:code` segment in /room/:code is a URL parameter — the Room page
// reads it with React Router's useParams() hook.

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Room from './pages/Room.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Home — create or join a room */}
        <Route path="/" element={<Home />} />

        {/* Room — the watch party UI, :code is the 6-char room code */}
        <Route path="/room/:code" element={<Room />} />

        {/* Catch-all — redirect unknown URLs back to Home */}
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}
