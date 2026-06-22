import React, { useEffect, useRef } from 'react';

function AudioStream({ stream, deafened }) {
  const audioRef = useRef(null);

  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
    }
  }, [stream]);

  // If local user is deafened, mute the output of the audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = deafened;
    }
  }, [deafened]);

  return <audio ref={audioRef} autoPlay style={{ display: 'none' }} />;
}

export default function AudioStreams({ audioStreams, localDeafened }) {
  return (
    <>
      {Object.entries(audioStreams).map(([userId, stream]) => (
        <AudioStream key={userId} stream={stream} deafened={localDeafened} />
      ))}
    </>
  );
}
