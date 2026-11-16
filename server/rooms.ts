import { randomUUID } from 'node:crypto';
import type { Player } from '../shared/types.ts';
import type { SpotId } from '../shared/content.ts';
import { boatAt, launchPosition } from '../shared/navigation.ts';
import { fisherActivity, ROOM_CAPACITY, RECONNECT_GRACE_MS } from '../shared/multiplayer.ts';
import type { Fisher, RoomSnapshot } from '../shared/multiplayer.ts';

export type RoomClient = { send: (event: string, value: unknown) => boolean; close: () => void };
type Peer = { id: string; player: Player; roomId: string | null; slot: number; clients: Set<RoomClient>; disconnectedAt: number | null };
type Room = { id: string; spot: SpotId; sessions: Set<string> };

export class FishingRooms {
  private peers = new Map<string, Peer>();
  private rooms = new Map<string, Room>();
  private dirty = new Set<string>();

  connections(session: string) { return this.peers.get(session)?.clients.size ?? 0; }

  update(session: string, player: Player, now: number, spawn = false) {
    let peer = this.peers.get(session);
    if (!peer) {
      if (!player.trip) return;
      peer = { id: randomUUID(), player, roomId: null, slot: 0, clients: new Set(), disconnectedAt: now };
      this.peers.set(session, peer);
    }
    peer.player = player;
    const trip = player.trip;
    if (peer.roomId && (!trip || this.rooms.get(peer.roomId)?.spot !== trip.spot)) this.leave(peer, session);
    if (trip && !peer.roomId) {
      let room = [...this.rooms.values()].find(room => room.spot === trip.spot && room.sessions.size < ROOM_CAPACITY);
      if (!room) {
        room = { id: randomUUID(), spot: trip.spot, sessions: new Set() };
        this.rooms.set(room.id, room);
      }
      const slots = new Set([...room.sessions].map(id => this.peers.get(id)!.slot));
      peer.slot = 0;
      while (slots.has(peer.slot)) peer.slot++;
      room.sessions.add(session);
      peer.roomId = room.id;
    }
    if (trip && spawn) {
      const launch = launchPosition(trip.spot);
      const side = launch.x > .5 ? -1 : 1;
      trip.boat = { x: launch.x + side * (peer.slot % 4) * .15, y: launch.y - Math.floor(peer.slot / 4) * .19 };
    }
    if (peer.roomId) this.dirty.add(peer.roomId);
  }

  connect(session: string, player: Player, client: RoomClient, now: number) {
    if (!this.peers.has(session)) this.peers.set(session, {
      id: randomUUID(), player, roomId: null, slot: 0, clients: new Set(), disconnectedAt: now,
    });
    this.update(session, player, now);
    const peer = this.peers.get(session)!;
    peer.clients.add(client);
    peer.disconnectedAt = null;
    this.deliver(session, peer, client, 'state', { player, serverNow: now }, now);
    if (peer.roomId) this.dirty.add(peer.roomId);
    this.flush(now);
  }

  disconnect(session: string, client: RoomClient, now: number) {
    const peer = this.peers.get(session);
    if (!peer || !peer.clients.delete(client)) return;
    if (!peer.clients.size) peer.disconnectedAt = now;
    if (peer.roomId) this.dirty.add(peer.roomId);
  }

  private leave(peer: Peer, session: string) {
    const room = peer.roomId ? this.rooms.get(peer.roomId) : null;
    if (room) {
      room.sessions.delete(session);
      if (!room.sessions.size) this.rooms.delete(room.id);
      else this.dirty.add(room.id);
    }
    peer.roomId = null;
  }

  // Called only for persisted changes; idle rooms cause no SQLite writes.
  saved(session: string, player: Player, now: number) {
    this.update(session, player, now);
    const peer = this.peers.get(session);
    if (!peer) return;
    for (const client of peer.clients) this.deliver(session, peer, client, 'state', { player, serverNow: now }, now);
  }

  snapshot(session: string, now: number): RoomSnapshot | null {
    const self = this.peers.get(session);
    const room = self?.roomId ? this.rooms.get(self.roomId) : null;
    if (!self || !room) return null;
    const fishers: Fisher[] = [...room.sessions].map(id => {
      const peer = this.peers.get(id)!;
      const trip = peer.player.trip!;
      return {
        id: peer.id, nickname: peer.player.nickname, appearance: peer.player.appearance!, connected: peer.clients.size > 0,
        spot: trip.spot, boat: boatAt(trip, now), heading: trip.heading ?? -Math.PI / 4,
        voyage: trip.voyage ?? null, bait: trip.bait,
        bite: trip.bite ? { zone: trip.bite.zone, opensAt: trip.bite.opensAt, closesAt: trip.bite.closesAt, position: trip.bite.position } : null,
        fightZone: trip.battle?.zone ?? null, activity: fisherActivity(trip, now),
      };
    });
    return { roomId: room.id, spot: room.spot, capacity: ROOM_CAPACITY, selfId: self.id, serverNow: now, fishers };
  }

  tick(now: number, advance: (session: string, player: Player) => void) {
    for (const [session, peer] of this.peers) {
      if (peer.disconnectedAt !== null && now - peer.disconnectedAt >= RECONNECT_GRACE_MS) {
        this.leave(peer, session);
        this.peers.delete(session);
      } else if (peer.player.trip) advance(session, peer.player);
    }
    this.flush(now);
  }

  flush(now: number) {
    const rooms = [...this.dirty];
    this.dirty.clear();
    for (const id of rooms) {
      const room = this.rooms.get(id);
      if (!room) continue;
      for (const session of room.sessions) {
        const peer = this.peers.get(session)!;
        const snapshot = this.snapshot(session, now);
        for (const client of peer.clients) this.deliver(session, peer, client, 'room', snapshot, now);
      }
    }
  }

  heartbeat(now: number) {
    for (const [session, peer] of this.peers) for (const client of peer.clients) {
      this.deliver(session, peer, client, 'heartbeat', { serverNow: now }, now);
    }
  }

  private deliver(session: string, peer: Peer, client: RoomClient, event: string, value: unknown, now: number) {
    if (!client.send(event, value)) {
      this.disconnect(session, client, now);
      client.close();
    }
  }
}
