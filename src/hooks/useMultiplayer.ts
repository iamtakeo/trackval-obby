import { useState, useCallback } from 'react';
import usePartySocket from 'partysocket/react';

export interface Player {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  color?: string;
  name?: string;
}

const PARTY_HOST = typeof window !== "undefined" && window.location.hostname === "localhost" ? "127.0.0.1:1999" : "trackval-obby.iamtakeo.partykit.dev";
const ROOM_ID = "trackval-global"; // For a global room

export function useMultiplayer() {
  const [players, setPlayers] = useState<Record<string, Player>>({});

  const socket = usePartySocket({
    host: PARTY_HOST,
    room: ROOM_ID,
    onMessage(event) {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'sync':
            setPlayers(data.players);
            break;
          case 'join':
            setPlayers((prev) => ({
              ...prev,
              [data.player.id]: data.player
            }));
            break;
          case 'update':
            setPlayers((prev) => {
              const player = prev[data.id];
              if (!player) return prev;
              
              return {
                ...prev,
                [data.id]: {
                  ...player,
                  position: data.position || player.position,
                  rotation: data.rotation || player.rotation,
                  color: data.color || player.color,
                  name: data.name || player.name
                }
              };
            });
            break;
          case 'leave':
            setPlayers((prev) => {
              const newPlayers = { ...prev };
              delete newPlayers[data.id];
              return newPlayers;
            });
            break;
        }
      } catch (err) {
        console.error("Failed to parse partykit message", err);
      }
    }
  });

  const updateMyState = useCallback((stateUpdate: Partial<Player>) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'update',
        ...stateUpdate
      }));
    }
  }, [socket]);

  return {
    players,
    updateMyState,
    socket
  };
}
