import Link from 'next/link';
import type {HTMLAttributes,InputHTMLAttributes,MouseEventHandler,ReactNode,SelectHTMLAttributes,TextareaHTMLAttributes} from 'react';
import styles from './DashboardPrimitives.module.css';
import Button from '@/components/Button';
export {Button};
export {default as MetricCard} from '@/components/admin/MetricCard';
export type StatusTone='neutral'|'success'|'warning'|'error'|'info';
export function DashboardCard({children,className='',...props}:HTMLAttributes<HTMLElement>){
  return <section {...props} className={`${styles.card} ${className}`}>{children}</section>;
}
export function CardHeader({title,description,actions}:{title:string;description?:string;actions?:ReactNode}){
  return <header className={styles.cardHeader}><div><h2>{title}</h2>{description&&<p className={styles.description}>{description}</p>}</div>{actions&&<div className={styles.actions}>{actions}</div>}</header>;
}
export function PageHeader({title,kicker,description,actions}:{title:string;kicker?:string;description?:string;actions?:ReactNode}){
  return <header className={styles.pageHeader}><div>{kicker&&<p className={styles.kicker}>{kicker}</p>}<h1>{title}</h1>{description&&<p className={styles.description}>{description}</p>}</div>{actions&&<div className={styles.actions}>{actions}</div>}</header>;
}
export function StatusBadge({children,tone='neutral'}:{children:ReactNode;tone?:StatusTone}){
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>;
}
type FieldBase={id:string;label:string;hint?:string;error?:string};
function describedBy(id:string,hint?:string,error?:string,extra?:string){return [hint&&`${id}-hint`,error&&`${id}-error`,extra].filter(Boolean).join(' ')||undefined;}
function FieldMessage({id,hint,error}:Pick<FieldBase,'id'|'hint'|'error'>){return <>{hint&&<small id={`${id}-hint`} className={styles.hint}>{hint}</small>}{error&&<small id={`${id}-error`} className={styles.errorText}>{error}</small>}</>;}
export function InputField({label,hint,error,id,...props}:FieldBase&InputHTMLAttributes<HTMLInputElement>){
  return <label className={styles.field} htmlFor={id}><span>{label}</span><input {...props} id={id} aria-invalid={error?true:props['aria-invalid']} aria-describedby={describedBy(id,hint,error,props['aria-describedby'])}/><FieldMessage id={id} hint={hint} error={error}/></label>;
}
export function SelectField({label,hint,error,id,children,...props}:FieldBase&SelectHTMLAttributes<HTMLSelectElement>){
  return <label className={styles.field} htmlFor={id}><span>{label}</span><select {...props} id={id} aria-invalid={error?true:props['aria-invalid']} aria-describedby={describedBy(id,hint,error,props['aria-describedby'])}>{children}</select><FieldMessage id={id} hint={hint} error={error}/></label>;
}
export function TextareaField({label,hint,error,id,...props}:FieldBase&TextareaHTMLAttributes<HTMLTextAreaElement>){
  return <label className={styles.field} htmlFor={id}><span>{label}</span><textarea {...props} id={id} aria-invalid={error?true:props['aria-invalid']} aria-describedby={describedBy(id,hint,error,props['aria-describedby'])}/><FieldMessage id={id} hint={hint} error={error}/></label>;
}
export function DataTable({label,children}:{label:string;children:ReactNode}){return <div className={styles.tableRegion} role="region" aria-label={label} tabIndex={0}><table>{children}</table></div>;}
export function EmptyState({title,description,action}:{title:string;description:string;action?:ReactNode}){return <div className={styles.empty}><h2>{title}</h2><p className={styles.description}>{description}</p>{action}</div>;}
export function LoadingSkeleton({label='Loading',lines=3}:{label?:string;lines?:number}){return <div role="status" aria-label={label}><span className="sr-only">{label}</span><div aria-hidden="true" className={styles.grid}>{Array.from({length:Math.max(1,Math.min(lines,12))},(_,index)=><span key={index} className={styles.skeleton}/>)}</div></div>;}
export function NavigationItem({href,active,children,onClick}:{href:string;active?:boolean;children:ReactNode;onClick?:MouseEventHandler<HTMLAnchorElement>}){return <Link href={href} onClick={onClick} className={`${styles.navItem} ${active?'active':''}`} aria-current={active?'page':undefined}>{children}</Link>;}
export function SearchFilters({children,action,label='Search',name='q',defaultValue=''}:{children?:ReactNode;action?:string;label?:string;name?:string;defaultValue?:string}){return <form role="search" method="get" action={action} className={styles.search}><label><span>{label}</span><input type="search" name={name} defaultValue={defaultValue}/></label>{children}<Button type="submit">Search</Button></form>;}
export function DashboardGrid({children}:{children:ReactNode}){return <div className={styles.grid}>{children}</div>;}
