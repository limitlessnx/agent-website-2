/* A fixture-only wall clock. Never loaded by production application code. */
const ActualDate = Date;
const instant = ActualDate.parse("2026-11-17T08:00:00Z");
globalThis.Date = new Proxy(ActualDate, {
  construct(target, args, newTarget) { return Reflect.construct(target, args.length ? args : [instant], newTarget); },
  apply() { return new ActualDate(instant).toString(); },
  get(target, key) { return key === "now" ? () => instant : Reflect.get(target, key); },
});
