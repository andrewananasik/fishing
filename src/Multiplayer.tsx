import type { CSSProperties } from 'react';
import { boatAt } from '../shared/navigation.ts';
import { activityLabels, coatColors } from '../shared/multiplayer.ts';
import type { RoomSnapshot } from '../shared/multiplayer.ts';
import { useNow } from './api.ts';

export function OtherFishers({ room, offset }: { room: RoomSnapshot | null; offset: number }) {
  const now = useNow(offset, 50, Boolean(room?.fishers.some(fisher => fisher.voyage && Date.now() + offset < fisher.voyage.arrivesAt)));
  if (!room) return null;
  return <div className="other-fishers" aria-label="Другие рыбаки на локации">
    {room.fishers.filter(fisher => fisher.id !== room.selfId).map(fisher => {
      const position = boatAt(fisher, now);
      const moving = Boolean(fisher.voyage && now < fisher.voyage.arrivesAt);
      const activity = fisher.activity === 'rowing' && !moving ? 'idle' : fisher.activity;
      return <div key={fisher.id} className="remote-fisher" data-connected={fisher.connected}>
        <div className="fisher-name" data-activity={activity} title={`${fisher.nickname} · ${activityLabels[activity]}`} style={{ left: `${position.x * 100}%`, top: `${position.y * 100}%`, '--fisher-color': coatColors[fisher.appearance.coat] } as CSSProperties}>
          <bdi>{fisher.nickname}</bdi><span>{fisher.connected ? activityLabels[activity] : 'Переподключается…'}</span>
        </div>
      </div>;
    })}
  </div>;
}

export function FishingCompany({ room, connection }: { room: RoomSnapshot | null; connection: 'connecting' | 'online' | 'reconnecting' }) {
  const online = connection === 'online' && room;
  return <div className="fishing-company" data-online={Boolean(online)} role="status">
    <i aria-hidden="true" />
    {online ? <>Рыбаки: {room.fishers.length} / {room.capacity}<span>Общая локация</span></>
      : connection === 'reconnecting' ? 'Восстанавливаем связь с рыбаками…' : 'Подключаемся к рыбакам…'}
  </div>;
}
