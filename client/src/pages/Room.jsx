// Room.jsx — placeholder for Block 8
// Will become the full watch party page with YouTube player, chat, and controls.
import { useParams } from 'react-router-dom';

export default function Room() {
  const { code } = useParams();
  return <div style={{ color: '#fff', padding: 40 }}>Room {code} — coming in Block 8</div>;
}
