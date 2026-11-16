// Visual review fixtures only. Never reads or writes the player's fishing.sqlite.
// Start server with FISHING_DB=data/design-review.sqlite and PORT=4174,
// create a profile there, then run: node scripts/design-fixture.ts battle
import { DatabaseSync } from 'node:sqlite';
import { newPlayer, applyAction } from '../shared/game.ts';
import { approach, fishingTargets } from '../shared/navigation.ts';
const mode = process.argv[2] ?? 'dock';
if (!['dock','water','battle','catch','win','lose','result'].includes(mode)) throw new Error('Unknown review fixture');
const db = new DatabaseSync('data/design-review.sqlite');
const sessions = db.prepare('SELECT session FROM players').all();
if (!sessions.length) throw new Error('Create a profile on port 4174 first');
const now = Date.now();
const player = newPlayer('РыбакСОченьДлиннымИменем');
player.gold = 12345;
player.collection.push('sharp','firm','steady');
player.stock = [{id:'review-perch',species:'perch'},{id:'review-pike',species:'pike'}];
player.lastRoll = {id:'review-roll',species:'perch',card:'sharp',duplicateGold:0};
player.bestScore = 1234;
player.bestAt = now;
if (mode !== 'dock' && mode !== 'result') {
  applyAction(player,{type:'start',spot:'reeds',bait:'worm'},{now,random:()=>.99,nextId:()=> 'review-catch'});
  const trip = player.trip!;
  trip.boat = approach(fishingTargets('reeds')[0]);
  trip.deadline = now + 60*60*1000;
  if (mode === 'battle') {
    trip.bite = {zone:2,opensAt:now-10,closesAt:now+100};
    applyAction(player,{type:'hook'},{now,random:()=>.99,nextId:()=> 'review-catch'});
  }
  if (mode === 'catch' || mode === 'win') {
    trip.pending = {id:'review-catch',species:'pike'};
    trip.cargo = [{id:'review-placed',species:'perch',x:0,y:0,rotated:false}];
    if (mode === 'win') { trip.outcome={species:'pike',win:true,message:'Щука выдохлась. Уложите улов в трюм.'}; trip.pausedAt=now; }
  }
  if (mode === 'lose') { trip.outcome={species:'pike',win:false,message:'Леска оборвалась. Рыба ушла, но вы можете попробовать снова.'}; trip.pausedAt=now; }
}
if (mode === 'result') player.result = {spot:'reeds',startedAt:now,seconds:214,cargo:player.stock,score:70,record:true,orderGold:0};
const write = db.prepare('UPDATE players SET state = ? WHERE session = ?');
for (const {session} of sessions) write.run(JSON.stringify(player),session);
db.close();
console.log(`Isolated design fixture: ${mode}`);
