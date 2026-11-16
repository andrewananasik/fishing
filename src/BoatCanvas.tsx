import { useEffect, useRef } from 'react';
import type { BaitId, SpotId } from '../shared/content.ts';
import type { Trip } from '../shared/types.ts';
import { boatAt, fishingTargets, headingFrame, launchPosition } from '../shared/navigation.ts';
import type { Point } from '../shared/navigation.ts';
import atlasUrl from './art/boat-directions.png';
import type { Appearance, RoomSnapshot } from '../shared/multiplayer.ts';
import { boatAppearance } from './boatAppearance.ts';

type Props = { spot: SpotId; position?: Point; heading?: number; moving?: boolean; bite?: Trip['bite']; fightZone?: number | null; bait?: BaitId; offset?: number; appearance?: Appearance; room?: RoomSnapshot | null };
type Wake = { x: number; y: number; heading: number; at: number; side: number };

export function FishingRig({ spot, position = launchPosition(spot), heading = -Math.PI / 4, moving = false, bite = null, fightZone = null, bait = 'worm', offset = 0, appearance, room }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const state = useRef({ spot, position, heading, moving, bite, fightZone, bait, offset, appearance, room });
  state.current = { spot, position, heading, moving, bite, fightZone, bait, offset, appearance, room };
  useEffect(() => {
    const surface = canvas.current;
    const ctx = surface?.getContext('2d');
    if (!surface || !ctx) return;
    const atlas = new Image();
    atlas.src = atlasUrl;
    let width = 0, height = 0, frame = 0, lastTime = 0;
    const animations = new Map<string, { direction: number; lastBite: number | null; flightAt: number; lastWake: number; wakes: Wake[] }>();
    const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
    const dpr = Math.min(devicePixelRatio, 2);
    function measure() {
      const rect = surface!.getBoundingClientRect();
      width = rect.width; height = rect.height;
      surface!.width = Math.round(width * dpr); surface!.height = Math.round(height * dpr);
    }
    function draw(t: number) {
      const current = state.current;
      const now = Date.now() + current.offset;
      const rigs = (current.room?.fishers ?? []).filter(fisher => fisher.id !== current.room?.selfId).map(fisher => ({
        ...fisher, position: boatAt(fisher, now), moving: Boolean(fisher.voyage && now < fisher.voyage.arrivesAt), offset: current.offset,
      }));
      const all = [...rigs, { ...current, id: 'self', connected: true }];
      const ids = new Set(all.map(rig => rig.id));
      for (const id of animations.keys()) if (!ids.has(id)) animations.delete(id);
      const reduced = motionQuery.matches;
      const dt = Math.min(50, t - (lastTime || t)); lastTime = t;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, width, height);
      for (const s of all) {
      let animation = animations.get(s.id);
      if (!animation) {
        animation = { direction: s.heading, lastBite: null, flightAt: 0, lastWake: 0, wakes: [] };
        animations.set(s.id, animation);
      }
      let { direction, lastBite, flightAt, lastWake, wakes } = animation;
      const turn = Math.atan2(Math.sin(s.heading - direction), Math.cos(s.heading - direction));
      direction += reduced ? turn : Math.sign(turn) * Math.min(Math.abs(turn), dt * .009);
      const boatSize = width * (width < 650 ? .14 : .095);
      const x = s.position.x * width, y = s.position.y * height;
      const dx = Math.cos(direction), dy = Math.sin(direction);
      if (width && height && !document.hidden) {
        ctx!.globalAlpha = s.connected ? 1 : .45;
        // Wake samples stay in world coordinates after the boat has moved away.
        if (s.moving && !reduced && t - lastWake > 110) {
          wakes.push({ x: (x - dx * boatSize * .28) / width, y: (y - dy * boatSize * .24) / height, heading: direction, at: t, side: 0 });
          if (Math.sin(t / 200) > .9) for (const side of [-1, 1]) wakes.push({ x: (x - dy * side * boatSize * .5) / width, y: (y + dx * side * boatSize * .35) / height, heading: direction, at: t, side });
          lastWake = t;
        }
        wakes = reduced ? [] : wakes.filter(w => t - w.at < 3600);
        for (const w of wakes) {
          const age = (t - w.at) / 3600;
          ctx!.save(); ctx!.translate(w.x * width, w.y * height);
          ctx!.rotate(w.heading);
          ctx!.strokeStyle = `rgba(218,235,204,${(1 - age) * (w.side ? .24 : .34)})`;
          ctx!.lineWidth = Math.max(.7, width / 1700);
          ctx!.beginPath();
          if (w.side) ctx!.ellipse(0, 0, 3 + age * 20, 2 + age * 10, 0, 0, Math.PI * 2);
          else {
            const spread = boatSize * (.08 + age * .18);
            ctx!.moveTo(-spread * .65, -spread);
            ctx!.quadraticCurveTo(spread * .2, 0, -spread * .65, spread);
          }
          ctx!.stroke(); ctx!.restore();
        }
        // Oars sweep around their rowlocks; the stroke ends leave small ripples.
        if (s.moving) {
          const stroke = reduced ? 0 : Math.sin(t / 200) * .48;
          for (const side of [-1, 1]) {
            const pivotX = x - dy * side * boatSize * .17;
            const pivotY = y + dx * side * boatSize * .12;
            const angle = direction + side * (Math.PI / 2 + stroke);
            const endX = pivotX + Math.cos(angle) * boatSize * .48;
            const endY = pivotY + Math.sin(angle) * boatSize * .36;
            ctx!.lineCap = 'round';
            ctx!.beginPath(); ctx!.moveTo(pivotX, pivotY); ctx!.lineTo(endX, endY);
            ctx!.strokeStyle = '#372b17'; ctx!.lineWidth = Math.max(3, boatSize * .024); ctx!.stroke();
            ctx!.strokeStyle = '#bb945c'; ctx!.lineWidth = Math.max(1.5, boatSize * .012); ctx!.stroke();
            ctx!.beginPath(); ctx!.moveTo(endX, endY);
            ctx!.lineTo(endX + Math.cos(angle) * boatSize * .13, endY + Math.sin(angle) * boatSize * .1);
            ctx!.strokeStyle = '#b89b68'; ctx!.lineWidth = Math.max(4, boatSize * .045); ctx!.stroke();
          }
        }
        if (atlas.complete && atlas.naturalWidth) {
          const index = headingFrame(direction);
          const cellW = atlas.naturalWidth / 4, cellH = atlas.naturalHeight / 2;
          ctx!.save();
          ctx!.filter = 'url(#sprite-cutout)';
          ctx!.shadowColor = '#061c1770'; ctx!.shadowBlur = 5; ctx!.shadowOffsetY = 5;
          ctx!.drawImage(boatAppearance(atlas, s.appearance), index % 4 * cellW, Math.floor(index / 4) * cellH, cellW, cellH, x - boatSize / 2, y - boatSize / 2, boatSize, boatSize);
          ctx!.restore();
        }
        const target = s.bite?.position ?? (s.fightZone !== null ? fishingTargets(s.spot)[s.fightZone] : null);
        if (s.bite && lastBite !== s.bite.opensAt) flightAt = t;
        lastBite = s.bite?.opensAt ?? null;
        if (target) {
          const handX = x, handY = y - boatSize * .035;
          const angle = Math.atan2(target.y * height - handY, target.x * width - handX);
          const tipX = handX + Math.cos(angle) * boatSize * .5;
          const tipY = handY + Math.sin(angle) * boatSize * .5 - boatSize * .18;
          ctx!.beginPath(); ctx!.moveTo(handX, handY); ctx!.quadraticCurveTo(handX, tipY, tipX, tipY);
          ctx!.strokeStyle = '#352917'; ctx!.lineWidth = 3; ctx!.stroke();
          ctx!.strokeStyle = '#d2b47c'; ctx!.lineWidth = 1.2; ctx!.stroke();
          const flight = reduced ? 1 : Math.min(1, (t - flightAt) / 480);
          const catching = s.bite && Date.now() + s.offset >= s.bite.opensAt;
          const bob = s.bite && !reduced ? Math.sin(t / (catching ? 65 : 260)) * (catching ? 2.5 : .8) : 0;
          const bx = tipX + (target.x * width - tipX) * flight;
          const by = tipY + (target.y * height - tipY) * flight - Math.sin(flight * Math.PI) * 80 + bob;
          ctx!.beginPath(); ctx!.moveTo(tipX, tipY); ctx!.quadraticCurveTo((tipX + bx) / 2, Math.min(tipY, by) - 16, bx, by);
          ctx!.strokeStyle = '#eee1baab'; ctx!.lineWidth = 1; ctx!.stroke();
          ctx!.beginPath(); ctx!.ellipse(bx, by + 4, 12 + Math.sin(t / 250) * 3, 4, 0, 0, Math.PI * 2);
          ctx!.strokeStyle = '#ddedc980'; ctx!.stroke();
          ctx!.fillStyle = '#f3ead1'; ctx!.beginPath(); ctx!.ellipse(bx, by, 3.5, 6, 0, 0, Math.PI * 2); ctx!.fill();
          ctx!.fillStyle = s.bait === 'worm' ? '#df825d' : '#e7bd68'; ctx!.beginPath(); ctx!.ellipse(bx, by - 3, 3, 3, 0, 0, Math.PI * 2); ctx!.fill();
        }
      }
      Object.assign(animation, { direction, lastBite, flightAt, lastWake, wakes });
      }
      ctx!.globalAlpha = 1;
      frame = requestAnimationFrame(draw);
    }
    const resize = new ResizeObserver(measure); resize.observe(surface); measure();
    frame = requestAnimationFrame(draw);
    return () => { resize.disconnect(); cancelAnimationFrame(frame); };
  }, []);
  return <canvas className="rig-canvas boat-canvas" ref={canvas} aria-hidden="true" data-heading={headingFrame(heading)} data-moving={moving} />;
}
