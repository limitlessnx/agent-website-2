'use client'

import { useState } from 'react'

export default function LeoFloatingButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        aria-label="Open Agent Leo"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-[90] flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-slate-950 text-white shadow-2xl shadow-black/30 transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white/40"
      >
        <span className="text-sm font-semibold tracking-tight">Leo</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100]" aria-label="Agent Leo">
          <button
            type="button"
            aria-label="Close Agent Leo"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/30"
          />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div>
                <div className="font-semibold text-slate-950 dark:text-white">Agent Leo</div>
                <div className="text-xs text-slate-500">Fluxknight support & operations</div>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900">Close</button>
            </div>
            <div className="flex-1 p-5 text-sm text-slate-600 dark:text-slate-300">
              Leo is ready. Your dashboard context will be available here.
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
