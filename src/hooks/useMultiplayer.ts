import { useState, useCallback } from 'react';
import usePartySocket from 'partysocket/react';
import { gameStore } from '../store';
import { generateTrackCurve } from '../utils/trackGenerator';

export interface Player {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  color?: string;
  name?: string;
}

const PARTY_HOST = "trackval-obby.iamtakeo.partykit.dev";
const ROOM_ID = "trackval-global"; // For a global room

export function useMultiplayer() {
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [isConnected, setIsConnected] = useState(false);

  const socket = usePartySocket({
    host: PARTY_HOST,
    room: ROOM_ID,
    onOpen() {
      setIsConnected(true);
    },
    onMessage(event) {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'sync':
            setPlayers(data.players);
            gameStore.setConnectedPlayers(data.players);
            if (data.globalTrackDNA) {
              gameStore.setTrackData(generateTrackCurve({ dna: data.globalTrackDNA }));
            }
            if (data.globalCarParams) {
              gameStore.setCarParameters(data.globalCarParams);
            }
            break;
          case 'setTrack':
            if (data.dna) {
               gameStore.setTrackData(generateTrackCurve({ dna: data.dna }));
            }
            break;
          case 'setParams':
            if (data.params) {
               gameStore.setCarParameters(data.params);
            }
            break;
          case 'join':
            setPlayers((prev) => {
              const newPlayers = { ...prev, [data.player.id]: data.player };
              gameStore.setConnectedPlayers(newPlayers);
              return newPlayers;
            });
            break;
          case 'update':
            setPlayers((prev) => {
              const player = prev[data.id];
              if (!player) return prev;
              
              const newPlayers = {
                ...prev,
                [data.id]: {
                  ...player,
                  position: data.position || player.position,
                  rotation: data.rotation || player.rotation,
                  color: data.color || player.color,
                  name: data.name || player.name
                }
              };
              gameStore.setConnectedPlayers(newPlayers);
              return newPlayers;
            });
            break;
          case 'leave':
            setPlayers((prev) => {
              const newPlayers = { ...prev };
              delete newPlayers[data.id];
              gameStore.setConnectedPlayers(newPlayers);
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
        name: gameStore.getPlayerName(),
        ...stateUpdate
      }));
    }
  }, [socket]);

  const broadcastTrack = useCallback((dna: any) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'setTrack',
        dna
      }));
    }
  }, [socket]);

  const broadcastParams = useCallback((params: any) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'setParams',
        params
      }));
    }
  }, [socket]);

  return {
    players,
    updateMyState,
    broadcastTrack,
    broadcastParams,
    isConnected,
    socket
  };
}
