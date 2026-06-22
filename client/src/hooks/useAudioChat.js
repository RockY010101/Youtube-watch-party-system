import { useState, useEffect, useRef } from 'react';
import socket from '../socket';

export function useAudioChat(roomCode, currentUser, participants) {
  const [audioStreams, setAudioStreams] = useState({}); // { userId: MediaStream }
  const [joinRequests, setJoinRequests] = useState([]); // List of userIds who requested to join
  
  const localStreamRef = useRef(null);
  const peersRef = useRef({}); // { userId: RTCPeerConnection }

  // 1. Handle joining/leaving voice channel
  useEffect(() => {
    if (!currentUser) return;

    if (currentUser.voiceStatus === 'joined' && !localStreamRef.current) {
      startVoice();
    } else if (currentUser.voiceStatus === 'none' && localStreamRef.current) {
      stopVoice();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.voiceStatus]);

  const startVoice = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      
      // Update local muted state based on participant mic state
      stream.getAudioTracks().forEach(track => {
        track.enabled = currentUser.micOn && !currentUser.deafened;
      });

      // Initiate connections to everyone already in the voice channel
      participants.forEach(p => {
        if (p.userId !== currentUser.userId && p.voiceStatus === 'joined') {
          createPeerConnection(p.userId, true);
        }
      });
    } catch (err) {
      console.error("Failed to access microphone:", err);
      // Maybe fallback or show a toast
    }
  };

  const stopVoice = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    Object.values(peersRef.current).forEach(pc => pc.close());
    peersRef.current = {};
    setAudioStreams({});
  };

  const createPeerConnection = (targetUserId, isOfferer) => {
    if (peersRef.current[targetUserId]) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    peersRef.current[targetUserId] = pc;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc_ice_candidate', { targetUserId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      setAudioStreams(prev => ({ ...prev, [targetUserId]: stream }));
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        setAudioStreams(prev => {
          const next = { ...prev };
          delete next[targetUserId];
          return next;
        });
        delete peersRef.current[targetUserId];
      }
    };

    if (isOfferer) {
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          socket.emit('webrtc_offer', { targetUserId, offer: pc.localDescription });
        })
        .catch(console.error);
    }

    return pc;
  };

  // 2. Listen to Socket WebRTC Signaling
  useEffect(() => {
    const handleOffer = async ({ senderId, offer }) => {
      let pc = peersRef.current[senderId];
      if (!pc) pc = createPeerConnection(senderId, false);
      
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('webrtc_answer', { targetUserId: senderId, answer: pc.localDescription });
    };

    const handleAnswer = async ({ senderId, answer }) => {
      const pc = peersRef.current[senderId];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    };

    const handleIceCandidate = async ({ senderId, candidate }) => {
      const pc = peersRef.current[senderId];
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    };

    // Voice channel requests (Host only)
    const handleVoiceJoinRequest = ({ userId }) => {
      setJoinRequests(prev => {
        if (!prev.includes(userId)) return [...prev, userId];
        return prev;
      });
    };

    socket.on('webrtc_offer', handleOffer);
    socket.on('webrtc_answer', handleAnswer);
    socket.on('webrtc_ice_candidate', handleIceCandidate);
    socket.on('voice_join_request', handleVoiceJoinRequest);

    return () => {
      socket.off('webrtc_offer', handleOffer);
      socket.off('webrtc_answer', handleAnswer);
      socket.off('webrtc_ice_candidate', handleIceCandidate);
      socket.off('voice_join_request', handleVoiceJoinRequest);
    };
  }, []);

  // 3. React to mute/deafen state changes locally
  useEffect(() => {
    if (localStreamRef.current && currentUser) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = currentUser.micOn && !currentUser.deafened;
      });
    }
  }, [currentUser?.micOn, currentUser?.deafened]);

  // Actions
  const toggleMute = () => {
    if (!currentUser) return;
    socket.emit('audio_status_update', { micOn: !currentUser.micOn, deafened: currentUser.deafened });
  };

  const toggleDeafen = () => {
    if (!currentUser) return;
    // Deafening should optionally also mute the mic for others like Discord
    const newDeafened = !currentUser.deafened;
    // if deafening, mic is turned off. if undeafening, we leave mic off or restore previous. 
    // let's just send the state
    socket.emit('audio_status_update', { micOn: currentUser.micOn, deafened: newDeafened });
  };

  const requestVoice = () => {
    socket.emit('voice_request_join');
  };

  const leaveVoice = () => {
    socket.emit('voice_leave');
  };

  const admitUser = (userId) => {
    socket.emit('voice_admit', { targetUserId: userId });
    setJoinRequests(prev => prev.filter(id => id !== userId));
  };

  const denyUser = (userId) => {
    socket.emit('voice_deny', { targetUserId: userId });
    setJoinRequests(prev => prev.filter(id => id !== userId));
  };

  const muteUser = (userId) => {
    socket.emit('host_mute_user', { targetUserId: userId });
  };

  const [speakingUsers, setSpeakingUsers] = useState(new Set());

  // 4. Voice Activity Detection
  useEffect(() => {
    let audioContext;
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('AudioContext not supported');
      return;
    }

    const analysers = {};
    const dataArrays = {};
    let animationFrameId;

    const setupVAD = (userId, stream) => {
      if (!stream || stream.getAudioTracks().length === 0) return;
      try {
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        
        analysers[userId] = analyser;
        dataArrays[userId] = new Uint8Array(analyser.frequencyBinCount);
      } catch (e) {
        console.error("VAD Setup Error:", e);
      }
    };

    const checkVolume = () => {
      setSpeakingUsers(prev => {
        const next = new Set(prev);
        let changed = false;

        const checkStream = (userId, stream, isLocal) => {
          if (!stream) return;
          if (!analysers[userId]) setupVAD(userId, stream);
          const analyser = analysers[userId];
          if (analyser) {
            const dataArray = dataArrays[userId];
            analyser.getByteFrequencyData(dataArray);
            const sum = dataArray.reduce((a, b) => a + b, 0);
            const average = sum / dataArray.length;
            
            // local user needs a slightly higher threshold or different handling sometimes, but 10 is usually okay.
            const isSpeaking = average > 10 && (!isLocal || (currentUser?.micOn && !currentUser?.deafened));
            
            if (isSpeaking && !next.has(userId)) {
              next.add(userId);
              changed = true;
            } else if (!isSpeaking && next.has(userId)) {
              next.delete(userId);
              changed = true;
            }
          }
        };

        if (currentUser?.voiceStatus === 'joined' && localStreamRef.current) {
          checkStream(currentUser.userId, localStreamRef.current, true);
        }

        Object.entries(audioStreams).forEach(([userId, stream]) => {
          checkStream(userId, stream, false);
        });

        return changed ? next : prev;
      });

      animationFrameId = requestAnimationFrame(checkVolume);
    };

    if (currentUser?.voiceStatus === 'joined') {
      audioContext.resume();
      checkVolume();
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (audioContext.state !== 'closed') {
        audioContext.close();
      }
    };
  }, [audioStreams, currentUser?.voiceStatus, currentUser?.micOn, currentUser?.deafened]);

  return {
    audioStreams,
    joinRequests,
    speakingUsers,
    toggleMute,
    toggleDeafen,
    requestVoice,
    leaveVoice,
    admitUser,
    denyUser,
    muteUser
  };
}
