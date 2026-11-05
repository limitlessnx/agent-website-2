import type { HotelReservation } from "./hotel-booking-contract";
export type HotelDailyStay = Pick<HotelReservation,"id"|"revision"|"status"|"arrival_date"|"departure_date"|"guest_count"> & {guest_name:string;room_name:string|null;room_type:string|null};
export type HotelOverviewCore = {
  arrivals_count:number;departures_count:number;occupied_rooms:number;active_rooms:number;enquiries_count:number;overdue_departures:number;
  arrivals:HotelDailyStay[];departures:HotelDailyStay[];enquiries:Array<{id:string;guest_name:string;status:string}>;overdue_stays:Array<{id:string;guest_name:string}>;
  availability:Array<{id:string;name:string;capacity:number;nightly_rate_minor:string|number;currency:string;available_rooms:number;active_rooms:number}>;
};
export type HotelOverviewData = HotelOverviewCore & {
  day:string;timeZone:string;timeZoneFallback:boolean;checkedAt:string;range:{arrival:string;departure:string;guests:number};
  pendingPayments:number|null;pendingRecords:Array<{id:string;booking_id:string}>;handoffs:number|null;conversations:Array<{id:string;guest_name:string;channel:string;status:string;updated_at:string;preview:string}>|null;
  canManage:boolean;canViewPayments:boolean;canViewConversations:boolean;canViewHandoffs:boolean;
};
export function hotelLocalDay(timeZone:unknown,now=new Date()) {
  let zone=typeof timeZone==="string"?timeZone.trim():"",fallback=false;
  try {if(!zone)throw new Error("Missing timezone");new Intl.DateTimeFormat("en",{timeZone:zone}).format(now);}catch{zone="UTC";fallback=true;}
  const parts=new Intl.DateTimeFormat("en",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
  const get=(key:string)=>parts.find(part=>part.type===key)?.value;
  return {day:`${get("year")}-${get("month")}-${get("day")}`,timeZone:zone,timeZoneFallback:fallback};
}
export function hotelNextDay(day:string) {const date=new Date(`${day}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+1);return date.toISOString().slice(0,10);}
