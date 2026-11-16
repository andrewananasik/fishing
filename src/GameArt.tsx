import { cards } from '../shared/content.ts';
import type { CardId, FishId, SpotId, Weights } from '../shared/content.ts';
import { cardEffect } from '../shared/game.ts';
import type { Player } from '../shared/types.ts';
import fishSprites from './art/duel-fish.png';

const cardTiles: Record<CardId, number> = { reel: 0, ease: 1, short: 2, steady: 3, sharp: 4, firm: 5, pull: 4, brace: 1, scout: 3 };
const fishTiles: Record<FishId, number> = { crucian: 6, perch: 7, pike: 8 };

export const spotTiles: Record<SpotId, number> = { reeds: 0, bend: 1, deep: 2, channel: 3 };

export function zoneRisk(weights: Weights) {
  return weights[2] ? 'high' : weights[1] ? 'medium' : 'low';
}

export function SpotArt({ tile, className = '' }: { tile: number; className?: string }) {
  return <span className={`spot-art ${className}`} data-tile={tile} aria-hidden="true" />;
}

export function FishArt({ species, className = '' }: { species: FishId; className?: string }) {
  return <span className={`sheet-art fish-art ${className}`} data-tile={fishTiles[species]} aria-hidden="true" />;
}

export function FishSprite({ species, vertical = false }: { species: FishId; vertical?: boolean }) {
  const index = { crucian: 0, perch: 1, pike: 2 }[species];
  const crop = { crucian: [45, 300], perch: [55, 270], pike: [110, 180] }[species];
  const height = crop[1];
  return <svg className="fish-sprite" data-species={species} data-vertical={vertical} viewBox={`0 0 ${vertical ? height : 400} ${vertical ? 400 : height}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <g transform={vertical ? `translate(${height},0) rotate(90)` : undefined}>
      <svg width="400" height={height} viewBox={`${index * 400} ${crop[0]} 400 ${height}`}><image href={fishSprites} width="1200" height="400" /></svg>
    </g>
  </svg>;
}

export function CardArt({ id }: { id: CardId }) {
  return <span className="sheet-art card-art" data-tile={cardTiles[id]} aria-hidden="true" />;
}

export function CardFace({ player, id }: { player: Player; id: CardId }) {
  const { damage, guard } = cardEffect(player, id);
  const effect = damage && guard ? 'Приём' : damage ? 'Атака' : guard ? 'Защита' : 'Тактика';
  return (
    <span className="card-face" data-rarity={id} data-type={damage && !guard ? 'attack' : 'skill'}>
      <b className="energy-cost" aria-label={`Стоимость: ${cards[id].cost} энергии`}>{cards[id].cost}</b>
      <strong className="card-name">{cards[id].name}</strong>
      <span className="card-picture"><CardArt id={id} /></span>
      <span className="card-kind">{effect}</span>
      <span className="card-values">
        {damage > 0 && <span data-effect="damage">Наносит <b>{damage} урона.</b></span>}
        {guard > 0 && <span data-effect="guard">Даёт <b>{guard} защиты.</b></span>}
        {cards[id].draw > 0 && <span data-effect="draw">Возьмите <b>{cards[id].draw} карты.</b></span>}
      </span>
    </span>
  );
}

export function ActiveDeck({ player }: { player: Player }) {
  return <div className="deck-faces">{player.deck.map((id, index) => <CardFace key={index} player={player} id={id} />)}</div>;
}
