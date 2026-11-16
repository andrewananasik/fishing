import { Icon } from './Icon.tsx';
import { useEffect, useSyncExternalStore } from 'react';
import { playSound, setSoundEnabled, soundEnabled, soundClips, subscribeSound, suspendSound, unlockSound } from './sound.ts';
import type { Sound } from './sound.ts';

const selector = 'button, a[href], input[type="radio"], label.option';
function control(target: EventTarget | null) {
  const element = target instanceof Element ? target.closest<HTMLElement>(selector) : null;
  return element && !element.matches(':disabled, [aria-disabled="true"]') && !element.closest('[inert]') ? element : null;
}
function cue(element: HTMLElement): Sound | null {
  const value = element.closest<HTMLElement>('[data-sound]')?.dataset.sound;
  if (value === 'none') return null;
  return value && Object.hasOwn(soundClips, value) ? value as Sound : 'click';
}

export function useInterfaceSound() {
  useEffect(() => {
    let keyboard = false;
    function pointerdown() { keyboard = false; unlockSound(); }
    function keydown(event: KeyboardEvent) {
      keyboard = event.key === 'Tab' || event.key.startsWith('Arrow');
      unlockSound();
    }
    function hover(event: PointerEvent) {
      if (event.pointerType === 'touch') return;
      const element = control(event.target);
      if (!element || (event.relatedTarget instanceof Node && element.contains(event.relatedTarget))) return;
      const sound = cue(element);
      if (sound) playSound(sound, 'hover');
    }
    function focus(event: FocusEvent) {
      if (!keyboard) return;
      const element = control(event.target);
      const sound = element && cue(element);
      if (sound) playSound(sound, 'hover');
    }
    function click(event: MouseEvent) {
      const element = control(event.target);
      if (!element || element.dataset.soundClick === 'none') return;
      // A label also dispatches a click on its input: only sound that second click.
      if (element.matches('label')) return;
      const sound = cue(element);
      if (sound) playSound(sound, 'click');
    }
    function visibility() { if (document.hidden) suspendSound(); else unlockSound(); }
    document.addEventListener('pointerdown', pointerdown, true);
    document.addEventListener('keydown', keydown, true);
    document.addEventListener('pointerover', hover, true);
    document.addEventListener('focusin', focus, true);
    document.addEventListener('click', click, true);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      document.removeEventListener('pointerdown', pointerdown, true);
      document.removeEventListener('keydown', keydown, true);
      document.removeEventListener('pointerover', hover, true);
      document.removeEventListener('focusin', focus, true);
      document.removeEventListener('click', click, true);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
}

export function SoundToggle({ compact = false }: { compact?: boolean }) {
  const enabled = useSyncExternalStore(subscribeSound, soundEnabled);
  return <button type="button" className={compact ? 'sound-toggle compact' : 'sound-toggle'} data-sound="none"
    aria-label={enabled ? 'Выключить звук' : 'Включить звук'} aria-pressed={enabled}
    title={enabled ? 'Выключить звук' : 'Включить звук'} onClick={() => setSoundEnabled(!enabled)}>
    <Icon name={enabled ? 'volume' : 'volume-off'} />
    {!compact && <span>Звук {enabled ? 'вкл.' : 'выкл.'}</span>}
  </button>;
}
