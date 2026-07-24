import { randomInt } from 'node:crypto';
import type { Server as SocketIOServer, Socket } from 'socket.io';
import { DEFAULT_RULES, type RuleSettings } from '@cheongiwa/engine';
import type { RoomStateView } from '@cheongiwa/protocol';
import type { SessionSeatInit } from './session';

/**
 * 친선방 (PLAN.md §3.2): 6자리 코드, 방장이 룰 설정, 빈자리 봇 채움 후 시작.
 * 연습 모드도 같은 방 구조를 쓴다 (코드 경로 분리 없음).
 */

export interface RoomMember {
  kind: 'human' | 'bot';
  userId: string | null;
  nickname: string;
  socket: Socket | null;
  ready: boolean;
}

export interface Room {
  code: string;
  hostUserId: string;
  members: RoomMember[];
  rules: RuleSettings;
  practice: boolean;
  started: boolean;
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 혼동 문자 제외

const BOT_NAMES = ['달빛', '소나무', '기와', '한지'];

export class RoomManager {
  private readonly io: SocketIOServer;
  private readonly rooms = new Map<string, Room>();
  private readonly byUser = new Map<string, string>();

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  private newCode(): string {
    for (;;) {
      let code = '';
      for (let i = 0; i < 6; i++) code += CODE_CHARS[randomInt(CODE_CHARS.length)];
      if (!this.rooms.has(code)) return code;
    }
  }

  roomOfUser(userId: string): Room | null {
    const code = this.byUser.get(userId);
    return code ? (this.rooms.get(code) ?? null) : null;
  }

  create(
    userId: string,
    nickname: string,
    socket: Socket,
    options: { practice?: boolean } = {},
  ): Room {
    this.leave(userId); // 기존 방 정리
    const room: Room = {
      code: this.newCode(),
      hostUserId: userId,
      members: [{ kind: 'human', userId, nickname, socket, ready: true }],
      rules: { ...DEFAULT_RULES },
      practice: options.practice ?? false,
      started: false,
    };
    this.rooms.set(room.code, room);
    this.byUser.set(userId, room.code);
    void socket.join(`room:${room.code}`);
    this.broadcastState(room);
    return room;
  }

  join(userId: string, nickname: string, socket: Socket, code: string): Room {
    const room = this.rooms.get(code);
    if (!room || room.started) throw new Error('방을 찾을 수 없습니다');
    if (room.members.some((m) => m.userId === userId)) {
      // 같은 유저의 재입장: 소켓 갱신
      const me = room.members.find((m) => m.userId === userId) as RoomMember;
      me.socket = socket;
      void socket.join(`room:${room.code}`);
      this.broadcastState(room);
      return room;
    }
    if (room.members.length >= 4) throw new Error('방이 가득 찼습니다');
    this.leave(userId);
    room.members.push({ kind: 'human', userId, nickname, socket, ready: false });
    this.byUser.set(userId, room.code);
    void socket.join(`room:${room.code}`);
    this.broadcastState(room);
    return room;
  }

  leave(userId: string): void {
    const room = this.roomOfUser(userId);
    if (!room) return;
    const member = room.members.find((m) => m.userId === userId);
    if (member?.socket) void member.socket.leave(`room:${room.code}`);
    room.members = room.members.filter((m) => m.userId !== userId);
    this.byUser.delete(userId);

    const humans = room.members.filter((m) => m.kind === 'human');
    if (humans.length === 0) {
      this.rooms.delete(room.code);
      return;
    }
    if (room.hostUserId === userId) {
      room.hostUserId = (humans[0] as RoomMember).userId as string;
      (humans[0] as RoomMember).ready = true;
    }
    this.broadcastState(room);
  }

  setReady(userId: string, ready: boolean): void {
    const room = this.roomOfUser(userId);
    if (!room) throw new Error('참가 중인 방이 없습니다');
    const me = room.members.find((m) => m.userId === userId);
    if (me) me.ready = ready || room.hostUserId === userId;
    this.broadcastState(room);
  }

  addBot(userId: string): void {
    const room = this.requireHost(userId);
    if (room.members.length >= 4) throw new Error('빈자리가 없습니다');
    const used = room.members.filter((m) => m.kind === 'bot').length;
    room.members.push({
      kind: 'bot',
      userId: null,
      nickname: `${BOT_NAMES[used % BOT_NAMES.length]} 봇`,
      socket: null,
      ready: true,
    });
    this.broadcastState(room);
  }

  setRules(userId: string, rules: RuleSettings): void {
    const room = this.requireHost(userId);
    room.rules = rules;
    this.broadcastState(room);
  }

  /** 시작: 빈자리는 봇으로 채우고 좌석을 무작위 배정해 세션 시드를 만든다 */
  startSeats(userId: string): { room: Room; seats: SessionSeatInit[] } {
    const room = this.requireHost(userId);
    const humans = room.members.filter((m) => m.kind === 'human');
    if (!humans.every((m) => m.ready)) throw new Error('전원이 준비되지 않았습니다');
    while (room.members.length < 4) this.addBotInternal(room);

    // 좌석 무작위 배정 (§3.3 game.start 좌석 배정)
    const shuffled = [...room.members];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      const tmp = shuffled[i] as RoomMember;
      shuffled[i] = shuffled[j] as RoomMember;
      shuffled[j] = tmp;
    }
    room.started = true;
    const seats: SessionSeatInit[] = shuffled.map((m) => ({
      kind: m.kind,
      userId: m.userId,
      nickname: m.nickname,
      socket: m.socket,
    }));
    // 방은 대국 시작과 함께 해산 (재대국은 새 방)
    for (const m of room.members) {
      if (m.userId) this.byUser.delete(m.userId);
      if (m.socket) void m.socket.leave(`room:${room.code}`);
    }
    this.rooms.delete(room.code);
    return { room, seats };
  }

  private addBotInternal(room: Room): void {
    const used = room.members.filter((m) => m.kind === 'bot').length;
    room.members.push({
      kind: 'bot',
      userId: null,
      nickname: `${BOT_NAMES[used % BOT_NAMES.length]} 봇`,
      socket: null,
      ready: true,
    });
  }

  private requireHost(userId: string): Room {
    const room = this.roomOfUser(userId);
    if (!room) throw new Error('참가 중인 방이 없습니다');
    if (room.hostUserId !== userId) throw new Error('방장만 할 수 있습니다');
    return room;
  }

  handleDisconnect(socketId: string): void {
    for (const room of this.rooms.values()) {
      const member = room.members.find((m) => m.socket?.id === socketId);
      if (member?.userId) this.leave(member.userId);
    }
  }

  stateView(room: Room): RoomStateView {
    return {
      code: room.code,
      members: room.members.map((m, slot) => ({
        slot,
        nickname: m.nickname,
        isBot: m.kind === 'bot',
        ready: m.ready,
        connected: m.kind === 'bot' || m.socket !== null,
        isHost: m.userId !== null && m.userId === room.hostUserId,
      })),
      rules: room.rules,
      practice: room.practice,
    };
  }

  private broadcastState(room: Room): void {
    this.io.to(`room:${room.code}`).emit('room.state', this.stateView(room));
  }
}
