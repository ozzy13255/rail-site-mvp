import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
const supabase = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) : null;

export default function LineBlockages({ membership, session }) {
  const [rows, setRows] = useState([]);
  const [title, setTitle] = useState("");
  const [elr, setElr] = useState("");
  const [mileage, setMileage] = useState("");
  const [chains, setChains] = useState("");
  const [track, setTrack] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState({});
  const [grantTimes, setGrantTimes] = useState({});
  const [loading, setLoading] = useState(true);

  async function refresh() {
    if (!supabase || !membership?.company_id) { setLoading(false); return; }
    setLoading(true);
    const { data, error: e } = await supabase.from("line_blockages").select("*")
      .eq("company_id", membership.company_id).order("created_at", { ascending: false });
    if (e) setError(e.message); else setRows(data || []);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, [membership?.company_id]);

  async function create(event) {
    event.preventDefault(); setError(""); setMessage(""); setBusy("create");
    const { data, error: e } = await supabase.from("line_blockages").insert({
      company_id: membership.company_id, created_by: session.user.id, title: title.trim(),
      elr: elr.trim().toUpperCase() || null, mileage: mileage.trim() || null,
      chains: chains === "" ? null : Number(chains), track_reference: track.trim() || null, status: "planned"
    }).select("*").single();
    if (e) setError(e.message);
    else { setRows([data, ...rows]); setTitle(""); setElr(""); setMileage(""); setChains(""); setTrack(""); setMessage("Standalone line blockage created."); }
    setBusy("");
  }

  async function saveGrant(row) {
    if (!grantTimes[row.id]) { setError("Enter the confirmed time the line block was granted."); return; }
    setBusy(row.id); setError("");
    const { data, error: e } = await supabase.from("line_blockages").update({
      granted_at: new Date(grantTimes[row.id]).toISOString(), status: "granted"
    }).eq("id", row.id).select("*").single();
    if (e) setError(e.message); else { setRows(rows.map(x => x.id === row.id ? data : x)); setMessage("Grant time saved."); }
    setBusy("");
  }

  async function capture(row, phase) {
    setError(""); setMessage(""); setBusy(row.id);
    try {
      if (!navigator.geolocation) throw new Error("This device does not support GPS.");
      const file = files[row.id + phase];
      if (!file || !file.type.startsWith("image/")) throw new Error("Choose a photo of the boards first.");
      if (file.size > 12582912) throw new Error("Photo must be 12 MB or smaller.");
      const gps = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(
        p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, captured: new Date(p.timestamp || Date.now()).toISOString() }),
        () => reject(new Error("GPS unavailable. Allow location access and try again.")),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
      ));
      const path = membership.company_id + "/" + row.id + "/" + phase + "-" + Date.now() + "-" + file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const { error: upErr } = await supabase.storage.from("line-blockage-evidence").upload(path, file, { contentType: file.type });
      if (upErr) throw new Error("Photo upload failed: " + upErr.message);
      const now = new Date().toISOString();
      const update = phase === "placed" ? {
        board_placed_at: now, board_placed_latitude: gps.lat, board_placed_longitude: gps.lng,
        board_placed_accuracy_m: gps.accuracy, board_placed_gps_captured_at: gps.captured,
        board_placed_photo_path: path, status: "board_placed"
      } : {
        boards_removed_at: now, boards_removed_latitude: gps.lat, boards_removed_longitude: gps.lng,
        boards_removed_accuracy_m: gps.accuracy, boards_removed_gps_captured_at: gps.captured,
        boards_removed_photo_path: path, status: "closed"
      };
      const { data, error: saveErr } = await supabase.from("line_blockages").update(update).eq("id", row.id).select("*").single();
      if (saveErr) throw new Error(saveErr.message);
      setRows(rows.map(x => x.id === row.id ? data : x)); setMessage(phase === "placed" ? "Placement GPS and photo saved." : "Removal GPS and photo saved; record closed.");
    } catch (e) { setError(e.message || "Could not save evidence."); }
    setBusy("");
  }

  async function openPhoto(path) {
    const { data, error: e } = await supabase.storage.from("line-blockage-evidence").createSignedUrl(path, 300);
    if (e) setError(e.message); else window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }
  const fmt = value => value ? new Date(value).toLocaleString("en-GB") : "Not recorded";
  return <section className="line-blockages-page">
    <div className="dashboard-heading"><div><div className="eyebrow">SEPARATE RAILWAY ACTIVITY</div><h1>Line blockages</h1><p>Standalone records, separate from possessions.</p></div><div className="dashboard-live"><span className="online-dot"/><span>{rows.length} RECORDS</span></div></div>
    <div className="line-block-safety"><strong>Record keeping only.</strong> This feature does not request, grant or authorise a line block. Follow approved railway rules and communications; record only confirmed events.</div>
    {error && <div className="profile-create-error" role="alert">{error}</div>}{message && <div className="line-block-notice">{message}</div>}
    <form className="line-block-create" onSubmit={create}><h2>Set up a line blockage</h2>
      <label>Reference / name<input required value={title} onChange={e=>setTitle(e.target.value)} placeholder="Line block reference"/></label>
      <div className="line-block-form-grid"><label>ELR<input value={elr} onChange={e=>setElr(e.target.value)} /></label><label>Track / line<input value={track} onChange={e=>setTrack(e.target.value)} /></label><label>Mileage<input value={mileage} onChange={e=>setMileage(e.target.value)} /></label><label>Chains (0–79)<input type="number" min="0" max="79" value={chains} onChange={e=>setChains(e.target.value)} /></label></div>
      <button className="btn btn-primary" disabled={busy==="create"}>{busy==="create" ? "Creating…" : "Create line blockage"}</button>
    </form>
    <div className="line-block-list-heading"><h2>Line blockage records</h2><button className="btn btn-secondary" onClick={refresh} type="button">Refresh</button></div>
    {loading ? <p>Loading…</p> : rows.length === 0 ? <div className="line-block-empty">No line blockages recorded yet.</div> : <div className="line-block-list">{rows.map(row=><article className="line-block-card" key={row.id}>
      <div className="line-block-card-top"><div><span className="line-block-status">{row.status.replaceAll("_"," ")}</span><h3>{row.title}</h3><p>{[row.elr, row.track_reference, row.mileage ? row.mileage+" miles "+(row.chains ?? "")+" chains" : ""].filter(Boolean).join(" · ")}</p></div><small>Created {fmt(row.created_at)}</small></div>
      <div className="line-block-events"><div><strong>Block granted</strong><p>{fmt(row.granted_at)}</p>{!row.granted_at && <><label>Confirmed grant time<input type="datetime-local" value={grantTimes[row.id] || ""} onChange={e=>setGrantTimes({...grantTimes,[row.id]:e.target.value})}/></label><button className="btn btn-secondary" type="button" disabled={busy===row.id} onClick={()=>saveGrant(row)}>Record grant time</button></>}</div>
      <div><strong>Boards placed</strong><p>{fmt(row.board_placed_at)}</p>{row.board_placed_latitude != null && <p>GPS {Number(row.board_placed_latitude).toFixed(6)}, {Number(row.board_placed_longitude).toFixed(6)} (±{Math.round(row.board_placed_accuracy_m || 0)} m)</p>}{row.board_placed_photo_path && <button className="btn btn-secondary" type="button" onClick={()=>openPhoto(row.board_placed_photo_path)}>View photo</button>}{!row.board_placed_at && row.granted_at && <><label>Board photo<input type="file" accept="image/*" capture="environment" onChange={e=>setFiles({...files,[row.id+"placed"]:e.target.files?.[0]})}/></label><button className="btn btn-primary" type="button" disabled={busy===row.id} onClick={()=>capture(row,"placed")}>Capture GPS + record placement</button></>}</div>
      <div><strong>Boards removed</strong><p>{fmt(row.boards_removed_at)}</p>{row.boards_removed_latitude != null && <p>GPS {Number(row.boards_removed_latitude).toFixed(6)}, {Number(row.boards_removed_longitude).toFixed(6)} (±{Math.round(row.boards_removed_accuracy_m || 0)} m)</p>}{row.boards_removed_photo_path && <button className="btn btn-secondary" type="button" onClick={()=>openPhoto(row.boards_removed_photo_path)}>View photo</button>}{row.board_placed_at && !row.boards_removed_at && <><label>Removal photo<input type="file" accept="image/*" capture="environment" onChange={e=>setFiles({...files,[row.id+"removed"]:e.target.files?.[0]})}/></label><button className="btn btn-primary" type="button" disabled={busy===row.id} onClick={()=>capture(row,"removed")}>Capture GPS + record removal</button></>}</div></div>
    </article>)}</div>}
  </section>;
}
