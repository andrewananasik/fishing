import { Icon } from './Icon.tsx';
import { useEffect, useRef, useState } from 'react';

import { preload } from 'react-dom';
import {
  HAND_SIZE, LINE_MAX, TURN_ENERGY, baits, cards, fish, getSpot,
} from '../shared/content.ts';
import { fishIntent, gridSize } from '../shared/game.ts';
import type { Battle, Player, Trip, TripResult } from '../shared/types.ts';
import { useNow } from './api.ts';
import type { SendAction } from './api.ts';
import { CardFace, FishArt, FishSprite } from './GameArt.tsx';
import { FishingRig, FishingWater } from './Pond.tsx';
import { RoomDialog } from './Dialog.tsx';
import { Cargo } from './Cargo.tsx';
import duelRod from './art/duel-rod.png';
import fightAngler from './art/fight-angler.png';
import fightTitle from './art/fight-title.png';
import { Casting } from './Casting.tsx';

import { playSound } from './sound.ts';
import { SoundToggle } from './Sound.tsx';
import type { RoomSnapshot } from '../shared/multiplayer.ts';
import { FishingCompany } from './Multiplayer.tsx';

type TripProps = { player: Player; trip: Trip; busy: boolean; send: SendAction };
const FIGHT_INTRO_MS = 2_100;

function clockText(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1_000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function TripClock({ trip, offset }: { trip: Trip; offset: number }) {
  const now = useNow(offset, 160, trip.pausedAt == null);
  const left = trip.deadline - (trip.pausedAt ?? now);
  return <span className="time" data-low={left < 25_000}>{trip.pausedAt != null ? "Вылазка на паузе" : "До причала"} <strong>{clockText(left)}</strong></span>;
}

function FightIntro({ nickname, battle, onComplete }: { nickname: string; battle: Battle; onComplete: (startedAt: number) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opponentName = fish[battle.species].name;
  const { startedAt } = battle;
  const soundedBattle = useRef<number | null>(null);

  useEffect(() => {
    const panel = dialog.current;
    panel?.showModal();
    if (soundedBattle.current !== startedAt) {
      soundedBattle.current = startedAt;
      playSound('fight');
    }
    const timer = setTimeout(() => onComplete(startedAt), FIGHT_INTRO_MS);
    return () => {
      clearTimeout(timer);
      panel?.close();
    };
  }, [startedAt, onComplete]);

  return (
    <dialog ref={dialog} className="fight-intro" aria-label={`Начало боя. ${nickname} против рыбы ${opponentName}`}
      onCancel={(event) => event.preventDefault()}>
      <img className="fight-intro-angler" src={fightAngler} alt="" />
      <div className="fight-intro-fish"><FishSprite species={battle.species} /></div>
      <img className="fight-intro-title" src={fightTitle} alt="FIGHT" />
      <div className="fight-intro-names" aria-hidden="true"><bdi>{nickname}</bdi><span>{opponentName}</span></div>
    </dialog>
  );
}

function BattlePanel({ player, battle, busy, send }: Pick<TripProps, 'player' | 'busy' | 'send'> & { battle: Battle }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opponent = fish[battle.species];
  const intent = fishIntent(battle);
  const fishTurn = battle.phase === 'fish';
  const choiceDisabled = busy || fishTurn;
  const [pile, setPile] = useState<'drawPile' | 'discardPile' | null>(null);
  const incomingDamage = Math.max(0, intent.attack - battle.block);
  const canPlay = battle.hand.some(index => cards[battle.deck[index]].cost <= battle.energy);
  const pileCards = pile ? battle.deck.flatMap((id, index) => battle[pile].includes(index) ? [id] : []).sort() : [];
  const previous = useRef({ health: battle.fishHealth, line: battle.line, block: battle.block });
  const [feedback, setFeedback] = useState<{ damage: number; line: number; block: number; key: number } | null>(null);
  useEffect(() => {
    const before = previous.current;
    previous.current = { health: battle.fishHealth, line: battle.line, block: battle.block };
    const damage = Math.max(0, before.health - battle.fishHealth);
    const line = Math.max(0, before.line - battle.line);
    const block = Math.max(0, battle.block - before.block);
    if (!damage && !line && !block) { setFeedback(null); return; }
    playSound(damage || line ? 'strike' : 'guard');
    setFeedback({ damage, line, block, key: Date.now() });
    const timer = setTimeout(() => setFeedback(null), 1_100);
    return () => clearTimeout(timer);
  }, [battle.fishHealth, battle.line, battle.block]);

  useEffect(() => {
    const panel = dialog.current;
    panel?.showModal();
    return () => { panel?.close(); };
  }, []);

  return (
    <dialog ref={dialog} className="battle" data-phase={battle.phase} aria-labelledby="battle-heading" onCancel={(event) => event.preventDefault()}>
      <div className="battle-top">
        <div className="opponent-info"><p className="eyebrow">Карточное вываживание</p><h2 id="battle-heading">{opponent.name} на крючке</h2><span className="meta">{opponent.difficulty} рыба</span></div>
        <div className="battle-limit">Вылазка на паузе<strong>Бой без таймера</strong></div>
      </div>
      <div className="battle-arena">
        <div className="combatant angler" data-guarding={Boolean(feedback?.block)}>{feedback && (feedback.block > 0 || feedback.line > 0) && <span key={feedback.key} className="combat-pop" data-kind={feedback.block ? "guard" : "damage"}>{feedback.block ? "+" + feedback.block + " защиты" : "−" + feedback.line + " лески"}</span>}<img className="duel-rod" src={duelRod} alt="Рука рыбака с удочкой" /><div className="fighter-stats"><span>Прочность лески <b>{battle.line} / {LINE_MAX}</b></span><meter min={0} max={LINE_MAX} value={battle.line} aria-label="Прочность лески" /><small>Защита {battle.block}</small></div></div>
        <div className="combatant opponent" data-hit={Boolean(feedback?.damage)}>{feedback && feedback.damage > 0 && <span key={feedback.key} className="combat-pop" data-kind="damage">−{feedback.damage}</span>}<div className="intent" data-attack={Boolean(intent.attack)}><span>{fishTurn ? 'Рыба действует' : 'Намерение рыбы'}</span>{intent.attack > 0 && <strong><Icon name="swords" />Атака {intent.attack}</strong>}{intent.block > 0 && <strong><Icon name="shield" />Защита +{intent.block}</strong>}</div><FishSprite species={battle.species} /><div className="fighter-stats"><span>{opponent.name} <b>{battle.fishHealth} / {opponent.health}</b></span><meter min={0} max={opponent.health} value={battle.fishHealth} aria-label="Выносливость рыбы" /><small>Защита {battle.fishBlock}</small></div></div>
      </div>
      <div className="battle-time">{fishTurn ? 'Ход рыбы…' : battle.energy === 0 ? 'Энергия потрачена. Завершите ход, чтобы рыба ответила.' : `Ваш ход ${battle.round + 1} · нажмите карту — её эффект сработает сразу`}</div>
      <div className="battle-deck-bar">
        <button className="pile-button" aria-expanded={pile === 'drawPile'} aria-controls="pile-contents" onClick={() => setPile(pile === 'drawPile' ? null : 'drawPile')}><span className="pile-back" aria-hidden="true">{battle.drawPile.length}</span><span>Колода<strong>Карт: {battle.drawPile.length}</strong></span></button>
        <p className="hand-summary">Рука {battle.hand.length} · колода {battle.deck.length}<small>Добор {HAND_SIZE} · защита на один ход</small>{!fishTurn && incomingDamage > 0 && <span className="incoming-damage">Рывок снимет {incomingDamage} прочности{incomingDamage >= battle.line ? ' · леска оборвётся!' : ''}</span>}</p>
        <button className="pile-button" aria-expanded={pile === 'discardPile'} aria-controls="pile-contents" onClick={() => setPile(pile === 'discardPile' ? null : 'discardPile')}><span>Сброс<strong>Карт: {battle.discardPile.length}</strong></span><span className="pile-back discard-back" aria-hidden="true">{battle.discardPile.length}</span></button>
      </div>
      {pile && <section id="pile-contents" className="pile-contents" aria-label={pile === 'drawPile' ? 'Содержимое колоды' : 'Содержимое сброса'}>
        <div className="row spread"><strong>{pile === 'drawPile' ? 'Колода · порядок добора скрыт' : 'Сброс · вернётся после перемешивания'}</strong><button onClick={() => setPile(null)}>Скрыть</button></div>
        {pileCards.length ? <ul>{[...new Set(pileCards)].map(id => <li key={id}>{cards[id].name} <b>×{pileCards.filter(card => card === id).length}</b></li>)}</ul> : <p>Стопка пуста.</p>}
      </section>}
      <div className="choice-grid">
        {battle.hand.map((instance) => {
          const id = battle.deck[instance];
          return <button key={instance} className="choice card-button" data-sound="card"
            disabled={choiceDisabled || battle.energy < cards[id].cost}
            onClick={() => void send({ type: 'play', card: id, instance, round: battle.round })}>
            <CardFace player={player} id={id} />
            <span className="card-cost">{battle.energy < cards[id].cost ? 'Не хватает энергии' : 'Сыграть'}</span>
          </button>;
        })}
        {!battle.hand.length && <p className="empty-hand">{fishTurn ? 'Рука отправлена в сброс. Рыба отвечает…' : 'В руке нет карт. Завершите ход для нового добора.'}</p>}
      </div>
      <div className="battle-actions row spread">
        <SoundToggle compact />
        <span>Энергия <b>{battle.energy} / {TURN_ENERGY}</b></span>
        <button className="primary end-turn" data-ready={!canPlay} disabled={choiceDisabled} onClick={() => void send({ type: 'endTurn', round: battle.round })}>Завершить ход</button>
      </div>
      <p className="deck-rule">В конце хода вся рука уходит в сброс. Пустая колода пополняется перемешанным сбросом.{battle.shuffles > 0 && ` Перемешиваний: ${battle.shuffles}.`}</p>
      <p className="status" aria-live="polite">{player.trip?.message}</p>
    </dialog>
  );
}

export function Fishing({ player, trip, busy, send, offset, room, connection }: TripProps & { offset: number; room: RoomSnapshot | null; connection: 'connecting' | 'online' | 'reconnecting' }) {
  const [cargoOpen, setCargoOpen] = useState(Boolean(trip.pending && !trip.outcome));
  const [introducedBattle, setIntroducedBattle] = useState(trip.battle?.startedAt);
  const { battle } = trip;
  const outcomeWin = trip.outcome?.win;
  useEffect(() => {
    if (outcomeWin !== undefined) playSound(outcomeWin ? 'win' : 'lose');
  }, [outcomeWin]);
  const {width,height} = gridSize(player);
  const used = trip.cargo.reduce((sum,item)=>sum+fish[item.species].length,0);
  if (!battle) {
    preload(fightAngler, { as: 'image' });
    preload(fightTitle, { as: 'image' });
  }
  async function acknowledge() {
    const win=trip.outcome?.win;
    if(await send({type:'ackOutcome'})) setCargoOpen(Boolean(win));
  }
  return (
    <section className="fishing-scene">
      <Casting trip={trip} busy={busy} send={send} offset={offset} openCargo={()=>setCargoOpen(true)} appearance={player.appearance} room={room} />
      <div className="fishing-hud">
        <div className="fishing-location">
          <span className="eyebrow">На воде · {baits[trip.bait].name}</span><h1>{getSpot(trip.spot).name}</h1>
          <FishingCompany room={room} connection={connection} />
          <button data-sound="wood" onClick={()=>setCargoOpen(true)}>Трюм · {used} / {width*height}</button>
        </div>
        <div className="fishing-return"><TripClock trip={trip} offset={offset} /><button disabled={busy || Boolean(trip.battle || trip.pending || trip.outcome)} onClick={()=>void send({type:'return'})}>Вернуться на причал</button></div>
        <div className="water-label" aria-label="Сложность зон">
          <span data-risk="low"><i className="zone-dot" />Легко</span>
          <span data-risk="medium"><i className="zone-dot" />Средне</span>
          <span data-risk="high"><i className="zone-dot" />Сложно</span>
        </div>
      </div>
      {battle && (introducedBattle === battle.startedAt
        ? <BattlePanel player={player} battle={battle} busy={busy} send={send} />
        : <FightIntro nickname={player.nickname} battle={battle} onComplete={setIntroducedBattle} />)}
      {trip.outcome && <RoomDialog title={trip.outcome.win ? 'Победа! Ваш улов' : 'Поражение · рыба ушла'} className="outcome-dialog"><FishSprite species={trip.outcome.species} /><h3>{fish[trip.outcome.species].name}</h3><p>{trip.outcome.message}</p><button className="primary" disabled={busy} onClick={()=>void acknowledge()}>{trip.outcome.win ? 'Положить в инвентарь' : 'Вернуться к рыбалке'}</button></RoomDialog>}
      {cargoOpen && !trip.battle && !trip.outcome && <RoomDialog title="Трюм лодки" className="cargo-dialog" close={trip.pending ? undefined : ()=>setCargoOpen(false)}><Cargo player={player} trip={trip} busy={busy} send={send} />{!trip.pending && <button className="primary" onClick={()=>setCargoOpen(false)}>Продолжить рыбалку</button>}</RoomDialog>}
    </section>
  );
}

export function FishingResults({ result, market, rank, dock }: { result: TripResult; market: () => void; rank: () => void; dock: () => void }) {
  return <>
    <div className="fishing-scene" aria-hidden="true">
      <FishingWater spot={result.spot}><FishingRig spot={result.spot} /></FishingWater>
    </div>
    <RoomDialog title="Итог вылазки" className="results-dialog" close={dock}>
      <p className="meta trip-result-meta">{getSpot(result.spot).name} · {clockText(result.seconds * 1_000)} на воде</p>
      <p className="trip-result-score">{result.score} очков {result.record && result.score > 0 && <span>· личный рекорд</span>}</p>
      {result.cargo.length ? <ul className="plain-list rewards">
        {result.cargo.map((item) => <li key={item.id}><FishArt species={item.species} /><span>{fish[item.species].name}</span><strong>+{fish[item.species].points}</strong></li>)}
      </ul> : <p>Трюм пуст.</p>}
      {result.orderGold > 0 && <p>Первый заказ выполнен. +{result.orderGold} золота.</p>}
      <div className="row wrap trip-result-actions">
        <button className="primary" data-sound="workshop" onClick={market}>К улову и улучшениям</button>
        <button data-sound="leaderboard" onClick={rank}>Таблица лидеров</button>
        <button data-sound="wood" onClick={dock}>На причал</button>
      </div>
    </RoomDialog>
  </>;
}

