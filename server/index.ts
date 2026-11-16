import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomInt, randomUUID } from 'node:crypto';
import { createReadStream, mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { baits, cards, spots, upgrades } from '../shared/content.ts';
import { advancePlayer, applyAction, newPlayer, RuleError } from '../shared/game.ts';
import type { Action, Leader, Player, View } from '../shared/types.ts';
import { migratePlayer } from '../shared/quests.ts';
import { randomAppearance } from '../shared/multiplayer.ts';
import { FishingRooms } from './rooms.ts';
import type { RoomClient } from './rooms.ts';

const rooms = new FishingRooms();

const databasePath = resolve(process.env.FISHING_DB ?? 'data/fishing.sqlite');
mkdirSync(dirname(databasePath), { recursive: true });
const db = new DatabaseSync(databasePath);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS players (
    session TEXT PRIMARY KEY,
    state TEXT NOT NULL,
    nickname TEXT GENERATED ALWAYS AS (json_extract(state, '$.nickname')) STORED,
    score INTEGER GENERATED ALWAYS AS (json_extract(state, '$.bestScore')) STORED,
    achieved_at INTEGER GENERATED ALWAYS AS (json_extract(state, '$.bestAt')) STORED
  );
  CREATE INDEX IF NOT EXISTS players_score ON players (score DESC, achieved_at, session) WHERE score IS NOT NULL;
`);

const read = db.prepare('SELECT state FROM players WHERE session = ?');
const write = db.prepare('INSERT INTO players (session, state) VALUES (?, ?) ON CONFLICT(session) DO UPDATE SET state = excluded.state');
const topQuery = db.prepare(`
  SELECT session, nickname, score, RANK() OVER (ORDER BY score DESC) AS place
  FROM players WHERE score IS NOT NULL
  ORDER BY score DESC, achieved_at, session LIMIT 20
`);
const ownQuery = db.prepare(`
  SELECT session, nickname, score, (SELECT COUNT(*) + 1 FROM players WHERE score > p.score) AS place
  FROM players p WHERE session = ? AND score IS NOT NULL
`);

function load(session: string | null): Player | null {
  if (!session) return null;
  const row = read.get(session);
  if (!row) return null;
  const player = migratePlayer(JSON.parse(String(row.state)) as Player);
  if (!player.appearance) {
    player.appearance = randomAppearance(() => randomInt(1_000_000) / 1_000_000);
    save(session, player);
  }
  return player;
}

function save(session: string, player: Player) {
  player.revision += 1;
  write.run(session, JSON.stringify(player));
  rooms.saved(session, player, Date.now());
}

function cookie(request: IncomingMessage) {
  const part = request.headers.cookie?.split(';').map((value) => value.trim()).find((value) => value.startsWith('fishing='));
  const session = part?.slice('fishing='.length);
  return session && /^[a-f\d-]{36}$/.test(session) ? session : null;
}

function json(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(payload));
}

function view(response: ServerResponse, status: number, player: Player | null, error?: string) {
  json(response, status, { player, serverNow: Date.now(), error } satisfies View);
}

async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  if (!request.headers['content-type']?.startsWith('application/json')) throw new RuleError('Ожидался JSON.');
  request.setEncoding('utf8');
  let buffer = '';
  for await (const chunk of request) {
    buffer += String(chunk);
    if (buffer.length > 4_096) throw new RuleError('Запрос слишком большой.');
  }
  let value: unknown;
  try {
    value = JSON.parse(buffer);
  } catch {
    throw new RuleError('Некорректный запрос.');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RuleError('Некорректный запрос.');
  return value as Record<string, unknown>;
}

function known<T extends object>(catalog: T, value: unknown): value is Extract<keyof T, string> {
  return typeof value === 'string' && Object.hasOwn(catalog, value);
}

function integer(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function actionFrom(input: Record<string, unknown>): Action {
  const { type, spot, bait, round, card, id, x, y, rotated, upgrade, slot } = input;
  switch (type) {
    case 'fishAt':
      if (integer(input.zone) && input.zone >= 0 && input.zone < 3) return { type, zone: input.zone };
      break;
    case 'start':
      if (known(spots, spot) && known(baits, bait)) return { type, spot, bait };
      break;
    case 'move':
      if (typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y)) {
        if (input.aim === undefined) return { type, x, y };
        const aim = input.aim as Record<string, unknown> | null;
        if (aim && typeof aim.x === 'number' && Number.isFinite(aim.x) && typeof aim.y === 'number' && Number.isFinite(aim.y)) return { type, x, y, aim: { x: aim.x, y: aim.y } };
      }
      break;
    case 'charge': {
      if (input.aim === undefined) return { type };
      const aim = input.aim as Record<string, unknown> | null;
      if (aim && typeof aim.x === 'number' && Number.isFinite(aim.x) && typeof aim.y === 'number' && Number.isFinite(aim.y)) return { type, aim: { x: aim.x, y: aim.y } };
      break;
    }
    case 'cast': case 'cancelCharge': case 'hook': case 'return': case 'claimQuest': case 'ackOutcome': case 'stop': case 'reel':
      return { type };
    case 'play':
      if (integer(round) && known(cards, card) && integer(input.instance)) return { type, round, card, instance: input.instance };
      break;
    case 'endTurn':
      if (integer(round)) return { type, round };
      break;
    case 'place':
      if (typeof id === 'string' && integer(x) && integer(y) && typeof rotated === 'boolean') return { type, id, x, y, rotated };
      break;
    case 'discard': case 'sell': case 'roll': case 'takeQuest':
      if (typeof id === 'string') return { type, id };
      break;
    case 'upgrade':
      if (known(upgrades, upgrade)) return { type, upgrade };
      break;
    case 'equip':
      if (integer(slot) && known(cards, card)) return { type, slot, card };
      break;
  }
  throw new RuleError('Неизвестное действие или неверные параметры.');
}

function ranking(session: string | null) {
  function entry(row: Record<string, unknown>): Leader {
    return { place: Number(row.place), nickname: String(row.nickname), score: Number(row.score), mine: row.session === session };
  }
  const own = session ? ownQuery.get(session) : undefined;
  return { top: topQuery.all().map(entry), mine: own ? entry(own) : null };
}

const assetTypes: Record<string, string> = {
  js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', jpg: 'image/jpeg', png: 'image/png', ogg: 'audio/ogg', mp3: 'audio/mpeg',
};

function staticFile(path: string, response: ServerResponse) {
  const asset = /^\/assets\/[a-zA-Z0-9_.-]+\.(js|css|jpg|png|ogg|mp3)$/.exec(path);
  if (path !== '/' && !asset) return json(response, 404, { error: 'Страница не найдена.' });
  const file = resolve('dist', path === '/' ? 'index.html' : `.${path}`);
  const size = statSync(file, { throwIfNoEntry: false })?.size;
  if (size === undefined) return json(response, 404, { error: 'Выполните npm run build.' });
  const type = asset ? assetTypes[asset[1]] : 'text/html; charset=utf-8';
  response.writeHead(200, {
    'Content-Type': type, 'Content-Length': size,
    'Cache-Control': asset ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  createReadStream(file).on('error', () => response.destroy()).pipe(response);
}

const server = createServer(async (request, response) => {
  const session = cookie(request);
  try {
    const method = request.method;
    const path = request.url?.split('?')[0] ?? '/';
    if (method === 'GET' && path === '/api/events') {
      const player = load(session);
      if (!session || !player) return view(response, 401, null, 'Сначала введите имя.');
      if (rooms.connections(session) >= 4) return json(response, 429, { error: 'Открыто слишком много вкладок игры.' });
      const now = Date.now();
      if (advancePlayer(player, now)) save(session, player);
      response.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive', 'X-Accel-Buffering': 'no',
      });
      response.flushHeaders();
      response.write('retry: 2000\n\n');
      const client: RoomClient = {
        send: (event, value) => !response.destroyed && !response.writableEnded && response.write(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`),
        close: () => response.destroy(),
      };
      response.on('close', () => rooms.disconnect(session, client, Date.now()));
      response.on('error', () => rooms.disconnect(session, client, Date.now()));
      rooms.connect(session, player, client, now);
      return;
    }
    if (method === 'GET' && path === '/api/ranking') return json(response, 200, ranking(session));
    if (method === 'GET' && path === '/api/state') {
      const player = load(session);
      if (session && player && advancePlayer(player, Date.now())) save(session, player);
      return view(response, 200, player);
    }
    if (method === 'POST' && path === '/api/join') {
      const input = await body(request);
      const existing = load(session);
      if (existing) return view(response, 200, existing);
      const nickname = typeof input.nickname === 'string' ? input.nickname.trim().replace(/\s+/g, ' ') : '';
      if (!nickname || nickname.length > 24 || /\p{C}/u.test(nickname)) throw new RuleError('Введите имя длиной от 1 до 24 символов.');
      const newSession = randomUUID();
      const player = newPlayer(nickname);
      player.appearance = randomAppearance(() => randomInt(1_000_000) / 1_000_000);
      save(newSession, player);
      const secure = request.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
      response.setHeader('Set-Cookie', `fishing=${newSession}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`);
      return view(response, 201, player);
    }
    if (method === 'POST' && path === '/api/action') {
      const input = await body(request);
      const player = load(session);
      if (!session || !player) return view(response, 401, null, 'Сначала введите имя.');
      const now = Date.now();
      if (advancePlayer(player, now)) save(session, player);
      if (input.revision !== player.revision) return view(response, 409, player, 'Игра уже перешла в следующее состояние.');
      const action = actionFrom(input);
      applyAction(player, action, { now, random: () => randomInt(1_000_000) / 1_000_000, nextId: randomUUID });
      if (action.type === 'start') rooms.update(session, player, now, true);
      save(session, player);
      return view(response, 200, player);
    }
    if (method === 'GET') return staticFile(path, response);
    return json(response, 404, { error: 'Такого действия нет.' });
  } catch (error) {
    if (error instanceof RuleError) return view(response, 400, load(session), error.message);
    console.error(error);
    return view(response, 500, null, 'Сервер не смог выполнить действие. Попробуйте ещё раз.');
  }
});

const host = process.env.HOST ?? '127.0.0.1';
const roomTimer = setInterval(() => {
  const now = Date.now();
  rooms.tick(now, (session, player) => {
    if (advancePlayer(player, now)) save(session, player);
  });
}, 200);
const heartbeatTimer = setInterval(() => rooms.heartbeat(Date.now()), 10_000);
roomTimer.unref();
heartbeatTimer.unref();
const port = Number(process.env.PORT ?? 4173);
server.listen(port, host, () => {
  const address = server.address();
  console.log(`Болотная рыбалка: http://${host}:${typeof address === 'object' && address ? address.port : port}`);
});
