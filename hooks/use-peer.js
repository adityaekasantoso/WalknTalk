import { useState, useEffect, useRef } from "react";
import { useSocket } from "@/store/socket";
import { useParams } from "next/navigation";
import Peer from "peerjs";

const usePeer = () => {
  const socket = useSocket();
  const { roomId } = useParams();

  const [peer, setPeer] = useState(null);
  const [myId, setMyId] = useState("");
  const isPeerSet = useRef(false);

  useEffect(() => {
    if (isPeerSet.current || !socket || !roomId) return;
    isPeerSet.current = true;

    const uniqueId = `peer-${Math.floor(Math.random() * 100000)}`;
    const myPeer = new Peer(uniqueId, {
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
        ],
        sdpSemantics: "unified-plan",
      },
      debug: process.env.NODE_ENV === "development" ? 2 : 0,
    });

    setPeer(myPeer);

    myPeer.on("open", (id) => {
      console.log("Peer open with ID:", id);
      setMyId(id);
      socket.emit("join-room", roomId, id);
    });

    myPeer.on("error", (err) => console.error("PeerJS error:", err));

    let retryCount = 0;
    myPeer.on("disconnected", () => {
      if (retryCount < 3 && !myPeer.destroyed) {
        console.log("Retry Peer reconnect...");
        setTimeout(() => {
          myPeer.reconnect();
          retryCount++;
        }, 1000);
      }
    });

    return () => {
      if (!myPeer.destroyed) myPeer.destroy();
    };
  }, [socket, roomId]);

  return { peer, myId };
};

export default usePeer;