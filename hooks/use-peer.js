import { useSocket } from "@/store/socket";
import { useParams } from "next/navigation";

const { useState, useEffect, useRef } = require("react");

const usePeer = () => {
  const socket = useSocket();
  const { roomId } = useParams();

  const [peer, setPeer] = useState(null);
  const [myId, setMyId] = useState("");

  const isPeerSet = useRef(false);

  useEffect(() => {
    if (isPeerSet.current || !roomId || !socket) return;
    isPeerSet.current = true;

    let myPeer;

    const initPeer = async () => {
      try {
        console.log("Initializing PeerJS...");

        const Peer = (await import("peerjs")).default;

        myPeer = new Peer({
          config: {
            iceServers: [
              { urls: "stun:stun.l.google.com:19302" },
              { urls: "stun:stun1.l.google.com:19302" },
              { urls: "stun:stun2.l.google.com:19302" },
              { urls: "stun:stun3.l.google.com:19302" },
              { urls: "stun:stun4.l.google.com:19302" },
              { urls: "stun:stun.ekiga.net" },
              { urls: "stun:stun.ideasip.com" },
            ],
            sdpSemantics: "unified-plan",
            iceCandidatePoolSize: 10,
          },
          debug: process.env.NODE_ENV === "development" ? 2 : 0,
        });

        setPeer(myPeer);

        myPeer.on("open", (id) => {
          console.log("Peer connected:", id);
          setMyId(id);

          socket.emit("join-room", roomId, id);
        });

        myPeer.on("error", (error) => {
          console.error("PeerJS error:", error);
        });

        myPeer.on("disconnected", () => {
          console.log("Peer disconnected, reconnecting...");
          if (!myPeer.destroyed) {
            myPeer.reconnect();
          }
        });
      } catch (error) {
        console.error("Failed to initialize PeerJS:", error);
        isPeerSet.current = false;
      }
    };

    initPeer();

    return () => {
      if (myPeer && !myPeer.destroyed) {
        myPeer.destroy();
      }
    };
  }, [roomId, socket]);

  return {
    peer,
    myId,
  };
};

export default usePeer;