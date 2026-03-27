"use client";

import { useEffect, useState } from "react";
import { cloneDeep } from "lodash";
import { useParams } from "next/navigation";

import { useSocket } from "@/store/socket";
import usePeer from "@/hooks/use-peer";
import useMediaStream from "@/hooks/use-media-stream";
import usePlayer from "@/hooks/use-player";
import useChat from "@/hooks/use-chat";

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

  const [users, setUsers] = useState({});

  const {
    messages,
    connectedPeers,
    isConnected: isChatConnected,
    sendMessage,
    cleanupPeerDataChannel,
  } = useChat(peer, myId, users);

  // add my stream
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

  // user connect
  useEffect(() => {
    if (!socket || !peer || !stream) return;

    const handleUserConnected = (userId) => {
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

        setUsers((prev) => ({
          ...prev,
          [userId]: call,
        }));
      });

      call.on("close", () => {
        setPlayers((prev) => {
          const copy = cloneDeep(prev);
          delete copy[userId];
          return copy;
        });
      });
    };

    socket.on("user-connected", handleUserConnected);

    return () => {
      socket.off("user-connected", handleUserConnected);
    };
  }, [socket, peer, stream, setPlayers]);

  // receive call
  useEffect(() => {
    if (!peer || !stream) return;

    peer.on("call", (call) => {
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

        setUsers((prev) => ({
          ...prev,
          [callerId]: call,
        }));
      });
    });
  }, [peer, stream, setPlayers]);

  // user leave
  useEffect(() => {
    if (!socket) return;

    const handleUserLeave = (userId) => {
      cleanupPeerDataChannel(userId);

      if (users[userId]) users[userId].close();

      setPlayers((prev) => {
        const copy = cloneDeep(prev);
        delete copy[userId];
        return copy;
      });
    };

    socket.on("user-leave", handleUserLeave);

    return () => {
      socket.off("user-leave", handleUserLeave);
    };
  }, [socket, users, cleanupPeerDataChannel, setPlayers]);

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
        {/* CONTAINER DI PAKSA MULAI DARI ATAS */}
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

                <div
                  className={`text-xs px-3 py-1 rounded-full ${
                    players[id]?.audioEnabled
                      ? "bg-green-500/20 text-green-500"
                      : "bg-red-500/20 text-red-500"
                  }`}
                >
                  {players[id]?.audioEnabled ? "Mic On" : "Muted"}
                </div>

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