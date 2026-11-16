import { HAND_LIMIT, HAND_SIZE, starterDeck } from './content.ts';
import type { Battle, Player } from './types.ts';

export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Slots identify individual copies, so a second copy is playable but a replayed request isn't.
export function drawCards(battle: Battle, count: number, random: () => number) {
  for (let i = 0; i < count && battle.hand.length < HAND_LIMIT; i++) {
    if (!battle.drawPile.length) {
      if (!battle.discardPile.length) break;
      battle.drawPile = shuffle(battle.discardPile, random);
      battle.discardPile = [];
      battle.shuffles += 1;
    }
    battle.hand.push(battle.drawPile.pop()!);
  }
}

export function battleDeck(deck: Player['deck'], random: () => number) {
  const drawPile = shuffle(deck.map((_, index) => index), random);
  return { deck: [...deck], hand: drawPile.splice(-HAND_SIZE), drawPile, discardPile: [] as number[], shuffles: 0 };
}

export function migrateDeck(player: Player, random: () => number) {
  let changed = false;
  if (player.deck.length === 3) {
    // Keep the three equipped cards and every earned reward in old profiles.
    player.deck = [...player.deck, ...starterDeck.slice(3)];
    player.collection = [...new Set([...player.collection, ...starterDeck])];
    changed = true;
  }
  const battle = player.trip?.battle;
  if (battle && !battle.hand) {
    Object.assign(battle, battleDeck(player.deck, random));
    // Preserve already spent cards and energy when resuming an old turn.
    for (const card of battle.played ?? []) {
      const instance = battle.deck.findIndex((id, index) => id === card && !battle.discardPile.includes(index));
      if (instance < 0) continue;
      battle.hand = battle.hand.filter(index => index !== instance);
      battle.drawPile = battle.drawPile.filter(index => index !== instance);
      battle.discardPile.push(instance);
    }
    if (battle.phase === 'fish') {
      battle.discardPile.push(...battle.hand);
      battle.hand = [];
    }
    changed = true;
  }
  return changed;
}
