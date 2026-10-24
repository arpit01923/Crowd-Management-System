import { io, Socket } from "socket.io-client";
import { BACKEND, getSiteId, getToken } from "./api";

let socket: Socket | null = null;

export const getSocket = () => {
  if (!socket) {
    const token = getToken();
    const siteId = getSiteId();
    socket = io(BACKEND, {
      transports: ["websocket", "polling"],
      auth: { token, siteId },
      query: { token: token || "", siteId: siteId || "" },
    });
  }
  return socket;
};

export const closeSocket = () => {
  socket?.disconnect();
  socket = null;
};
