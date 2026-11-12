"use client";
import { useCallback, useEffect, useState } from "react";

type Category = { id: string; name: string; created_at: string };
const endpoint = "/api/dashboard/gencouv/categories";

export default function GencouvCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    const response = await fetch(endpoint, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to load categories.");
    setCategories(result.categories || []);
  }, []);
  useEffect(() => { void load().catch(e => setError(e.message)); }, [load]);
  async function mutate(method: "POST" | "PATCH" | "DELETE", body: object) {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(endpoint, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Category update failed.");
      await load();
      setNotice(method === "POST" ? "Category created." : method === "PATCH" ? "Category renamed." : "Category deleted. Contacts were preserved.");
      if (method === "POST") setName("");
    } catch (e) { setError(e instanceof Error ? e.message : "Category update failed."); }
    finally { setBusy(false); }
  }
  return <section aria-labelledby="gencouv-categories-heading" style={{border:"1px solid var(--border, #d9dfe7)",borderRadius:16,padding:20,marginTop:24}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
      <div><h2 id="gencouv-categories-heading" style={{margin:0}}>Manage lead categories</h2><p style={{opacity:.7,margin:"6px 0 0"}}>Create your own tags for audience segmentation and reporting.</p></div>
      <span style={{fontSize:13,opacity:.7}}>{categories.length} categories</span>
    </div>
    <form onSubmit={e=>{e.preventDefault();void mutate("POST",{name});}} style={{display:"flex",gap:8,marginTop:18,flexWrap:"wrap"}}>
      <input aria-label="New category name" placeholder="e.g. Trading, Ghana, VIP" value={name} maxLength={80} onChange={e=>setName(e.target.value)} style={{flex:"1 1 180px",minWidth:0,padding:12,borderRadius:10,border:"1px solid #aab3c0",color:"#111",background:"#fff"}}/>
      <button type="submit" disabled={busy||!name.trim()} style={{padding:"10px 18px",borderRadius:10,background:"#111827",color:"white",cursor:"pointer"}}>Add category</button>
    </form>
    {error && <p role="alert" style={{color:"#b91c1c"}}>{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <ul style={{listStyle:"none",padding:0,margin:"16px 0 0",display:"grid",gap:8}}>
      {categories.map(category=><li key={category.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,padding:12,border:"1px solid #d9dfe7",borderRadius:10,flexWrap:"wrap"}}>
        <span>{category.name}</span>
        <div style={{display:"flex",gap:8}}>
          <button type="button" disabled={busy} onClick={()=>{const next=window.prompt("Rename category",category.name);if(next!==null&&next.trim()&&next.trim()!==category.name)void mutate("PATCH",{id:category.id,name:next.trim()});}}>Rename</button>
          <button type="button" disabled={busy} onClick={()=>{if(window.confirm("Delete this category? Contacts will not be deleted."))void mutate("DELETE",{id:category.id});}}>Delete</button>
        </div>
      </li>)}
    </ul>
    {!categories.length && !error && <p style={{opacity:.7}}>No categories yet. Add your first category above.</p>}
  </section>;
}
