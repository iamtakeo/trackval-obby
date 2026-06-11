import { useState, useCallback, useEffect, useSyncExternalStore } from 'react';
import usePartySocket from 'partysocket/react';
import { gameStore } from '../store';
import { generateTrackCurve } from '../utils/trackGenerator';

import type { CarAppearance } from '../store';

export interface Player {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  color?: string;
  name?: string;
  appearance?: CarAppearance;
  isSpectating?: boolean;
}

const PARTY_HOST = "trackval-obby.iamtakeo.partykit.dev";
const ROOM_ID = "trackval-global"; // For a global room

export function useMultiplayer() {
  const players = useSyncExternalStore(gameStore.subscribe, gameStore.getConnectedPlayers);
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
            gameStore.setConnectedPlayers(data.players);
            if (data.globalTrackDNA) {
              gameStore.setTrackData(generateTrackCurve({ dna: data.globalTrackDNA }));
            }
            if (data.globalRamps) {
              gameStore.setRamps(data.globalRamps);
            }
            if (data.globalCarParams) {
              gameStore.setCarParameters(data.globalCarParams);
            }
            break;
          case 'setTrack':
            if (data.dna) {
               gameStore.setTrackData(generateTrackCurve({ dna: data.dna }));
            }
            if (data.ramps) {
               gameStore.setRamps(data.ramps);
            }
            break;
          case 'setParams':
            if (data.params) {
               gameStore.setCarParameters(data.params);
            }
            break;
          case 'join': {
            const currentPlayers = gameStore.getConnectedPlayers();
            gameStore.setConnectedPlayers({ ...currentPlayers, [data.player.id]: data.player });
            break;
          }
          case 'update': {
            const currentPlayers = gameStore.getConnectedPlayers();
            const player = currentPlayers[data.id];
            if (!player) break;
            
            gameStore.setConnectedPlayers({
              ...currentPlayers,
              [data.id]: {
                ...player,
                position: data.position || player.position,
                rotation: data.rotation || player.rotation,
                color: data.color || player.color,
                name: data.name || player.name,
                appearance: data.appearance || player.appearance,
                isSpectating: data.isSpectating !== undefined ? data.isSpectating : player.isSpectating
              }
            });
            break;
          }
          case 'leave': {
            const currentPlayers = gameStore.getConnectedPlayers();
            const newPlayers = { ...currentPlayers };
            delete newPlayers[data.id];
            gameStore.setConnectedPlayers(newPlayers);
            break;
          }
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

  const broadcastTrack = useCallback((dna: any, ramps: any) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'setTrack',
        dna,
        ramps
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

  const broadcastAppearance = useCallback((appearance: CarAppearance) => {
    if (socket) {
      socket.send(JSON.stringify({
        type: 'update',
        appearance
      }));
    }
  }, [socket]);

  // Sync appearance whenever it changes locally
  const localAppearance = gameStore.getCarAppearance();
  useEffect(() => {
    if (isConnected) {
      broadcastAppearance(localAppearance);
    }
  }, [localAppearance, isConnected, broadcastAppearance]);

  return {
    players,
    updateMyState,
    broadcastTrack,
    broadcastParams,
    broadcastAppearance,
    isConnected,
    socket,
    socketId: socket?.id
  };
}
