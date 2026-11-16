import type { Player } from './types.ts';

export const quests = [
  { id: 'first', name: 'Первый заказ', description: 'Привезите любую рыбу на причал.', count: 1, species: null, gold: 7 },
  { id: 'basket', name: 'Рыба к ужину', description: 'Привезите 3 рыбы. Можно за несколько вылазок.', count: 3, species: null, gold: 15 },
  { id: 'perch', name: 'Полосатый трофей', description: 'Привезите одного окуня.', count: 1, species: 'perch', gold: 18 },
  { id: 'pike', name: 'Хозяйка омута', description: 'Привезите одну щуку.', count: 1, species: 'pike', gold: 25 },
] as const;

export function currentQuest(player: Player) {
  return quests.find(quest => quest.id === player.activeQuest?.id);
}

export function migratePlayer(player: Player) {
  if (!player.completedQuests) player.completedQuests = player.orderDone ? ['first'] : [];
  if (player.activeQuest === undefined) player.activeQuest = player.orderDone ? null : { id: 'first', progress: 0 };
  return player;
}
