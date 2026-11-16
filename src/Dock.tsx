import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import {
  HAND_SIZE, TURN_ENERGY, baits, cards, districts, fish, fishIds, getSpot, oddsFor, rewardCards, starterDeck, upgrades,
} from '../shared/content.ts';
import type { BaitId, CardId, SpotId, UpgradeId } from '../shared/content.ts';
import type { Player, Ranking, Roll } from '../shared/types.ts';
import { cardEffect } from '../shared/game.ts';
import type { SendAction } from './api.ts';
import { CardArt, CardFace, FishArt, SpotArt, spotTiles, zoneRisk } from './GameArt.tsx';
import boat from './art/boat.png';
import { RoomDialog } from './Dialog.tsx';
import { currentQuest, quests } from '../shared/quests.ts';
import type { Sound } from './sound.ts';
import { playSound } from './sound.ts';
import { SoundToggle } from './Sound.tsx';

type DockProps = { player: Player; busy: boolean; send: SendAction };
const objectSounds = {
  'dock-boat': 'water', 'dock-house': 'workshop', 'dock-board': 'leaderboard', 'dock-jobs': 'paper',
  'dock-tackle': 'tackle', 'room-merchant': 'coins', 'room-tackle': 'tackle', 'room-exit': 'wood',
} satisfies Record<string, Sound>;

function SceneAction({ object, label, detail, onClick }: {
  object: keyof typeof objectSounds; label: string; detail?: string; onClick: () => void;
}) {
  return <button className={`scene-action ${object}`} data-sound={objectSounds[object]} type="button" onClick={onClick}>
    <span className="scene-hit" aria-hidden="true" />
    <span className="scene-tag">{label}{detail && <small>{detail}</small>}</span>
  </button>;
}

function PlayerQuest({ player }: { player: Player }) {
  const quest = currentQuest(player);
  const progress = player.activeQuest?.progress ?? 0;
  const ready = Boolean(quest && progress >= quest.count);
  return <section className="quest scene-quest" aria-label="Игрок и задание">
    <div className="quest-player"><strong className="quest-player-name">{player.nickname}</strong><span className="quest-gold"><i className="coin" aria-hidden="true" />{player.gold} золота</span></div>
    <div className="row spread wrap"><span className="quest-status" data-done={ready}><i />{ready ? 'Выполнено · сдайте на доске' : quest ? 'Активный заказ' : 'Нет активного заказа'}</span>{quest && <span className="reward">+{quest.gold} золота</span>}</div>
    <h2>{quest?.name ?? 'Доска заданий'}</h2>
    <p>{ready ? 'Вернитесь к доске заданий и заберите награду.' : quest?.description ?? (player.completedQuests.length === quests.length ? 'Все заказы выполнены. Спасибо за помощь!' : 'Возьмите новый заказ на доске заданий на причале.')}</p>
    {quest && <><div className="quest-progress" aria-hidden="true"><span data-done={ready} style={{display:'block',width: (progress / quest.count * 100) + '%',height:'100%',background:'#adc092'}} /></div>
    <div className="row spread quest-counter"><span>Рыба доставлена</span><strong>{progress} / {quest.count}</strong></div></>}
  </section>;
}

function QuestBoard({ player, busy, send }: DockProps) {
  const active = currentQuest(player);
  return <div className="quest-list">
    <p>Заказы считают рыбу, привезённую после принятия задания. Улов остаётся у вас.</p>
    {quests.map(quest => {
      const done = player.completedQuests.includes(quest.id);
      const current = active?.id === quest.id;
      const ready = current && (player.activeQuest?.progress ?? 0) >= quest.count;
      return <section className="quest-contract" key={quest.id}>
        <div><span className="eyebrow">{done ? 'Сдано' : current ? 'Ваш заказ' : 'Заказ'}</span><h3>{quest.name}</h3><p>{quest.description}</p><strong>Награда: {quest.gold} золота</strong></div>
        {done ? <span className="meta">Награда получена</span> : current ? <button className="primary" disabled={!ready || busy} onClick={() => void send({type:'claimQuest'})}>{ready ? 'Сдать задание' : 'В процессе · ' + player.activeQuest?.progress + ' / ' + quest.count}</button> : <button disabled={busy || Boolean(active)} onClick={() => void send({type:'takeQuest',id:quest.id})}>Взять задание</button>}
      </section>;
    })}
  </div>;
}

function EquipmentStatus({ player }: { player: Player }) {
  const boatLevel = player.upgrades.includes('boat') ? 2 : 1;
  const gearLevel = player.upgrades.includes('gear') ? 2 : 1;
  return <div className="equipment-status"><div><span>Лодка · уровень {boatLevel}</span><strong>Трюм 3 × {boatLevel + 1}</strong><small>{3 * (boatLevel + 1)} клеток для улова</small></div><div><span>Снасти и леска · уровень {gearLevel}</span><strong>{gearLevel === 2 ? '+1 к урону и защите' : 'Базовые эффекты карт'}</strong><small>Прочность лески в бою: 10</small></div></div>;
}

export function Dock({ player, busy, send, openMap, openMarket, openRank }: DockProps & {
  openMap: () => void; openMarket: () => void; openRank: () => void;
}) {
  const [deckOpen, setDeckOpen] = useState(false);
  const [questsOpen, setQuestsOpen] = useState(false);
  const editor = useRef<HTMLElement>(null);
  return (
    <>
      <section className="location-scene dock-scene" aria-labelledby="dock-title">
        <div className="scene-caption"><span className="eyebrow">Тихая заводь</span><h1 id="dock-title">Причал</h1><p>Лодка ждёт. Пора на воду.</p></div>
        <div className="scene-sidebar"><PlayerQuest player={player} /></div>
        <div className="scene-world scene-frame">
          <div className="scene-picture" aria-hidden="true">
            <span className="dock-mist" /><span className="dock-lantern" />
          </div>
          <SceneAction object="dock-boat" label="На рыбалку" onClick={openMap} />
          <SceneAction object="dock-house" label="Мастерская" onClick={openMarket} />
          <SceneAction object="dock-board" label="Доска лидеров" onClick={openRank} />
          <SceneAction object="dock-jobs" label="Доска заданий" onClick={() => setQuestsOpen(true)} />
          <SceneAction object="dock-tackle" label="Снасти" onClick={() => setDeckOpen(true)} />
        </div>
        <p className="scene-hint">Выберите объект на причале</p>
      </section>
      {questsOpen && <RoomDialog title="Доска заданий" close={() => setQuestsOpen(false)}><QuestBoard player={player} busy={busy} send={send} /></RoomDialog>}
      {deckOpen && <RoomDialog className="tackle-screen" title="Снасти · ваша колода" close={() => setDeckOpen(false)}><DeckEditor player={player} busy={busy} send={send} editorRef={editor} /><p className="meta tackle-footer">Улучшить лодку и снасти можно в мастерской.</p></RoomDialog>}
    </>
  );
}

export function MapScreen({ player, busy, send }: DockProps) {
  const [district, setDistrict] = useState(0);
  const [spot, setSpot] = useState<SpotId>('reeds');
  const [bait, setBait] = useState<BaitId>('worm');
  const chosenDistrict = districts[district];
  const chosenSpot = getSpot(spot);
  const needs = chosenSpot.requires;
  const locked = needs && !player.upgrades.includes(needs);

  return (
    <>
      <p>Выберите район, место и наживку.</p>
      <div className="map-layout">
        <section className="map-places">
          <h2>Районы</h2>
          <div className="district-grid" data-sound="paper">
            {districts.map((entry, index) => {
              const requirement = getSpot(entry.spots[0]).requires;
              return <button className="scenic-button district-button" key={entry.name} aria-pressed={district === index} onClick={() => {
                setDistrict(index);
                setSpot(entry.spots[0]);
              }}>
                <SpotArt tile={spotTiles[entry.spots[0]]} />
                <span className="scenic-caption"><strong>{entry.name}</strong><small>{requirement && !player.upgrades.includes(requirement) ? 'Требуется улучшение лодки' : entry.risk}</small></span>
              </button>;
            })}
          </div>
          <h2 className="section-heading">Точки ловли</h2>
          <div className="spot-grid" data-sound="water">
            {chosenDistrict.spots.map((id) => {
              const { requires, name } = getSpot(id);
              const isLocked = requires && !player.upgrades.includes(requires);
              return <button className="scenic-button spot-button" key={id} aria-pressed={spot === id} onClick={() => setSpot(id)}>
                <SpotArt tile={spotTiles[id]} />
                <span className="scenic-caption"><strong>{name}</strong>{isLocked && <small>Закрыто</small>}</span>
              </button>;
            })}
          </div>
        </section>
        <section className="panel map-summary">
          <h2>{chosenSpot.name}</h2>
          <p className="meta">5 минут на воде · время боя не учитывается</p>
          <fieldset data-sound="tackle">
            <legend>Наживка</legend>
            {(Object.keys(baits) as BaitId[]).map((id) => <label className="option" key={id}>
              <input name="bait" type="radio" checked={bait === id} onChange={() => setBait(id)} />
              <span><strong>{baits[id].name}</strong><small>{baits[id].description}</small></span>
            </label>)}
          </fieldset>
          <div className="map-odds">
            {chosenSpot.zones.map((zone) => <div key={zone.name} data-risk={zoneRisk(zone.weights)}>
              <span className="zone-dot" aria-hidden="true" /><div><strong>{zone.name}</strong><small>{oddsFor(zone, bait).flatMap((weight, index) => weight ? [`${fish[fishIds[index]].name} ${weight}%`] : []).join(' · ')}</small></div>
            </div>)}
          </div>
          {locked && needs && <p>Нужно улучшение «{upgrades[needs].name}».</p>}
          <button className="primary" disabled={Boolean(locked) || busy} onClick={() => void send({ type: 'start', spot, bait })}>Начать вылазку</button>
        </section>
      </div>
    </>
  );
}

function CardDetails({ player, id }: { player: Player; id: CardId }) {
  const { damage, guard } = cardEffect(player, id);
  const effects = [damage ? `${damage} урона` : '', guard ? `${guard} защиты` : ''].filter(Boolean).join(' · ');
  return <><strong>{cards[id].name}</strong><small>{cards[id].rarity} · {effects}</small></>;
}

const SPIN_MS = 4_400;

function Roulette({ player, roll, animated, close, showDeck }: {
  player: Player; roll: Roll; animated: boolean; close: () => void; showDeck: () => void;
}) {
  const panel = useRef<HTMLDialogElement>(null);
  const done = useRef<HTMLButtonElement>(null);
  const [spinning, setSpinning] = useState(() => animated && !matchMedia('(prefers-reduced-motion: reduce)').matches);
  const possible = rewardCards.filter((_, index) => fish[roll.species].rewards[index] > 0);
  const target = 15;
  const seed = roll.id.charCodeAt(0);
  const prizeSoundPlayed = useRef(false);

  useEffect(() => {
    if (!spinning && animated && !prizeSoundPlayed.current) {
      prizeSoundPlayed.current = true;
      playSound('win');
    }
  }, [spinning, animated]);

  useEffect(() => {
    const dialog = panel.current;
    dialog?.showModal();
    return () => { dialog?.close(); };
  }, []);

  useEffect(() => {
    if (!spinning) { done.current?.focus(); return; }
    const timer = setTimeout(() => setSpinning(false), SPIN_MS + 50);
    return () => clearTimeout(timer);
  }, [spinning]);

  return (
    <dialog className="roll-dialog" ref={panel} aria-labelledby="roll-title"
      style={{ '--spin-duration': `${SPIN_MS}ms` } as CSSProperties}
      onCancel={(event) => { event.preventDefault(); if (!spinning) close(); }}>
      <div className="roll-heading"><FishArt species={roll.species} /><h2 id="roll-title">Розыгрыш · {fish[roll.species].name}</h2><SoundToggle compact /></div>
      <div className="roll-window" aria-hidden="true">
        <div className="roll-track" data-animate={spinning}>
          {Array.from({ length: 21 }, (_, index) => {
            const id = index === target ? roll.card : possible[(index + seed) % possible.length];
            return <div className="roll-card" data-prize={!spinning && index === target} key={index}>
              <CardFace player={player} id={id} />
            </div>;
          })}
        </div>
        <div className="roll-marker" />
      </div>
      <div className="roll-result" aria-live="polite">
        {spinning ? <span>Рулетка крутится…</span> : <>
          <span className="eyebrow">Выпавшая карта</span><CardDetails player={player} id={roll.card} />
          <p>{roll.duplicateGold ? `Эта карта уже есть. За повтор вы получили ${roll.duplicateGold} золота.` : 'Карта в коллекции. Вы можете поставить её в колоду следующей вылазки.'}</p>
        </>}
      </div>
      {!spinning && <div className="row wrap roll-actions"><button className="primary" ref={done} onClick={close}>Готово</button><button onClick={showDeck}>К колоде</button></div>}
    </dialog>
  );
}

function DeckEditor({ player, busy, send, editorRef }: DockProps & { editorRef: RefObject<HTMLElement | null> }) {
  const [slot, setSlot] = useState(0);
  const spare = player.collection.filter(id => player.deck.filter(card => card === id).length < Math.max(1, starterDeck.filter(card => card === id).length));
  return (
    <section className="panel deck-editor" data-sound="card" ref={editorRef} tabIndex={-1}>
      <EquipmentStatus player={player} />
      <div className="deck-layout">
      <section className="deck-group" aria-label="Колода вылазки">
      <div className="deck-group-heading"><h2>Колода вылазки</h2><span className="meta">{player.deck.length} карт</span></div>
      <p>{TURN_ENERGY} энергии · {HAND_SIZE} случайных карт на ход.<br />Вся рука уходит в сброс. Когда колода пуста, сброс перемешивается. Защита приходит не каждый ход.</p>
      <div className="deck-faces">
        {player.deck.map((id, index) => <button className="card-button deck-slot" key={index}
          aria-pressed={slot === index} aria-label={`Слот ${index + 1}, ${cards[id].name}`} onClick={() => setSlot(index)}>
          <CardFace player={player} id={id} />
        </button>)}
      </div>
      </section>
      <section className="deck-group deck-reserve" aria-label="Карты в запасе">
      <div className="deck-group-heading"><h2>Карты в запасе</h2><span className="meta">{spare.length}</span></div>
      {spare.length ? <><p>Выберите слот в колоде, затем карту из запаса.<br /><span className="deck-selection" aria-live="polite">Заменить: {cards[player.deck[slot]].name}</span></p>
        <div className="deck-faces reserve">{spare.map((id) => <button key={id} className="card-button" disabled={busy}
          aria-label={`Взять карту «${cards[id].name}» в слот ${slot + 1}`} onClick={() => void send({ type: 'equip', slot, card: id })}>
          <CardFace player={player} id={id} />
        </button>)}</div></> : <p className="meta">Новые карты появятся здесь после розыгрыша рыбы.</p>}
      </section>
      </div>
    </section>
  );
}

export function Market({ player, busy, send, back }: DockProps & { back: () => void }) {
  const [section, setSection] = useState<'trade' | 'tackle' | null>(null);
  const [tab, setTab] = useState<'deck' | 'upgrades'>('deck');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openRoll, setOpenRoll] = useState<{ roll: Roll; animated: boolean } | null>(null);
  const deckEditor = useRef<HTMLElement>(null);
  const selected = player.stock.find((item) => item.id === selectedId) ?? player.stock[0];

  async function spin() {
    if (!selected) return;
    const result = await send({ type: 'roll', id: selected.id });
    if (result?.lastRoll) setOpenRoll({ roll: result.lastRoll, animated: true });
  }

  function showDeck() {
    setOpenRoll(null);
    setSection('tackle');
    setTab('deck');
  }

  return (
    <>
      <section className="location-scene workshop-scene" aria-labelledby="workshop-title">
        <div className="scene-caption"><span className="eyebrow">Всё для следующей вылазки</span><h1 id="workshop-title">Мастерская</h1></div>
        <div className="scene-sidebar">
          <PlayerQuest player={player} />
        </div>
        <div className="scene-world scene-frame">
          <div className="scene-picture" aria-hidden="true"><span className="workshop-glow" /></div>
          <SceneAction object="room-merchant" label="Торговец" detail="Продать или разыграть рыбу" onClick={() => setSection('trade')} />
          <SceneAction object="room-tackle" label="Снасти" detail="Колода и улучшения" onClick={() => setSection('tackle')} />
          <SceneAction object="room-exit" label="На причал" onClick={back} />
        </div>
        <p className="scene-hint">Выберите торговца, снасти или дверь на причал</p>
      </section>
      {section === 'trade' && !openRoll && <RoomDialog title="Торговец · улов" close={() => setSection(null)}>
        <section className="trade-content">
          {selected ? <>
            <div className="row wrap fish-list">
              {player.stock.map((item, index) => <button className="fish-tile" aria-pressed={selected.id === item.id} key={item.id}
                onClick={() => setSelectedId(item.id)}><FishArt species={item.species} /><span>{fish[item.species].name} {index + 1}</span></button>)}
            </div>
            <h3>{fish[selected.species].name} · возможные карты</h3>
            <ul className="plain-list rewards">
              {rewardCards.map((id, index) => fish[selected.species].rewards[index] > 0 && (
                <li key={id}><CardArt id={id} /><div><CardDetails player={player} id={id} /></div><strong>{fish[selected.species].rewards[index]}%</strong></li>
              ))}
            </ul>
            <div className="row wrap">
              <button disabled={busy} onClick={() => void send({ type: 'sell', id: selected.id })}>Продать за {fish[selected.species].gold}</button>
              <button className="primary" disabled={busy} onClick={() => void spin()}>Разыграть рыбу</button>
            </div>
          </> : <p>На причале пока нет рыбы для продажи или розыгрыша.</p>}
          {player.lastRoll && <button className="text-button last-roll" onClick={() => setOpenRoll({ roll: player.lastRoll!, animated: false })}>Последний розыгрыш</button>}
        </section>
      </RoomDialog>}
      {section === 'tackle' && !openRoll && <RoomDialog className="tackle-screen" title="Снасти и лодка" close={() => setSection(null)}>
        <div className="row room-tabs" role="group" aria-label="Раздел снастей"><button aria-pressed={tab === 'deck'} onClick={() => setTab('deck')}>Колода</button><button aria-pressed={tab === 'upgrades'} onClick={() => setTab('upgrades')}>Улучшения</button><span className="meta">{player.gold} золота</span></div>
        {tab === 'deck' ? <DeckEditor player={player} busy={busy} send={send} editorRef={deckEditor} /> :
          <section className="panel">
            <h2>Улучшения</h2>
            {(Object.keys(upgrades) as UpgradeId[]).map((id) => {
              const { name, description, price } = upgrades[id];
              const owned = player.upgrades.includes(id);
              return <div className="upgrade" key={id}>
                <div className="upgrade-art">{id === 'boat' ? <img src={boat} alt="" /> : <CardArt id="reel" />}</div>
                <div><h3>{name}</h3><p>{description}</p>
                <button disabled={owned || busy || player.gold < price} onClick={() => void send({ type: 'upgrade', upgrade: id })}>
                  {owned ? 'Куплено' : `Купить за ${price}`}
                </button></div>
              </div>;
            })}
          </section>}
      </RoomDialog>}
      {openRoll && <Roulette player={player} roll={openRoll.roll} animated={openRoll.animated} close={() => setOpenRoll(null)} showDeck={showDeck} />}
    </>
  );
}

export function Leaderboard() {
  const [ranking, setRanking] = useState<Ranking | null>(null);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch('/api/ranking', { signal: controller.signal });
        if (!response.ok) throw new Error('ranking');
        setRanking(await response.json() as Ranking);
        setError(false);
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    }
    void load();
    return () => controller.abort();
  }, [refresh]);

  return (
    <>
      <p>Лучший улов за одну вылазку.</p>
      <section className="panel ranking">
        <div className="row spread wrap"><h2>Лучшая вылазка</h2><button onClick={() => setRefresh((value) => value + 1)}>Обновить рейтинг</button></div>
        {error && <p role="alert">Не удалось загрузить рейтинг.</p>}
        {ranking && ranking.top.length > 0 && <table>
          <thead><tr><th>Место</th><th>Игрок</th><th>Очки</th></tr></thead>
          <tbody>{ranking.top.map((entry, index) => <tr key={index} data-mine={entry.mine}>
            <td>{entry.place}</td><td>{entry.nickname}{entry.mine ? ' (вы)' : ''}</td><td>{entry.score}</td>
          </tr>)}</tbody>
        </table>}
        {!ranking && !error && <p>Загрузка…</p>}
        {ranking && ranking.top.length === 0 && <p>Первые результаты появятся после возвращения на причал.</p>}
        {ranking?.mine && <p className="own">Ваш результат · место {ranking.mine.place} · {ranking.mine.score} очков</p>}
      </section>
    </>
  );
}
