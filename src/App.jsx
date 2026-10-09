import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { MapContainer, TileLayer, Marker, Popup, Polygon, LayersControl, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css";

// Demo records only. Replace with authenticated Supabase records before operational use.
const initialTasks = [
  { id: "MB-01", label: "Marker board 1", assignee: "Alex Morgan", status: "Assigned", position: [52.9127, -0.6424], elr: "", routeReference: "", mileageMiles: "", mileageChains: "", notes: "Confirm access point before travelling.", demo: true },
  { id: "MB-02", label: "Marker board 2", assignee: "Jamie Taylor", status: "Photo submitted", position: [52.9150, -0.6358], elr: "", routeReference: "", mileageMiles: "", mileageChains: "", notes: "Upload a clear photo showing the board in position.", demo: true },
  { id: "MB-03", label: "Marker board 3", assignee: "Unassigned", status: "Unassigned", position: [52.9170, -0.6288], elr: "", routeReference: "", mileageMiles: "", mileageChains: "", notes: "", demo: true }
];

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

function LoginScreen({ configured, loading, error, onSignIn, onResetPassword }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [resetMode, setResetMode] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (resetMode) {
        await onResetPassword(email);
        setMessage("If that email belongs to an account, a password-reset link has been sent.");
      } else {
        await onSignIn(email, password);
      }
    } catch (err) {
      setMessage(err?.message || "Unable to complete that request. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return <main className="login-page">
    <section className="login-card">
      <div className="login-brand-mark">R</div>
      <div className="login-eyebrow">SECURE WORK-SITE COORDINATION</div>
      <h1>Welcome to RailSite</h1>
      <p className="login-intro">Sign in with your RailSite account to access your company work sites and assigned tasks.</p>
      {!configured && <div className="login-alert">Supabase is not configured for this deployment. Check the Vercel environment variables <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>, then redeploy.</div>}
      {(error || message) && <div className={error ? "login-alert" : "login-message"} role="status">{error || message}</div>}
      <form onSubmit={submit}>
        <label className="login-label" htmlFor="login-email">Email address</label>
        <input id="login-email" className="login-input" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.co.uk" />
        {!resetMode && <>
          <label className="login-label" htmlFor="login-password">Password</label>
          <input id="login-password" className="login-input" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" />
        </>}
        <button className="login-submit" type="submit" disabled={!configured || busy || loading}>
          {busy ? "Please wait…" : resetMode ? "Send reset link" : "Sign in securely"}
        </button>
      </form>
      <button className="login-link" type="button" onClick={() => { setResetMode(v => !v); setMessage(""); }}>
        {resetMode ? "Back to sign in" : "Forgot your password?"}
      </button>
      <div className="login-footer"><span className="online-dot"/> Protected access · RailSite</div>
    </section>
  </main>;
}

const statusClass = (status) => status.toLowerCase().replaceAll(" ", "-");
const boardIcon = L.divIcon({
  className: "board-marker-wrap",
  html: '<div class="board-marker">B</div>',
  iconSize: [30, 36], iconAnchor: [15, 34]
});
const personIcon = L.divIcon({
  className: "person-marker-wrap",
  html: '<div class="person-marker"><span>●</span></div>',
  iconSize: [28, 28], iconAnchor: [14, 14]
});

function DrawTools({ onWorkSite }) {
  const map = useMap();
  useEffect(() => {
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    const drawControl = new L.Control.Draw({
      position: "topleft",
      draw: {
        polygon: { allowIntersection: false, showArea: true },
        rectangle: true,
        polyline: false, circle: false, circlemarker: false, marker: false
      },
      edit: { featureGroup: drawnItems, remove: true }
    });
    map.addControl(drawControl);
    const onCreated = (event) => {
      drawnItems.clearLayers();
      drawnItems.addLayer(event.layer);
      const layer = event.layer;
      const coords = layer.getLatLngs()[0].map(({ lat, lng }) => [lat, lng]);
      onWorkSite(coords);
    };
    map.on(L.Draw.Event.CREATED, onCreated);
    map.on(L.Draw.Event.EDITED, () => {
      const layers = drawnItems.getLayers();
      if (layers[0]?.getLatLngs) onWorkSite(layers[0].getLatLngs()[0].map(({lat,lng}) => [lat,lng]));
    });
    return () => {
      map.off(L.Draw.Event.CREATED, onCreated);
      map.removeControl(drawControl);
      map.removeLayer(drawnItems);
    };
  }, [map, onWorkSite]);
  return null;
}

function MapClickHandler({ enabled, onSelect }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled) return;
    const handler = (e) => onSelect([e.latlng.lat, e.latlng.lng]);
    map.on("click", handler);
    map.getContainer().style.cursor = "crosshair";
    return () => {
      map.off("click", handler);
      map.getContainer().style.cursor = "";
    };
  }, [enabled, map, onSelect]);
  return null;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [membership, setMembership] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [tasks, setTasks] = useState(initialTasks);
  const [selectedId, setSelectedId] = useState("MB-01");
  const [workSite, setWorkSite] = useState([[52.9115,-0.648],[52.9185,-0.648],[52.9185,-0.625],[52.9115,-0.625]]);
  const [placingPin, setPlacingPin] = useState(false);
  const [gps, setGps] = useState(null);
  const [gpsError, setGpsError] = useState("");
  const [workSiteName, setWorkSiteName] = useState("Grantham work site");
  const [workRef, setWorkRef] = useState("WS-2026-001");
  const [worksiteId, setWorksiteId] = useState(null);
  const [elr, setElr] = useState("");
  const [routeReference, setRouteReference] = useState("");
  const [startMiles, setStartMiles] = useState("");
  const [startChains, setStartChains] = useState("");
  const [endMiles, setEndMiles] = useState("");
  const [endChains, setEndChains] = useState("");
  const [possessionStatus, setPossessionStatus] = useState("Planning");
  const [plannedStartAt, setPlannedStartAt] = useState("");
  const [plannedEndAt, setPlannedEndAt] = useState("");
  const [siteLoading, setSiteLoading] = useState(false);
  const [siteSaving, setSiteSaving] = useState(false);
  const [filter, setFilter] = useState("All tasks");
  const [toast, setToast] = useState("");
  const [photoPreviews, setPhotoPreviews] = useState({});


  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }
    let active = true;
    const loadMembership = async (currentSession) => {
      if (!currentSession) {
        if (active) {
          setSession(null);
          setMembership(null);
          setAuthLoading(false);
        }
        return;
      }
      if (active) {
        setSession(currentSession);
        setAuthError("");
      }
      const { data, error } = await supabase
        .from("company_members")
        .select("company_id, role, companies(name)")
        .eq("user_id", currentSession.user.id)
        .maybeSingle();
      if (!active) return;
      if (error) {
        setMembership(null);
        setAuthError("Signed in, but your company access could not be checked. Please contact the RailSite owner.");
      } else if (!data) {
        setMembership(null);
        setAuthError("Your account is not assigned to a RailSite company yet. Ask the owner to add you.");
      } else {
        setMembership(data);
        setAuthError("");
      }
      setAuthLoading(false);
    };

    supabase.auth.getSession().then(({ data, error }) => {
      if (error && active) setAuthError("Unable to check your sign-in session.");
      return loadMembership(data?.session || null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      void loadMembership(currentSession);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleSignIn = async (email, password) => {
    if (!supabase) throw new Error("Sign-in is not configured for this deployment.");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(error.message === "Invalid login credentials" ? "Email or password is incorrect." : error.message);
  };

  const handleResetPassword = async (email) => {
    if (!supabase) throw new Error("Sign-in is not configured for this deployment.");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin
    });
    if (error) throw error;
  };

  useEffect(() => {
    if (!supabase || !membership?.company_id) return;
    let active = true;
    const loadWorksite = async () => {
      setSiteLoading(true);
      const { data, error } = await supabase
        .from("worksites")
        .select("id, name, reference, description, boundary, status, possession_status, planned_start_at, planned_end_at, elr, route_reference, start_miles, start_chains, end_miles, end_chains")
        .eq("company_id", membership.company_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      if (error) {
        setToast("Could not load saved work-site details. Check company permissions.");
      } else if (data) {
        setWorksiteId(data.id);
        setWorkSiteName(data.name || "");
        setWorkRef(data.reference || "");
        setWorkSite(Array.isArray(data.boundary) ? data.boundary : []);
        setElr(data.elr || "");
        setRouteReference(data.route_reference || "");
        setStartMiles(data.start_miles ?? "");
        setStartChains(data.start_chains ?? "");
        setEndMiles(data.end_miles ?? "");
        setEndChains(data.end_chains ?? "");
        setPossessionStatus(data.possession_status || data.status || "Planning");
        setPlannedStartAt(data.planned_start_at ? new Date(data.planned_start_at).toISOString().slice(0,16) : "");
        setPlannedEndAt(data.planned_end_at ? new Date(data.planned_end_at).toISOString().slice(0,16) : "");
      }
      setSiteLoading(false);
    };
    void loadWorksite();
    return () => { active = false; };
  }, [membership?.company_id]);

  const saveWorksite = async () => {
    if (!supabase || !membership?.company_id) {
      setToast("You must be signed in to save a work site.");
      return;
    }
    if (!workSiteName.trim()) {
      setToast("Enter a work-site name before saving.");
      return;
    }
    const chainFields = [
      ["Start", startChains], ["End", endChains],
      ...tasks.filter(task => !task.demo).map(task => [task.id, task.mileageChains])
    ];
    for (const [label, value] of chainFields) {
      if (value !== "" && value != null && (!Number.isInteger(Number(value)) || Number(value) < 0 || Number(value) > 79)) {
        setToast(`${label}: chains must be a whole number from 0 to 79.`);
        return;
      }
    }
    if (plannedStartAt && plannedEndAt && new Date(plannedEndAt) <= new Date(plannedStartAt)) {
      setToast("Planned finish must be after the planned start.");
      return;
    }
    if (startMiles !== "" && endMiles !== "" && startChains !== "" && endChains !== "" &&
        Number(endMiles) * 80 + Number(endChains) < Number(startMiles) * 80 + Number(startChains)) {
      setToast("The end mileage must not be before the start mileage.");
      return;
    }

    setSiteSaving(true);
    try {
      const payload = {
        name: workSiteName.trim(),
        reference: workRef.trim() || null,
        company_id: membership.company_id,
        boundary: workSite || [],
        elr: elr.trim().toUpperCase() || null,
        route_reference: routeReference.trim() || null,
        start_miles: startMiles === "" ? null : Number(startMiles),
        start_chains: startChains === "" ? null : Number(startChains),
        end_miles: endMiles === "" ? null : Number(endMiles),
        end_chains: endChains === "" ? null : Number(endChains),
        possession_status: possessionStatus,
        status: possessionStatus,
        planned_start_at: plannedStartAt ? new Date(plannedStartAt).toISOString() : null,
        planned_end_at: plannedEndAt ? new Date(plannedEndAt).toISOString() : null,
        updated_at: new Date().toISOString()
      };
      const request = worksiteId
        ? supabase.from("worksites").update(payload).eq("id", worksiteId).eq("company_id", membership.company_id).select("id").single()
        : supabase.from("worksites").insert(payload).select("id").single();
      const { data, error } = await request;
      if (error) {
        setToast("Work site was not saved: " + error.message);
        return;
      }
      const savedWorksiteId = data.id;
      setWorksiteId(savedWorksiteId);

      const boardTasks = tasks.filter(task => !task.demo);
      let savedBoardCount = 0;
      for (const task of boardTasks) {
        const boardPayload = {
          worksite_id: savedWorksiteId,
          board_code: task.id,
          label: task.label,
          latitude: Number(task.position[0]),
          longitude: Number(task.position[1]),
          status: task.status === "Verified" ? "verified" : task.status === "Unassigned" ? "planned" : "placed",
          assigned_to: task.assignee === "Unassigned" ? null : task.assignee,
          notes: task.notes || null,
          elr: (task.elr || elr).trim().toUpperCase() || null,
          route_reference: (task.routeReference || routeReference).trim() || null,
          mileage_miles: task.mileageMiles === "" || task.mileageMiles == null ? null : Number(task.mileageMiles),
          mileage_chains: task.mileageChains === "" || task.mileageChains == null ? null : Number(task.mileageChains)
        };
        const boardRequest = task.dbId
          ? supabase.from("marker_boards").update(boardPayload).eq("id", task.dbId).select("id").single()
          : supabase.from("marker_boards").insert(boardPayload).select("id").single();
        const { data: boardData, error: boardError } = await boardRequest;
        if (boardError) {
          setToast(`Work site saved, but marker board ${task.id} was not saved: ${boardError.message}`);
          return;
        }
        savedBoardCount += 1;
        if (!task.dbId) updateTask(task.id, { dbId: boardData.id, demo: false });
      }
      setToast(boardTasks.length
        ? `Work site saved; ${savedBoardCount} marker board(s) saved too.`
        : "Work-site details saved to RailSite.");
      window.setTimeout(() => setToast(""), 4500);
    } catch (err) {
      setToast("Save failed unexpectedly: " + (err?.message || "Please try again."));
    } finally {
      setSiteSaving(false);
    }
  };

  const deleteSelectedBoard = async () => {
    if (!selected) return;
    const boardName = selected.label || selected.id;
    if (!window.confirm(`Delete ${boardName}? This cannot be undone.`)) return;
    if (selected.dbId && supabase) {
      const { error } = await supabase
        .from("marker_boards")
        .delete()
        .eq("id", selected.dbId);
      if (error) {
        setToast("Could not delete marker board: " + error.message);
        return;
      }
    }
    const remaining = tasks.filter(task => task.id !== selected.id);
    setTasks(remaining);
    setSelectedId(remaining[0]?.id || "");
    setPhotoPreviews(prev => {
      const next = { ...prev };
      delete next[selected.id];
      return next;
    });
    setToast(`${boardName} deleted.`);
    window.setTimeout(() => setToast(""), 3500);
  };

  useEffect(() => {
    if (!supabase || !membership?.company_id || !worksiteId) return;
    let active = true;
    const loadBoards = async () => {
      const { data, error } = await supabase
        .from("marker_boards")
        .select("id, board_code, label, latitude, longitude, status, assigned_to, notes, elr, route_reference, mileage_miles, mileage_chains")
        .eq("worksite_id", worksiteId)
        .order("created_at", { ascending: true });
      if (!active) return;
      if (error) {
        setToast("Work site loaded, but marker boards could not be loaded.");
        return;
      }
      if (data?.length) {
        const loaded = data.map((row, index) => {
          const code = row.board_code || row.label || `MB-${String(index + 1).padStart(2, "0")}`;
          const status = row.status === "verified" ? "Verified" : row.status === "placed" ? "Awaiting PICOP verification" : "Unassigned";
          return {
            id: code,
            dbId: row.id,
            label: row.label || `Marker board ${index + 1}`,
            assignee: row.assigned_to || "Unassigned",
            status,
            position: [Number(row.latitude), Number(row.longitude)],
            elr: row.elr || "",
            routeReference: row.route_reference || "",
            mileageMiles: row.mileage_miles ?? "",
            mileageChains: row.mileage_chains ?? "",
            notes: row.notes || "",
            demo: false
          };
        });
        setTasks(loaded);
        setSelectedId(loaded[0].id);
      }
    };
    void loadBoards();
    return () => { active = false; };
  }, [membership?.company_id, worksiteId]);

  const handleSignOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) setAuthError("Could not sign out. Please try again.");
  };

  const selected = tasks.find(t => t.id === selectedId) || tasks[0] || { id: "", label: "No marker board selected", assignee: "Unassigned", status: "Unassigned", position: [0, 0], notes: "", demo: true };
  const updateTask = (id, patch) => setTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  const setSite = React.useCallback((coords) => setWorkSite(coords), []);
  const choosePin = React.useCallback((position) => {
    if (!placingPin) return;
    let nextNumber = 1;
    while (tasks.some(task => task.id === `MB-${String(nextNumber).padStart(2, "0")}`)) nextNumber += 1;
    const id = `MB-${String(nextNumber).padStart(2, "0")}`;
    const task = { id, label: `Marker board ${nextNumber}`, assignee: "Unassigned", status: "Unassigned", position, elr, routeReference, mileageMiles: "", mileageChains: "", notes: "", demo: false, dbId: null };
    setTasks(prev => [...prev, task]);
    setSelectedId(id);
    setPlacingPin(false);
    setToast(`${id} pin added. Assign a team member in the task panel.`);
    window.setTimeout(() => setToast(""), 3500);
  }, [placingPin, tasks.length]);

  const requestGps = () => {
    setGpsError("");
    if (!navigator.geolocation) {
      setGpsError("This browser does not support GPS location.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setGps({ position: [pos.coords.latitude, pos.coords.longitude], accuracy: Math.round(pos.coords.accuracy), time: new Date(pos.timestamp) });
        setGpsError("");
      },
      err => setGpsError(err.code === 1 ? "Location permission was denied." : "Could not get a location. Check GPS and try again."),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const onPhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file || !selected) return;
    if (!file.type.startsWith("image/")) { setToast("Please choose an image file."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreviews(prev => ({ ...prev, [selected.id]: reader.result }));
      updateTask(selected.id, { status: "Photo submitted", photoName: file.name, submittedAt: new Date().toISOString(), submittedGps: gps?.position || null });
      setToast("Photo attached in this demo. It is not uploaded to a server yet.");
      window.setTimeout(() => setToast(""), 4500);
    };
    reader.readAsDataURL(file);
  };

  const visibleTasks = useMemo(() => filter === "All tasks" ? tasks : tasks.filter(t => t.status === filter), [tasks, filter]);
  const count = (status) => tasks.filter(t => t.status === status).length;

  if (authLoading) return <main className="login-page"><section className="login-card"><div className="login-brand-mark">R</div><h1>Opening RailSite…</h1><p className="login-intro">Checking your secure session.</p></section></main>;
  if (!session || !membership) return <LoginScreen configured={Boolean(supabase)} loading={authLoading} error={authError} onSignIn={handleSignIn} onResetPassword={handleResetPassword} />;

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark"><span>R</span></div>
        <div><div className="brand-name">RAILSITE</div><div className="brand-sub">WORK-SITE COORDINATION</div></div>
      </div>
      <div className="topbar-right">
        <div className="role-chip"><span className="online-dot"/> {(membership.role || "member").toUpperCase()} VIEW</div>
        <div className="signed-in-user">{session.user.email}</div>
        <button className="btn btn-quiet" onClick={handleSignOut}>Sign out</button>
      </div>
    </header>

    <main className="workspace">
      <section className="dashboard-overview">
        <div className="dashboard-heading">
          <div><div className="eyebrow">OPERATIONS CONTROL</div><h1>PICOP dashboard</h1><p>Work-site status, marker-board progress and railway location reference.</p></div>
          <div className="dashboard-live"><span className="online-dot"/><span>SESSION ACTIVE</span><small>{membership.companies?.name || "Company workspace"}</small></div>
        </div>
        <div className="possession-controls">
          <label>Possession status<select value={possessionStatus} onChange={e => setPossessionStatus(e.target.value)}><option>Planning</option><option>Briefing</option><option>In progress</option><option>Suspended</option><option>Complete</option><option>Cancelled</option></select></label>
          <label>Planned start<input type="datetime-local" value={plannedStartAt} onChange={e => setPlannedStartAt(e.target.value)}/></label>
          <label>Planned finish<input type="datetime-local" value={plannedEndAt} onChange={e => setPlannedEndAt(e.target.value)}/></label>
          <button className="btn btn-primary possession-save" onClick={saveWorksite} disabled={siteSaving || siteLoading}>{siteSaving ? "Saving…" : "Save overview"}</button>
        </div>
        <div className="overview-cards">
          <article className="overview-card overview-card-site"><div className="overview-card-top"><span className="overview-icon">⌖</span><span className="overview-label">ACTIVE WORK SITE</span></div><strong className="overview-main-value">{workSiteName || "Unnamed work site"}</strong><div className="overview-card-foot">{workRef || "No work-site reference"} <span className="overview-status-dot"/> {worksiteId ? "SAVED" : "DRAFT"}</div></article>
          <article className="overview-card"><div className="overview-card-top"><span className="overview-icon">⚑</span><span className="overview-label">MARKER BOARDS</span></div><strong className="overview-number">{tasks.length}</strong><div className="overview-card-foot">{count("Unassigned")} unassigned · {count("Verified")} verified</div><div className="overview-progress"><span style={{width: tasks.length ? `${Math.round(count("Verified") / tasks.length * 100)}%` : "0%"}}/></div></article>
          <article className="overview-card"><div className="overview-card-top"><span className="overview-icon">◷</span><span className="overview-label">AWAITING REVIEW</span></div><strong className="overview-number">{count("Photo submitted") + count("Awaiting PICOP verification")}</strong><div className="overview-card-foot">Photo submissions and verification requests</div></article>
          <article className="overview-card"><div className="overview-card-top"><span className="overview-icon">⇄</span><span className="overview-label">RAILWAY REFERENCE</span></div><strong className="overview-main-value">{elr || "ELR not set"}</strong><div className="overview-card-foot">{routeReference || "Route reference not set"}{startMiles !== "" || startChains !== "" ? ` · ${startMiles || "0"}m ${String(startChains || "0").padStart(2,"0")}ch` : ""}</div></article>
        </div>
        <div className="outstanding-strip">
          <div className="outstanding-title"><span className="outstanding-mark">!</span><div><strong>Outstanding actions</strong><small>Items that may need PICOP attention</small></div></div>
          <div className="outstanding-items">
            {tasks.length === 0 && <span className="action-chip action-neutral">No marker boards added</span>}
            {tasks.some(task => task.status === "Unassigned") && <span className="action-chip action-warning">{count("Unassigned")} board(s) unassigned</span>}
            {(count("Photo submitted") + count("Awaiting PICOP verification")) > 0 && <span className="action-chip action-warning">{count("Photo submitted") + count("Awaiting PICOP verification")} awaiting review</span>}
            {(!tasks.some(task => task.status === "Unassigned") && count("Photo submitted") + count("Awaiting PICOP verification") === 0) && <span className="action-chip action-clear">No outstanding board actions</span>}
            {(!elr.trim() || !routeReference.trim() || startMiles === "" || startChains === "" || endMiles === "" || endChains === "") && <span className="action-chip action-neutral">Railway reference incomplete</span>}
            {plannedStartAt && plannedEndAt && new Date(plannedEndAt) <= new Date(plannedStartAt) && <span className="action-chip action-danger">Planned finish must be after start</span>}
          </div>
        </div>
      </section>
      <section className="map-column">
        <div className="site-toolbar">
          <div className="site-title-group">
            <div className="eyebrow">ACTIVE WORK SITE</div>
            <input className="site-name" value={workSiteName} onChange={e => setWorkSiteName(e.target.value)} aria-label="Work site name" />
            <div className="site-ref"><input value={workRef} onChange={e => setWorkRef(e.target.value)} aria-label="Work-site reference" placeholder="Work-site reference"/> <span className="separator">•</span> {siteLoading ? "Loading saved site…" : worksiteId ? "Saved work site" : "New work-site draft"}</div>
          </div>
          <div className="toolbar-actions">
            <button className={`btn ${placingPin ? "btn-warning" : "btn-secondary"}`} onClick={() => setPlacingPin(v => !v)}>{placingPin ? "Tap map to place pin" : "+ Place board pin"}</button>
            <button className="btn btn-primary" onClick={saveWorksite} disabled={siteSaving || siteLoading}>{siteSaving ? "Saving…" : "Save work site"}</button>
          </div>
        </div>
        <section className="rail-mileage-panel">
          <div className="rail-mileage-heading">
            <div><div className="eyebrow">RAILWAY LOCATION REFERENCE</div><strong>ELR + route mileage</strong></div>
            <span className="mileage-format-tag">Miles &amp; chains</span>
          </div>
          <div className="rail-reference-fields">
            <label>ELR<input value={elr} onChange={e => setElr(e.target.value.toUpperCase())} placeholder="e.g. GRAN" autoCapitalize="characters"/></label>
            <label>Route / line reference<input value={routeReference} onChange={e => setRouteReference(e.target.value)} placeholder="Route or line name"/></label>
          </div>
          <div className="mileage-range-fields">
            <div className="mileage-endpoint"><span>Start mileage</span><div><label>Miles<input type="number" min="0" step="1" value={startMiles} onChange={e => setStartMiles(e.target.value)} placeholder="0"/></label><label>Chains<input type="number" min="0" max="79" step="1" value={startChains} onChange={e => setStartChains(e.target.value)} placeholder="00"/></label></div></div>
            <div className="mileage-endpoint"><span>End mileage</span><div><label>Miles<input type="number" min="0" step="1" value={endMiles} onChange={e => setEndMiles(e.target.value)} placeholder="0"/></label><label>Chains<input type="number" min="0" max="79" step="1" value={endChains} onChange={e => setEndChains(e.target.value)} placeholder="00"/></label></div></div>
          </div>
          <p>Enter the operational mileage used for the possession. Map geometry remains illustrative until matched to an approved track-mileage dataset.</p>
        </section>
        <div className="map-wrap">
          <MapContainer center={[52.915, -0.636]} zoom={14} minZoom={5} maxZoom={19} zoomControl={true} scrollWheelZoom={true}>
            <LayersControl position="topright">
              <LayersControl.BaseLayer checked name="OpenStreetMap">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
              </LayersControl.BaseLayer>
              <LayersControl.Overlay name="Railway infrastructure (OpenRailwayMap)">
                <TileLayer
                  attribution='Data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · Style: <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC BY-SA 2.0</a> · <a href="https://www.openrailwaymap.org/">OpenRailwayMap</a>'
                  url="https://tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png"
                  maxZoom={19}
                />
              </LayersControl.Overlay>
            </LayersControl>
            <DrawTools onWorkSite={setSite}/>
            <MapClickHandler enabled={placingPin} onSelect={choosePin}/>
            {workSite?.length > 2 && <Polygon positions={workSite} pathOptions={{ color: "#159a78", weight: 3, fillColor: "#159a78", fillOpacity: 0.12, dashArray: "7 5" }} />}
            {tasks.map(task => <Marker key={task.id} position={task.position} icon={boardIcon} eventHandlers={{ click: () => setSelectedId(task.id) }}>
              <Popup><strong>{task.label}</strong><br/>{task.id}<br/>Assigned: {task.assignee}<br/>Status: {task.status}</Popup>
            </Marker>)}
            {gps && <Marker position={gps.position} icon={personIcon}><Popup><strong>Your reported location</strong><br/>Accuracy: ±{gps.accuracy} m<br/>{gps.time.toLocaleTimeString()}</Popup></Marker>}
          </MapContainer>
          <div className="map-legend">
            <span><i className="legend-board"/> Marker board</span>
            <span><i className="legend-site"/> Work-site boundary</span>
            <span><i className="legend-person"/> Your GPS</span>
          </div>
          {placingPin && <div className="map-instruction"><span className="pulse-dot"/> Tap the map where the marker board should be placed</div>}
          {toast && <div className="toast">{toast}</div>}
          <div className="map-attribution-note">Illustrative basemap • Verify railway alignment against approved infrastructure data</div>
        </div>
        <div className="map-footer">
          <div className="map-footer-item"><span className="footer-icon">⌖</span><div><strong>Work-site boundary</strong><small>Use the polygon tool on the map to redraw</small></div></div>
          <div className="map-footer-item"><span className="footer-icon">⚑</span><div><strong>{tasks.length} marker-board tasks</strong><small>Click a pin to view or edit its task</small></div></div>
          <div className="map-footer-item"><span className="footer-icon">◎</span><div><strong>{gps ? `GPS accuracy ±${gps.accuracy} m` : "GPS not shared"}</strong><small>{gps ? `Last fix ${gps.time.toLocaleTimeString()}` : "Location only requested when you press the button"}</small></div></div>
        </div>
      </section>

      <aside className="side-panel">
        <div className="panel-heading">
          <div><div className="eyebrow">PICOP DASHBOARD</div><h1>Work-site tasks</h1></div>
          <span className="count-badge">{tasks.length}</span>
        </div>
        <div className="stat-grid">
          <div className="stat-card"><span>Assigned</span><strong>{count("Assigned")}</strong><i className="stat-line blue"/></div>
          <div className="stat-card"><span>For review</span><strong>{count("Photo submitted") + count("Awaiting PICOP verification")}</strong><i className="stat-line amber"/></div>
          <div className="stat-card"><span>Outstanding</span><strong>{count("Unassigned")}</strong><i className="stat-line grey"/></div>
        </div>
        <div className="task-list-heading">
          <h2>Marker-board list</h2>
          <select value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filter tasks">
            <option>All tasks</option><option>Unassigned</option><option>Assigned</option><option>Photo submitted</option><option>Awaiting PICOP verification</option><option>Verified</option>
          </select>
        </div>
        <div className="task-list">
          {visibleTasks.map(task => <button key={task.id} className={`task-row ${selectedId === task.id ? "selected" : ""}`} onClick={() => setSelectedId(task.id)}>
            <span className="task-pin">B</span>
            <span className="task-main"><strong>{task.label}</strong><small>{task.id} · {task.assignee}</small><span className={`status-pill ${statusClass(task.status)}`}>{task.status}</span></span>
            <span className="task-chevron">›</span>
          </button>)}
          {visibleTasks.length === 0 && <div className="empty-state">No tasks match this filter.</div>}
        </div>
        <div className="detail-card">
          {tasks.length === 0 ? <div className="empty-board-detail"><div className="eyebrow">NO MARKER BOARDS</div><h2>All marker boards have been deleted</h2><p>The work site is still here. Add a new board by selecting <strong>+ Place board pin</strong>, then tapping its location on the map.</p><button className="btn btn-primary btn-full" onClick={() => setPlacingPin(true)}>+ Add first marker board</button></div> : <>
          <div className="detail-topline"><span className="eyebrow">SELECTED TASK</span><span className={`status-pill ${statusClass(selected.status)}`}>{selected.status}</span></div>
          <h2>{selected.label}</h2>
          <div className="field">
            <label htmlFor="assignee">Assign team member</label>
            <select id="assignee" value={selected.assignee} onChange={e => updateTask(selected.id, { assignee: e.target.value, status: e.target.value === "Unassigned" ? "Unassigned" : (selected.status === "Unassigned" ? "Assigned" : selected.status) })}>
              <option>Unassigned</option><option>Alex Morgan</option><option>Jamie Taylor</option><option>Sam Patel</option><option>Riley James</option>
            </select>
          </div>
          <div className="marker-mileage-card">
            <div className="eyebrow">BOARD LOCATION REFERENCE</div>
            <div className="marker-reference-fields">
              <label>ELR<input value={selected.elr || ""} onChange={e => updateTask(selected.id, { elr: e.target.value.toUpperCase() })} placeholder="ELR"/></label>
              <label>Route / line<input value={selected.routeReference || ""} onChange={e => updateTask(selected.id, { routeReference: e.target.value })} placeholder="Route or line"/></label>
            </div>
            <div className="marker-chain-fields">
              <label>Miles<input type="number" min="0" step="1" value={selected.mileageMiles ?? ""} onChange={e => updateTask(selected.id, { mileageMiles: e.target.value })} placeholder="0"/></label>
              <label>Chains (0–79)<input type="number" min="0" max="79" step="1" value={selected.mileageChains ?? ""} onChange={e => updateTask(selected.id, { mileageChains: e.target.value })} placeholder="00"/></label>
            </div>
            <small>Board mileage is saved with the work site. The map pin remains a manually placed visual reference until an approved railway geometry dataset is connected.</small>
          </div>
          <div className="field">
            <label htmlFor="notes">Instructions</label>
            <textarea id="notes" rows="2" value={selected.notes || ""} onChange={e => updateTask(selected.id, { notes: e.target.value })} placeholder="Add task instructions…"/>
          </div>
          <div className="coord-box">
            <div><span>Map latitude</span><strong>{selected.position[0].toFixed(6)}</strong></div>
            <div><span>Map longitude</span><strong>{selected.position[1].toFixed(6)}</strong></div>
          </div>
          <button className="btn btn-secondary btn-full" onClick={requestGps}>◎ Get my current GPS location</button>
          {gpsError && <div className="inline-error">{gpsError}</div>}
          {gps && <div className="gps-confirm"><span className="online-dot"/> Location acquired · ±{gps.accuracy} m</div>}
          <div className="field photo-field">
            <label htmlFor="photo">Photo evidence</label>
            <label className="upload-zone" htmlFor="photo">
              {photoPreviews[selected.id] ? <img src={photoPreviews[selected.id]} alt="Selected task evidence preview"/> : <><span className="upload-icon">↑</span><strong>Choose a photo</strong><small>Use your phone camera or select an image</small></>}
            </label>
            <input id="photo" className="file-input" type="file" accept="image/*" capture="environment" onChange={onPhoto}/>
            {selected.photoName && <div className="file-caption">Attached: {selected.photoName}</div>}
          </div>
          <div className="button-row">
            <button className="btn btn-secondary" onClick={() => { updateTask(selected.id, { status: "Awaiting PICOP verification" }); setToast("Task moved to awaiting verification."); window.setTimeout(() => setToast(""), 3000); }}>Request review</button>
            <button className="btn btn-primary" onClick={() => { updateTask(selected.id, { status: "Verified" }); setToast("Marked verified in this demo only."); window.setTimeout(() => setToast(""), 3000); }}>Verify task</button>
          </div>
          <button className="btn btn-danger btn-full delete-board-button" onClick={deleteSelectedBoard} disabled={!selected.id}>Delete selected marker board</button>
          <p className="safety-note"><strong>Safety note:</strong> This prototype does not confirm railway protection, safe access, or correct placement. Use approved railway procedures and independent checks.</p>
          </>}
        </div>
        <div className="panel-bottom-note"><span className="lock-icon">▣</span> Demo data only · Changes are not saved between reloads</div>
      </aside>
    </main>
    <footer className="app-footer"><span>RAILSITE MVP <b>0.1.0</b></span><span>Prototype for workflow review · Not for operational use</span></footer>
  </div>;
}
