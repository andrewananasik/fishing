import { Icon } from './Icon.tsx';
import { useRef, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';
import { fish } from '../shared/content.ts';
import { gridSize, occupiedCells, placementFits } from '../shared/game.ts';
import type { Player, Trip } from '../shared/types.ts';
import type { SendAction } from './api.ts';
import { FishSprite } from './GameArt.tsx';

export function Cargo({ player, trip, busy, send }: { player: Player; trip: Trip; busy: boolean; send: SendAction }) {
  const [selection, setSelection] = useState<{id: string; rotated: boolean} | null>(null);
  const [hover, setHover] = useState<{x: number; y: number} | null>(null);
  const [notice, setNotice] = useState('');
  const [ghost, setGhost] = useState<{x: number; y: number} | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const drag = useRef<{id: string; rotated: boolean; x: number; y: number; moved: boolean} | null>(null);
  const dragged = useRef(false);
  const chosenCargo = trip.cargo.find(item => item.id === selection?.id);
  const chosen = chosenCargo ?? trip.pending;
  const rotated = chosen && selection?.id === chosen.id ? selection.rotated : chosenCargo?.rotated ?? false;
  const {width, height} = gridSize(player);
  const preview = chosen && hover ? {...chosen, ...hover, rotated} : null;
  const valid = preview && placementFits(preview, trip.cargo, width, height);
  const cells = preview ? occupiedCells(preview) : [];
  const used = trip.cargo.reduce((sum,item) => sum + fish[item.species].length,0);

  function target(event: PointerEvent) {
    const bounds = grid.current?.getBoundingClientRect();
    if (!bounds || event.clientX < bounds.left || event.clientY < bounds.top || event.clientX >= bounds.right || event.clientY >= bounds.bottom) return null;
    return {x: Math.floor((event.clientX - bounds.left) / bounds.width * width), y: Math.floor((event.clientY - bounds.top) / bounds.height * height)};
  }
  async function place(id: string, x: number, y: number, turn: boolean) {
    const item = trip.pending?.id === id ? trip.pending : trip.cargo.find(entry => entry.id === id);
    if (!item || busy) return;
    if (!placementFits({...item,x,y,rotated:turn},trip.cargo,width,height)) { setNotice('Здесь не хватает места. Поверните рыбу или выберите другую клетку.'); return; }
    if (await send({type:'place',id,x,y,rotated:turn})) { setSelection(null); setHover(null); setNotice('Рыба уложена в трюм.'); }
  }
  function begin(event: PointerEvent<HTMLButtonElement>, id: string, turn: boolean) {
    if (busy || event.button !== 0 || !event.isPrimary) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {id,rotated:turn,x:event.clientX,y:event.clientY,moved:false};
    dragged.current = false;
    setSelection({id,rotated:turn}); setNotice('');
  }
  function move(event: PointerEvent) {
    const active = drag.current;
    if (!active) return;
    if (Math.hypot(event.clientX-active.x,event.clientY-active.y)>5) active.moved = true;
    if (active.moved) { setGhost({x:event.clientX,y:event.clientY}); setHover(target(event)); }
  }
  function end(event: PointerEvent) {
    const active = drag.current;
    drag.current=null; setGhost(null);
    if (!active?.moved) return;
    dragged.current=true;
    const cell=target(event);
    if (cell) void place(active.id,cell.x,cell.y,active.rotated);
    else setHover(null);
  }
  function cancel() { drag.current=null; setGhost(null); setHover(null); }
  function selectable(id: string, turn: boolean) {
    return {onPointerDown:(event:PointerEvent<HTMLButtonElement>)=>begin(event,id,turn),onPointerMove:move,onPointerUp:end,onPointerCancel:cancel,
      onClick:()=>{if(dragged.current){dragged.current=false;return;} setSelection({id,rotated:turn});}};
  }
  return <section className="cargo-interior" data-sound="wood">
    <div className="row spread"><span>Лодка · уровень {player.upgrades.includes('boat') ? 2 : 1}</span><strong>Занято {used} / {width*height} · свободно {width*height-used}</strong></div>
    <p>Перетащите рыбу в трюм. Или выберите рыбу, затем свободную клетку.</p>
    <div className="cargo-workspace">
      <div className="cargo-grid spatial-grid" ref={grid} style={{gridTemplateColumns:`repeat(${width},1fr)`}} onMouseLeave={()=>{if(!drag.current)setHover(null);}}>
        {Array.from({length:width*height},(_,index)=>{
          const x=index%width,y=Math.floor(index/width);
          const highlighted=cells.some(cell=>cell.x===x&&cell.y===y);
          const occupied=trip.cargo.some(item=>occupiedCells(item).some(cell=>cell.x===x&&cell.y===y));
          return <button key={index} className="cell" data-occupied={occupied} data-valid={highlighted ? Boolean(valid) : undefined} disabled={busy}
            aria-label={`Ячейка ${x+1}, ${y+1}`} onMouseEnter={()=>setHover({x,y})} onFocus={()=>setHover({x,y})}
            onClick={()=>{if(chosen)void place(chosen.id,x,y,rotated);}}><span className="cell-dot" aria-hidden="true" /></button>;
        })}
        {trip.cargo.map(item=><button key={item.id} className="cargo-fish" data-selected={chosen?.id===item.id} disabled={busy}
          aria-label={`Переложить: ${fish[item.species].name}`} {...selectable(item.id,chosen?.id===item.id?rotated:item.rotated)}
          style={{'--fish-length':fish[item.species].length,left:`${item.x/width*100}%`,top:`${item.y/height*100}%`,width:`${(item.rotated?1:fish[item.species].length)/width*100}%`,height:`${(item.rotated?fish[item.species].length:1)/height*100}%`} as CSSProperties}>
          <FishSprite species={item.species} vertical={item.rotated} />
        </button>)}
        {preview && <div className="cargo-fish cargo-preview" data-valid={Boolean(valid)} aria-hidden="true"
          style={{left:`${preview.x/width*100}%`,top:`${preview.y/height*100}%`,width:`${(rotated?1:fish[preview.species].length)/width*100}%`,height:`${(rotated?fish[preview.species].length:1)/height*100}%`}}>
          <FishSprite species={preview.species} vertical={rotated} />
        </div>}
      </div>
      <div className="cargo-catch">
        <h3>{trip.pending ? 'Новый улов' : 'Размещение улова'}</h3>
        {trip.pending ? <button className="pending-fish" disabled={busy} aria-label={`Перетащить: ${fish[trip.pending.species].name}`} {...selectable(trip.pending.id,chosen?.id===trip.pending.id?rotated:false)}><FishSprite species={trip.pending.species} /><strong>{fish[trip.pending.species].name}</strong><small>{fish[trip.pending.species].length} кл. · перетащите в трюм</small></button> : <p className="meta">Нажмите на рыбу в трюме, чтобы переложить или повернуть её.</p>}
        {chosen && <div className="stack cargo-actions"><span>{fish[chosen.species].name} · {fish[chosen.species].length} кл.</span><button className="icon-label" disabled={busy||fish[chosen.species].length===1} onClick={()=>setSelection({id:chosen.id,rotated:!rotated})}><Icon name="rotate-clockwise" />Повернуть</button><button disabled={busy} onClick={()=>void send({type:'discard',id:chosen.id}).then(result=>{if(result){setSelection(null);setNotice('Рыба отпущена.');}})}>Отпустить рыбу</button></div>}
      </div>
    </div>
    <p className="cargo-notice" role="status">{notice || (preview && !valid ? 'Рыба не помещается в выбранные клетки.' : 'Рыба занимает от 1 до 3 клеток. Размещайте улов без пересечений.')}</p>
    {ghost && chosen && !hover && <div className="drag-fish" style={{left:ghost.x,top:ghost.y}} aria-hidden="true"><FishSprite species={chosen.species} vertical={rotated} /></div>}
  </section>;
}
