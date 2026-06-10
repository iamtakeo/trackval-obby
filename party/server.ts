import type * as Party from "partykit/server";

export interface Player {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  color?: string;
  name?: string;
}

export default class TrackvalServer implements Party.Server {
  players: Map<string, Player>;
  globalTrackDNA: any | null = null;
  globalCarParams: any | null = null;

  constructor(readonly room: Party.Room) {
    this.players = new Map();
  }

  onConnect(conn: Party.Connection) {
    console.log(`Connected: ${conn.id} to room: ${this.room.id}`);
    
    // Initialize player state
    const newPlayer: Player = {
      id: conn.id,
      position: [0, 0, 0],
      rotation: [0, 0, 0]
    };
    this.players.set(conn.id, newPlayer);

    // Safely convert Map to Object for JSON serialization
    const playersObj: Record<string, Player> = {};
    for (const [key, val] of this.players.entries()) {
      playersObj[key] = val;
    }

    // Send current state of all players and the global world state
    conn.send(JSON.stringify({
      type: "sync",
      players: playersObj,
      globalTrackDNA: this.globalTrackDNA,
      globalCarParams: this.globalCarParams
    }));
    
    // Notify others
    this.room.broadcast(JSON.stringify({
      type: "join",
      player: newPlayer
    }), [conn.id]);
  }

  onMessage(message: string, sender: Party.Connection) {
    try {
      const data = JSON.parse(message);
      
      if (data.type === "setTrack") {
        this.globalTrackDNA = data.dna;
        this.room.broadcast(JSON.stringify({
          type: "setTrack",
          dna: data.dna
        }), [sender.id]); // broadcast to everyone else
      }
      else if (data.type === "setParams") {
        this.globalCarParams = data.params;
        this.room.broadcast(JSON.stringify({
          type: "setParams",
          params: data.params
        }), [sender.id]); // broadcast to everyone else
      }
      else if (data.type === "update") {
        const player = this.players.get(sender.id);
        if (player) {
          if (data.position) player.position = data.position;
          if (data.rotation) player.rotation = data.rotation;
          if (data.color) player.color = data.color;
          if (data.name) player.name = data.name;
          
          // Broadcast update
          this.room.broadcast(JSON.stringify({
            type: "update",
            id: sender.id,
            ...data
          }), [sender.id]);
        }
      }
    } catch (e) {
      console.error("Error parsing message", e);
    }
  }

  onClose(conn: Party.Connection) {
    console.log(`Disconnected: ${conn.id} from room: ${this.room.id}`);
    this.players.delete(conn.id);
    
    this.room.broadcast(JSON.stringify({
      type: "leave",
      id: conn.id
    }));
  }
}
