import { Icon } from './Icon.tsx';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { SoundToggle } from './Sound.tsx';
import { playSound } from './sound.ts';

export function RoomDialog({ title, close, children, className = '' }: { title: string; close?: () => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog ref={ref} className={`room-dialog ${className}`} aria-label={title} onCancel={(event) => { event.preventDefault(); if (close) { playSound('close'); close(); } }}>
    <div className="room-dialog-heading"><h2>{title}</h2><SoundToggle compact />{close && <button className="dialog-close icon-label" data-sound="close" aria-label="Закрыть окно" onClick={close}><span className="close-label">Закрыть</span><Icon name="x" /></button>}</div>
    {children}
  </dialog>;
}
