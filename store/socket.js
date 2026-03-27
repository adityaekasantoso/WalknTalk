import { createContext, useContext, useEffect, useState, useRef } from "react";

const SocketContext = createContext(null);

export const useSocket = () => {
  const socket = useContext(SocketContext);
  return socket;
};

// API-based socket implementation (VOICE ONLY - tanpa video)
class APISocket {
  constructor() {
    this.sessionId = null;
    this.roomId = null;
    this.userId = null;
    this.listeners = new Map();
    this.pollingInterval = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.connectionStatus = "disconnected";
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.lastKnownUsers = [];
  }

  // ================================
  // EMIT EVENT
  // ================================
  async emit(event, ...args) {
    try {
      const baseUrl =
        typeof window !== "undefined"
          ? window.location.origin
          : "http://localhost:3000";

      switch (event) {
        // JOIN ROOM
        case "join-room": {
          const [roomId, userId] = args;

          this.roomId = roomId;
          this.userId = userId;

          this.isConnecting = true;
          this.connectionStatus = "connecting";
          this.trigger("connecting");

          const response = await fetch(
            `${baseUrl}/api/socket?action=join-room&roomId=${roomId}&userId=${userId}`
          );

          const data = await response.json();

          if (data.success) {
            this.sessionId = data.sessionId;
            this.isConnected = true;
            this.isConnecting = false;
            this.connectionStatus = "connected";
            this.reconnectAttempts = 0;

            this.startPolling();

            this.trigger("connect");
            this.trigger("joined-room", roomId);

            // Kirim event user yang sudah ada
            if (data.roomUsers) {
              data.roomUsers.forEach((id) => {
                if (id !== this.userId) {
                  this.trigger("user-connected", id);
                }
              });
            }
          } else {
            this.isConnecting = false;
            this.connectionStatus = "error";
            this.trigger(
              "connect_error",
              new Error(data.error || "Failed to join room")
            );
          }

          break;
        }

        // AUDIO ONLY
        case "user-toggle-audio": {
          const [userId, roomId] = args;

          await this.makeAPICall("toggle-audio", {
            roomId,
            userId,
          });

          break;
        }

        // USER LEAVE
        case "user-leave": {
          const [userId, roomId] = args;

          await this.makeAPICall("leave-room", {
            roomId,
            userId,
          });

          break;
        }
      }
    } catch (error) {
      console.error("❌ Socket emit error:", error);
      this.trigger("connect_error", error);
    }
  }

  // ================================
  // API CALL HELPER
  // ================================
  async makeAPICall(action, data) {
    const baseUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost:3000";

    const response = await fetch(`${baseUrl}/api/socket`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, ...data }),
    });

    return response.json();
  }

  // ================================
  // POLLING ROOM USERS
  // ================================
  startPolling() {
    if (this.pollingInterval) return;

    this.pollingInterval = setInterval(async () => {
      if (!this.sessionId || !this.roomId) return;

      try {
        // ping biar session tidak mati
        await this.makeAPICall("ping", {
          sessionId: this.sessionId,
        });

        const baseUrl =
          typeof window !== "undefined"
            ? window.location.origin
            : "http://localhost:3000";

        const response = await fetch(
          `${baseUrl}/api/socket?action=get-room-users&roomId=${this.roomId}`
        );

        const data = await response.json();

        if (data.users) {
          const currentUsers = new Set(data.users);
          const previousUsers = new Set(this.lastKnownUsers);

          // user baru masuk
          currentUsers.forEach((id) => {
            if (!previousUsers.has(id) && id !== this.userId) {
              this.trigger("user-connected", id);
            }
          });

          // user keluar
          previousUsers.forEach((id) => {
            if (!currentUsers.has(id) && id !== this.userId) {
              this.trigger("user-leave", id);
            }
          });

          this.lastKnownUsers = data.users;
        }
      } catch (error) {
        console.error("❌ Polling error:", error);
        this.handleReconnect();
      }
    }, 2000);
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  // ================================
  // RECONNECT LOGIC
  // ================================
  handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("❌ Max reconnection attempts reached");
      this.connectionStatus = "error";
      this.trigger("reconnect_failed");
      return;
    }

    this.reconnectAttempts++;
    this.isConnected = false;
    this.connectionStatus = "connecting";

    this.trigger("reconnect_attempt", this.reconnectAttempts);

    setTimeout(() => {
      if (this.roomId && this.userId) {
        this.emit("join-room", this.roomId, this.userId);
      }
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  // ================================
  // EVENT HANDLER
  // ================================
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  trigger(event, ...args) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach((callback) => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in ${event} callback:`, error);
        }
      });
    }
  }

  // ================================
  // DISCONNECT
  // ================================
  disconnect() {
    this.stopPolling();
    this.isConnected = false;
    this.isConnecting = false;
    this.connectionStatus = "disconnected";

    this.trigger("disconnect", "manual");

    if (this.roomId && this.userId) {
      this.makeAPICall("leave-room", {
        roomId: this.roomId,
        userId: this.userId,
      });
    }
  }
}

// ================================
// SOCKET PROVIDER
// ================================
export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    console.log("🔄 Initializing API-based voice socket...");

    const apiSocket = new APISocket();
    socketRef.current = apiSocket;
    setSocket(apiSocket);

    apiSocket.on("connecting", () => {
      console.log("🔄 Connecting...");
    });

    apiSocket.on("connect", () => {
      console.log("✅ Connected");
    });

    apiSocket.on("disconnect", (reason) => {
      console.log("❌ Disconnected:", reason);
    });

    apiSocket.on("reconnect_attempt", (attempt) => {
      console.log("🔄 Reconnect attempt:", attempt);
    });

    apiSocket.on("reconnect_failed", () => {
      console.error("❌ Reconnect failed");
    });

    apiSocket.on("connect_error", (error) => {
      console.error("❌ Connection error:", error.message);
    });

    return () => {
      if (socketRef.current) {
        console.log("🧹 Cleaning socket...");
        socketRef.current.disconnect();
      }
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
};