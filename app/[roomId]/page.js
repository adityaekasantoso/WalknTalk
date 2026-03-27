"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSocket } from "@/store/socket";
import usePeer from "@/hooks/use-peer";
import useMediaStream from "@/hooks/use-media-stream";
import usePlayer from "@/hooks/use-player";
import CopySection from "@/components/copy-section";
import SimpleCallLayout from "@/components/ui/simple-call-layout";
import FloatingControls from "@/components/ui/floating-controls";
import PermissionRequest from "@/components/ui/permission-request";

import { User } from "lucide-react";

const Room = () => {
  const socket = useSocket();
  const { roomId } = useParams();

  const { peer, myId } = usePeer();

  const {
    stream,
    isAudioEnabled,
    toggleAudio: toggleStreamAudio,
    error: mediaError,
    permissions,
  } = useMediaStream();

  const {
    players,
    setPlayers,
    toggleAudio,
    leaveRoom,
  } = usePlayer(myId, roomId, peer, {
    toggleAudio: toggleStreamAudio,
    isAudioEnabled,
  });

  const [calls, setCalls] = useState({}); // simpan semua PeerJS call

  // add my stream ke players
  useEffect(() => {
    if (!myId || !stream) return;

    setPlayers((prev) => ({
      ...prev,
      [myId]: {
        url: stream,
        muted: true,
        audioEnabled: isAudioEnabled,
      },
    }));
  }, [myId, stream, isAudioEnabled, setPlayers]);

  // join room
  useEffect(() => {
    if (!socket || !myId || !roomId) return;
    socket.emit("join-room", roomId, myId);
  }, [socket, myId, roomId]);

  // handle user connected
  useEffect(() => {
    if (!socket || !peer || !stream) return;

    const handleUserConnected = (userId) => {
      if (userId === myId) return;

      const call = peer.call(userId, stream);

      call.on("stream", (incomingStream) => {
        setPlayers((prev) => ({
          ...prev,
          [userId]: {
            url: incomingStream,
            muted: false,
            audioEnabled: true,
          },
        }));
      });

      call.on("close", () => removePeer(userId));
      call.on("error", () => removePeer(userId));

      setCalls((prev) => ({ ...prev, [userId]: call }));
    };

    socket.on("user-connected", handleUserConnected);

    return () => {
      socket.off("user-connected", handleUserConnected);
    };
  }, [socket, peer, stream, myId, setPlayers]);

  // receive call dari peer lain
  useEffect(() => {
    if (!peer || !stream) return;

    const handleCall = (call) => {
      const callerId = call.peer;

      call.answer(stream);

      call.on("stream", (incomingStream) => {
        setPlayers((prev) => ({
          ...prev,
          [callerId]: {
            url: incomingStream,
            muted: false,
            audioEnabled: true,
          },
        }));
      });

      call.on("close", () => removePeer(callerId));
      call.on("error", () => removePeer(callerId));

      setCalls((prev) => ({ ...prev, [callerId]: call }));
    };

    peer.on("call", handleCall);

    return () => {
      peer.off("call", handleCall);
    };
  }, [peer, stream, setPlayers]);

  // handle user leave dari socket
  useEffect(() => {
    if (!socket) return;

    const handleUserLeave = (userId) => {
      removePeer(userId);
    };

    socket.on("user-leave", handleUserLeave);
    return () => socket.off("user-leave", handleUserLeave);
  }, [socket]);

  // function untuk hapus peer + call
  const removePeer = (peerId) => {
    setPlayers((prev) => {
      const copy = { ...prev };
      delete copy[peerId];
      return copy;
    });

    setCalls((prev) => {
      if (prev[peerId]) prev[peerId].close();
      const copy = { ...prev };
      delete copy[peerId];
      return copy;
    });
  };

  // heartbeat: cek peer connectionState tiap 3 detik
  useEffect(() => {
    const interval = setInterval(() => {
      Object.keys(calls).forEach((peerId) => {
        const call = calls[peerId];
        if (!call || call.peerConnection?.connectionState === "closed" || call.peerConnection?.connectionState === "disconnected") {
          removePeer(peerId);
        }
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [calls]);

  return (
    <>
      {(mediaError || !permissions.audio) && (
        <PermissionRequest
          error={mediaError}
          permissions={permissions}
          onRetry={() => window.location.reload()}
        />
      )}

      <SimpleCallLayout
        roomId={roomId}
        participants={Object.keys(players)}
        onShare={() => navigator.clipboard.writeText(window.location.href)}
      >
        <div className="h-full overflow-y-auto pt-2 px-8 pb-8 flex flex-col justify-start">
          {/* GRID USER */}
          <div className="grid gap-6 grid-cols-[repeat(auto-fill,minmax(160px,1fr))] items-start">
            {Object.keys(players).map((id) => (
              <div
                key={id}
                className="flex flex-col items-center gap-4 bg-card border rounded-2xl p-6 shadow-sm hover:shadow-md transition"
              >
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                  <User className="w-10 h-10 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-center">
                  {id === myId ? "You" : "User"}
                </p>
                <audio
                  ref={(audio) => {
                    if (audio && players[id]?.url) {
                      audio.srcObject = players[id].url;
                    }
                  }}
                  autoPlay
                  muted={players[id]?.muted}
                />
              </div>
            ))}
          </div>

          <div className="hidden">
            <CopySection roomId={roomId} />
          </div>
        </div>

        {/* CONTROLS */}
        {myId && socket && (
          <FloatingControls
            muted={!isAudioEnabled}
            toggleAudio={toggleAudio}
            leaveRoom={leaveRoom}
          />
        )}
      </SimpleCallLayout>
    </>
  );
};

export default Room;