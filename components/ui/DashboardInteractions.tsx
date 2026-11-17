'use client';
import {useEffect,useId,useRef,useState,type ReactNode} from 'react';
import styles from './DashboardPrimitives.module.css';
import type {StatusTone} from './DashboardPrimitives';

type OverlayProps={open:boolean;onClose:()=>void;title:string;children:ReactNode};
function Overlay({open,onClose,title,children,drawer=false}:OverlayProps&{drawer?:boolean}){
  const ref=useRef<HTMLDialogElement>(null);const titleId=useId();
  useEffect(()=>{
    const dialog=ref.current;if(!dialog)return;
    if(open&&!dialog.open){dialog.showModal();}
    if(!open&&dialog.open)dialog.close();
  },[open]);
  useEffect(()=>{
    if(!open)return;
    const previous=document.body.style.overflow;document.body.style.overflow='hidden';
    return ()=>{document.body.style.overflow=previous;};
  },[open]);
  return <dialog ref={ref} className={`${styles.dialog} ${drawer?styles.drawer:''}`} aria-labelledby={titleId}
    onCancel={event=>{event.preventDefault();onClose();}} onClose={()=>{if(open)onClose();}}
    onClick={event=>{if(event.target===event.currentTarget){const rect=event.currentTarget.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)onClose();}}}>
    <header className={styles.dialogHeader}><h2 id={titleId}>{title}</h2><button type="button" className={styles.close} aria-label={`Close ${title}`} onClick={onClose}>×</button></header>{children}
  </dialog>;
}
export function Dialog(props:OverlayProps){return <Overlay {...props}/>;}
export function Drawer(props:OverlayProps){return <Overlay {...props} drawer/>;}
export function Tabs({label,items}:{label:string;items:{id:string;label:string;content:ReactNode;disabled?:boolean}[]}){
  const [selected,setSelected]=useState(items.find(item=>!item.disabled)?.id||'');const prefix=useId();const list=useRef<HTMLDivElement>(null);
  const active=items.some(item=>item.id===selected&&!item.disabled)?selected:items.find(item=>!item.disabled)?.id;
  return <div><div ref={list} role="tablist" aria-label={label} className={styles.tabs} onKeyDown={event=>{
    const keys=['ArrowRight','ArrowLeft','Home','End'];if(!keys.includes(event.key))return;event.preventDefault();
    const enabled=items.filter(item=>!item.disabled);if(!enabled.length)return;const current=enabled.findIndex(item=>item.id===active);
    const next=event.key==='Home'?0:event.key==='End'?enabled.length-1:(current+(event.key==='ArrowRight'?1:-1)+enabled.length)%enabled.length;
    setSelected(enabled[next].id);list.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')[next]?.focus();
  }}>{items.map(item=><button key={item.id} type="button" role="tab" id={`${prefix}-${item.id}-tab`} aria-controls={`${prefix}-${item.id}-panel`} aria-selected={active===item.id} tabIndex={active===item.id?0:-1} disabled={item.disabled} onClick={()=>setSelected(item.id)}>{item.label}</button>)}</div>
  {items.map(item=><div key={item.id} role="tabpanel" id={`${prefix}-${item.id}-panel`} aria-labelledby={`${prefix}-${item.id}-tab`} hidden={active!==item.id} tabIndex={0}>{item.content}</div>)}</div>;
}
export function DropdownMenu({label,children}:{label:string;children:ReactNode}){
  const ref=useRef<HTMLDetailsElement>(null);
  useEffect(()=>{const close=(event:PointerEvent)=>{if(ref.current&&!ref.current.contains(event.target as Node))ref.current.open=false;};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[]);
  return <details ref={ref} className={styles.dropdown} onToggle={event=>{
    const details=event.currentTarget;if(!details.open)return;
    const summary=details.querySelector('summary')!.getBoundingClientRect();const origin=details.getBoundingClientRect();
    const menu=details.querySelector<HTMLElement>(`.${styles.dropdownContent}`)!;const rect=menu.getBoundingClientRect();
    details.style.setProperty('--fk-menu-left',`${Math.max(16,Math.min(summary.left,innerWidth-rect.width-16))-origin.left}px`);
    details.style.setProperty('--fk-menu-top',`${Math.max(16,Math.min(summary.bottom+8,innerHeight-rect.height-16))-origin.top}px`);
  }} onKeyDown={event=>{if(event.key==='Escape'&&ref.current?.open){event.preventDefault();ref.current.open=false;ref.current.querySelector('summary')?.focus();}}}><summary>{label}</summary><div className={styles.dropdownContent} onClick={event=>{if((event.target as Element).closest('a,button')&&ref.current)ref.current.open=false;}}>{children}</div></details>;
}
export function Toast({message,tone='info',onDismiss}:{message:string;tone?:StatusTone;onDismiss?:()=>void}){
  return <div className={`${styles.toast} ${styles[tone]}`} role={tone==='error'?'alert':'status'} aria-atomic="true"><p>{message}</p>{onDismiss&&<button type="button" className={styles.close} aria-label="Dismiss notification" onClick={onDismiss}>×</button>}</div>;
}
