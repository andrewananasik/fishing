import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useGame } from './api.ts';
import { Dock, Leaderboard, MapScreen, Market } from './Dock.tsx';
import { Fishing, FishingResults } from './Fishing.tsx';
import './design-tokens.css';
import './style.css';
import './scenes.css';
import { RoomDialog } from './Dialog.tsx';
import './expedition.css';
import { SoundToggle, useInterfaceSound } from './Sound.tsx';
import './navigation.css';
import './tackle.css';
import './interface.css';
import './cards.css';
import './card-typography.css';
import './multiplayer.css';

type Page = 'dock' | 'map' | 'market' | 'rank';

function App() {
  useInterfaceSound();
  const { view, offset, busy, error, refresh, join, send, room, connection } = useGame();
  const [page, setPage] = useState<Page>('dock');
  const [nickname, setNickname] = useState('');
  const [seenResult, setSeenResult] = useState<number | null>(null);
  const player = view?.player;
  const result = player?.result && player.result.startedAt !== seenResult ? player.result : null;
  const screen = player?.trip ? (player.trip.battle ? 'battle' : player.trip.pending ? 'catch' : 'water') : result ? 'result' : page;

  useEffect(() => { window.scrollTo(0, 0); }, [screen]);

  function navigate(next: Page) {
    if (result) setSeenResult(result.startedAt);
    setPage(next);
  }

  return (
    <>
      <svg width="0" height="0" className="sprite-filters" aria-hidden="true"><defs><filter id="sprite-cutout" colorInterpolationFilters="sRGB"><feComponentTransfer><feFuncA type="linear" slope="8" intercept="-5" /></feComponentTransfer></filter></defs></svg>
      <a className="skip-link" href="#game">К игре</a>
      <div className="sound-control"><SoundToggle /></div>
      <main className={player ? 'scene-main' : 'shell main'} id="game">
        {error && <div className="error row wrap" role="alert"><span>{error}</span><button onClick={() => void refresh()}>Обновить состояние</button></div>}
        {!view && !error && <p>Загрузка…</p>}
        {view && !player && <div className="join-stage"><section className="panel join">
          <span className="eyebrow">Болотная рыбалка</span>
          <h1>Кто выходит на воду?</h1>
          <p className="join-intro">Тихая заводь, хитрая рыба и ваша колода. Соберите снасти и отправляйтесь за первым уловом.</p>
          <form onSubmit={(event) => { event.preventDefault(); if (nickname.trim()) void join(nickname); }}>
            <label htmlFor="nickname">Имя в рейтинге</label>
            <input id="nickname" name="nickname" placeholder="Ваше имя" value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={24} required autoComplete="nickname" aria-describedby="nickname-hint" />
            <button className="primary" disabled={busy || !nickname.trim()}>На причал</button>
          </form>
          <p className="join-note" id="nickname-hint">До 24 символов. Имя увидят другие рыбаки на воде и в рейтинге.</p>
        </section></div>}
        {player && (player.trip ? <Fishing player={player} trip={player.trip} busy={busy} send={send} offset={offset} room={room} connection={connection} /> :
          result ? <FishingResults result={result} market={() => navigate('market')} rank={() => navigate('rank')} dock={() => navigate('dock')} /> :
          page === 'market' ? <Market player={player} busy={busy} send={send} back={() => navigate('dock')} /> :
          <Dock player={player} busy={busy} send={send} openMap={() => navigate('map')} openMarket={() => navigate('market')} openRank={() => navigate('rank')} />)}
        {player && !player.trip && !result && page === 'map' && <RoomDialog title="Карта болота" className="map-dialog" close={() => navigate('dock')}><MapScreen player={player} busy={busy} send={send} /></RoomDialog>}
        {player && !player.trip && !result && page === 'rank' && <RoomDialog title="Доска лидеров" close={() => navigate('dock')}><Leaderboard /></RoomDialog>}
      </main>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
