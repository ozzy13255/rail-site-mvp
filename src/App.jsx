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
const toLocalDateTime = (value) => { const date = new Date(value); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}T${String(date.getHours()).padStart(2,"0")}:${String(date.getMinutes()).padStart(2,"0")}`; };
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
  const [calendarWorksites, setCalendarWorksites] = useState([]);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedCalendarDate, setSelectedCalendarDate] = useState("");
  const [possessionEditorOpen, setPossessionEditorOpen] = useState(false);
  const [editorPlacingBoard, setEditorPlacingBoard] = useState(false);
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
  const [photoFiles, setPhotoFiles] = useState({});
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activePage, setActivePage] = useState("overview");
  const [companyProfiles, setCompanyProfiles] = useState([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileRole, setProfileRole] = useState("planner");
  const [profileSaving, setProfileSaving] = useState(false);
  const [picopOptions, setPicopOptions] = useState([]);
  const [teamOptions, setTeamOptions] = useState([]);
  const [assignedPicopEmail, setAssignedPicopEmail] = useState("");
  const [picopResponse, setPicopResponse] = useState("pending");
  const [notifications, setNotifications] = useState([]);
  const [workflowBusyId, setWorkflowBusyId] = useState("");


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
        setActivePage(data.role === "member" ? "boards" : "overview");
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
    const loadWorksites = async () => {
      setSiteLoading(true);
      const { data, error } = await supabase
        .from("worksites")
        .select("id, name, reference, description, boundary, status, possession_status, planned_start_at, planned_end_at, elr, route_reference, start_miles, start_chains, end_miles, end_chains, assigned_picop_email, picop_response, picop_response_at, board_placement_requested_at, activated_at, created_at")
        .eq("company_id", membership.company_id)
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error) {
        setToast("Could not load saved possessions. Check company permissions.");
      } else {
        const rows = data || [];
        setCalendarWorksites(rows);
        if (rows.length) {
          const first = rows[0];
          setWorksiteId(first.id);
          setWorkSiteName(first.name || "");
          setWorkRef(first.reference || "");
          setWorkSite(Array.isArray(first.boundary) ? first.boundary : []);
          setElr(first.elr || "");
          setRouteReference(first.route_reference || "");
          setStartMiles(first.start_miles ?? "");
          setStartChains(first.start_chains ?? "");
          setEndMiles(first.end_miles ?? "");
          setEndChains(first.end_chains ?? "");
          setAssignedPicopEmail(first.assigned_picop_email || "");
          setPicopResponse(first.picop_response || "pending");
          setPossessionStatus(first.possession_status || first.status || "Planning");
          setPlannedStartAt(first.planned_start_at ? toLocalDateTime(first.planned_start_at) : "");
          setPlannedEndAt(first.planned_end_at ? toLocalDateTime(first.planned_end_at) : "");
          setSelectedCalendarDate(first.planned_start_at ? toLocalDateTime(first.planned_start_at).slice(0, 10) : "");
        } else {
          setWorksiteId(null);
          setWorkSiteName("");
          setWorkRef("");
          setWorkSite([]);
          setElr("");
          setRouteReference("");
          setStartMiles("");
          setStartChains("");
          setEndMiles("");
          setEndChains("");
          setAssignedPicopEmail("");
          setPicopResponse("pending");
          setPlannedStartAt("");
          setPlannedEndAt("");
          setTasks([]);
          setSelectedId("");
        }
      }
      setSiteLoading(false);
    };
    void loadWorksites();
    return () => { active = false; };
  }, [membership?.company_id]);

  useEffect(() => {
    if (!supabase || !membership?.company_id || !["owner", "admin"].includes(membership.role)) return;
    let active = true;
    const loadProfiles = async () => {
      setProfilesLoading(true);
      const { data, error } = await supabase.from("company_members")
        .select("user_id, role, email, display_name, created_at")
        .eq("company_id", membership.company_id).order("created_at", { ascending: true });
      if (!active) return;
      if (error) setToast("Could not load company profiles: " + error.message);
      else setCompanyProfiles(data || []);
      setProfilesLoading(false);
    };
    if (activePage === "profiles") void loadProfiles();
    return () => { active = false; };
  }, [membership?.company_id, membership?.role, activePage]);

  const createProfile = async (event) => {
    event.preventDefault();
    if (!supabase || !membership?.company_id || !["owner", "admin"].includes(membership.role)) return;
    setProfileSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-profile", {
        body: { email: profileEmail.trim(), display_name: profileName.trim(), role: profileRole, company_id: membership.company_id }
      });
      if (error) throw new Error(data?.error || error.message || "Could not create profile.");
      if (data?.error) throw new Error(data.error);
      setToast(data?.message || "Profile created and invitation sent.");
      setProfileName(""); setProfileEmail(""); setProfileRole("planner");
      const { data: refreshed, error: refreshError } = await supabase.from("company_members")
        .select("user_id, role, email, display_name, created_at")
        .eq("company_id", membership.company_id).order("created_at", { ascending: true });
      if (!refreshError && refreshed) setCompanyProfiles(refreshed);
    } catch (error) {
      setToast(error?.message || "Could not create profile. Please try again.");
    } finally { setProfileSaving(false); }
  };

  useEffect(() => {
    if (!supabase || !membership?.company_id) return;
    let active = true;
    supabase.from("company_members").select("user_id, email, display_name").eq("company_id", membership.company_id).eq("role", "picop").order("created_at", { ascending: true }).then(({ data, error }) => {
      if (!active) return;
      if (!error) setPicopOptions((data || []).filter(profile => profile.email));
    });
    if (active) {
      supabase.from("company_members").select("user_id, email, display_name").eq("company_id", membership.company_id).eq("role", "member").order("created_at", { ascending: true }).then(({ data, error }) => {
        if (active && !error) setTeamOptions((data || []).filter(profile => profile.email));
      });
    }
    return () => { active = false; };
  }, [membership?.company_id]);

  useEffect(() => {
    if (!supabase || !membership?.company_id || !session?.user?.email) return;
    let active = true;
    const loadNotifications = async () => {
      const { data, error } = await supabase.from("railsite_notifications")
        .select("id, kind, message, created_at, worksite_id, marker_board_id")
        .eq("company_id", membership.company_id).ilike("recipient_email", session.user.email)
        .is("read_at", null).order("created_at", { ascending: false }).limit(8);
      if (active && !error) setNotifications(data || []);
    };
    void loadNotifications();
    const timer = window.setInterval(loadNotifications, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, [membership?.company_id, session?.user?.email]);

  const markNotificationRead = async (notificationId) => {
    const { error } = await supabase.from("railsite_notifications").update({ read_at: new Date().toISOString() }).eq("id", notificationId);
    if (error) setToast("Could not dismiss notification: " + error.message);
    else setNotifications(prev => prev.filter(item => item.id !== notificationId));
  };

  const respondToPossession = async (item, response) => {
    setWorkflowBusyId(item.id);
    const { error } = await supabase.rpc("picop_respond_to_worksite", { p_worksite_id: item.id, p_response: response });
    if (error) setToast("Could not record PICOP response: " + error.message);
    else {
      setCalendarWorksites(prev => prev.map(row => row.id === item.id ? { ...row, picop_response: response, picop_response_at: new Date().toISOString() } : row));
      setToast(response === "accepted" ? "Possession accepted. Marker-board placement remains a separate step." : "Possession declined. The Planner has been notified.");
    }
    setWorkflowBusyId("");
  };

  const requestBoardPlacement = async (item) => {
    setWorkflowBusyId(item.id);
    const { data, error } = await supabase.rpc("picop_request_board_placement", { p_worksite_id: item.id });
    if (error) setToast("Could not request marker-board placement: " + error.message);
    else {
      setCalendarWorksites(prev => prev.map(row => row.id === item.id ? { ...row, board_placement_requested_at: new Date().toISOString() } : row));
      setToast(`Board-placement requests sent to ${data?.notified_count ?? 0} assigned user(s).`);
    }
    setWorkflowBusyId("");
  };

  // Keep the shared company calendar current for other signed-in members.
  // Realtime is used when available, with a lightweight polling fallback.
  useEffect(() => {
    if (!supabase || !membership?.company_id) return;
    let active = true;
    const refreshCalendar = async () => {
      const { data, error } = await supabase
        .from("worksites")
        .select("id, name, reference, description, boundary, status, possession_status, planned_start_at, planned_end_at, elr, route_reference, start_miles, start_chains, end_miles, end_chains, created_at")
        .eq("company_id", membership.company_id)
        .order("created_at", { ascending: false });
      if (active && !error && data) setCalendarWorksites(data);
    };
    const channel = supabase
      .channel("calendar-worksites-" + membership.company_id)
      .on("postgres_changes", { event: "*", schema: "public", table: "worksites", filter: "company_id=eq." + membership.company_id }, refreshCalendar)
      .subscribe();
    const pollId = window.setInterval(refreshCalendar, 15000);
    return () => {
      active = false;
      window.clearInterval(pollId);
      void supabase.removeChannel(channel);
    };
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
    if (!plannedStartAt || !plannedEndAt) {
      setToast("Enter the exact planned possession start and finish date/time.");
      return;
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
        assigned_picop_email: assignedPicopEmail || null,
        picop_response: picopResponse || "pending",
        // The database status column has a constrained operational vocabulary;
        // keep the user-facing planning status separately in possession_status.
        status: ({ "Planning": "planned", "Briefing": "planned", "In progress": "active", "Suspended": "active", "Complete": "completed", "Cancelled": "cancelled" })[possessionStatus] || "planned",
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

      const boardTasks = tasks.filter(task => !task.demo);
      let savedBoardCount = 0;
      for (const task of boardTasks) {
        const boardPayload = {
          worksite_id: savedWorksiteId,
          board_code: task.id,
          label: task.label,
          latitude: Number(task.position[0]),
          longitude: Number(task.position[1]),
          status: task.status === "Verified" ? "verified" : task.status === "Awaiting PICOP verification" ? "placed" : "planned",
          assigned_to: task.assignee === "Unassigned" ? null : task.assignee,
          assigned_email: task.assignedEmail || null,
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
      setWorksiteId(savedWorksiteId);
      const { data: refreshedWorksites } = await supabase.from("worksites").select("id, name, reference, description, boundary, status, possession_status, planned_start_at, planned_end_at, elr, route_reference, start_miles, start_chains, end_miles, end_chains, created_at").eq("company_id", membership.company_id).order("created_at", { ascending: false });
      if (refreshedWorksites) setCalendarWorksites(refreshedWorksites);
      if (plannedStartAt) {
        const savedDate = new Date(plannedStartAt);
        setCalendarMonth(new Date(savedDate.getFullYear(), savedDate.getMonth(), 1));
        setSelectedCalendarDate(plannedStartAt.slice(0, 10));
      }
      setToast(boardTasks.length
        ? `Possession saved; ${savedBoardCount} marker board(s) saved too.`
        : "Possession saved to the planning calendar.");
      setPossessionEditorOpen(false);
      setEditorPlacingBoard(false);
      window.setTimeout(() => setToast(""), 4500);
    } catch (err) {
      setToast("Save failed unexpectedly: " + (err?.message || "Please try again."));
    } finally {
      setSiteSaving(false);
    }
  };

  const cancelWorksite = async () => {
    if (!worksiteId || !supabase || !membership?.company_id) return;
    if (!window.confirm(`Cancel work site "${workSiteName}"? It will remain on the calendar in red as CANCELLED.`)) return;
    setSiteSaving(true);
    try {
      const { error } = await supabase.from("worksites").update({
        possession_status: "Cancelled",
        status: "cancelled",
        updated_at: new Date().toISOString()
      }).eq("id", worksiteId).eq("company_id", membership.company_id);
      if (error) {
        setToast("Could not cancel work site: " + error.message);
        return;
      }
      setPossessionStatus("Cancelled");
      const { data } = await supabase.from("worksites")
        .select("id, name, reference, description, boundary, status, possession_status, planned_start_at, planned_end_at, elr, route_reference, start_miles, start_chains, end_miles, end_chains, created_at")
        .eq("company_id", membership.company_id).order("created_at", { ascending: false });
      if (data) setCalendarWorksites(data);
      setPossessionEditorOpen(false);
      setToast("Work site cancelled. It remains on the calendar in red.");
      window.setTimeout(() => setToast(""), 4500);
    } finally {
      setSiteSaving(false);
    }
  };

  const deleteWorksite = async () => {
    if (!worksiteId || !supabase || !membership?.company_id) return;
    if (!window.confirm(`Permanently delete work site "${workSiteName}" and its marker boards? This cannot be undone.`)) return;
    setSiteSaving(true);
    try {
      // Remove child marker boards first so deletion also works when the database
      // relationship does not cascade automatically.
      const { error: boardsError } = await supabase.from("marker_boards").delete().eq("worksite_id", worksiteId);
      if (boardsError) {
        setToast("Could not delete marker boards for this work site: " + boardsError.message);
        return;
      }
      const { error } = await supabase.from("worksites").delete()
        .eq("id", worksiteId).eq("company_id", membership.company_id);
      if (error) {
        setToast("Could not delete work site: " + error.message);
        return;
      }
      const { data, error: refreshError } = await supabase.from("worksites")
        .select("id, name, reference, description, boundary, status, possession_status, planned_start_at, planned_end_at, elr, route_reference, start_miles, start_chains, end_miles, end_chains, created_at")
        .eq("company_id", membership.company_id).order("created_at", { ascending: false });
      if (!refreshError && data) setCalendarWorksites(data);
      setWorksiteId(null);
      setWorkSiteName("");
      setWorkRef("");
      setWorkSite([]);
      setTasks([]);
      setSelectedId("");
      setPhotoPreviews({});
      setPossessionEditorOpen(false);
      setToast("Work site and its marker boards deleted.");
      window.setTimeout(() => setToast(""), 4500);
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
        .select("id, board_code, label, latitude, longitude, status, assigned_to, assigned_email, notes, elr, route_reference, mileage_miles, mileage_chains, photo_url, submitted_latitude, submitted_longitude, submitted_gps_accuracy_m, submitted_at, verified_at, verification_notes, placement_requested_at")
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
          const status = row.status === "verified" ? "Verified" : row.status === "placed" ? "Awaiting PICOP verification" : row.assigned_email ? "Assigned" : "Unassigned";
          return {
            id: code,
            dbId: row.id,
            label: row.label || `Marker board ${index + 1}`,
            assignee: row.assigned_to || "Unassigned",
            assignedEmail: row.assigned_email || "",
            photoUrl: row.photo_url || "",
            submittedLatitude: row.submitted_latitude,
            submittedLongitude: row.submitted_longitude,
            submittedGpsAccuracy: row.submitted_gps_accuracy_m,
            submittedAt: row.submitted_at,
            verifiedAt: row.verified_at,
            verificationNotes: row.verification_notes || "",
            placementRequestedAt: row.placement_requested_at,
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
      } else {
        setTasks([]);
        setSelectedId("");
      }
    };
    void loadBoards();
    return () => { active = false; };
  }, [membership?.company_id, worksiteId]);

  const startNewPossession = (dateString) => {
    setSelectedCalendarDate(dateString);
    const chosenDate = new Date(`${dateString}T12:00:00`);
    setCalendarMonth(new Date(chosenDate.getFullYear(), chosenDate.getMonth(), 1));
    setPossessionEditorOpen(true);
    setEditorPlacingBoard(false);
    setWorksiteId(null);
    setWorkSiteName("");
    setWorkRef("");
    setWorkSite([]);
    setElr("");
    setRouteReference("");
    setStartMiles("");
    setStartChains("");
    setEndMiles("");
    setEndChains("");
    setAssignedPicopEmail("");
    setPicopResponse("pending");
    setPossessionStatus("Planning");
    setPlannedStartAt(`${dateString}T00:00`);
    setPlannedEndAt("");
    setTasks([]);
    setSelectedId("");
    setPhotoPreviews({});
    setToast("New possession draft started. Change the start time from 00:00 to the planned time, add the finish time, ELR, route and mileage, then save.");
    window.setTimeout(() => setToast(""), 5000);
  };

  const openPossession = (row) => {
    setWorksiteId(row.id);
    setWorkSiteName(row.name || "");
    setWorkRef(row.reference || "");
    setWorkSite(Array.isArray(row.boundary) ? row.boundary : []);
    setElr(row.elr || "");
    setRouteReference(row.route_reference || "");
    setStartMiles(row.start_miles ?? "");
    setStartChains(row.start_chains ?? "");
    setEndMiles(row.end_miles ?? "");
    setEndChains(row.end_chains ?? "");
    setAssignedPicopEmail(row.assigned_picop_email || "");
    setPicopResponse(row.picop_response || "pending");
    setPossessionStatus(row.possession_status || row.status || "Planning");
    setPlannedStartAt(row.planned_start_at ? toLocalDateTime(row.planned_start_at) : "");
    setPlannedEndAt(row.planned_end_at ? toLocalDateTime(row.planned_end_at) : "");
    setSelectedCalendarDate(row.planned_start_at ? toLocalDateTime(row.planned_start_at).slice(0, 10) : "");
    setPossessionEditorOpen(true);
    setEditorPlacingBoard(false);
    if (worksiteId !== row.id) {
      setTasks([]);
      setSelectedId("");
      setPhotoPreviews({});
    }
    setToast("Possession loaded. Changes will be saved to this calendar entry.");
    window.setTimeout(() => setToast(""), 3500);
  };

  const selectWorksiteTasks = (row) => {
    if (!row) return;
    setWorksiteId(row.id);
    setWorkSiteName(row.name || "");
    setWorkRef(row.reference || "");
    setWorkSite(Array.isArray(row.boundary) ? row.boundary : []);
    setElr(row.elr || "");
    setRouteReference(row.route_reference || "");
    setStartMiles(row.start_miles ?? "");
    setStartChains(row.start_chains ?? "");
    setEndMiles(row.end_miles ?? "");
    setEndChains(row.end_chains ?? "");
    setAssignedPicopEmail(row.assigned_picop_email || "");
    setPicopResponse(row.picop_response || "pending");
    setPossessionStatus(row.possession_status || row.status || "Planning");
    setPlannedStartAt(row.planned_start_at ? toLocalDateTime(row.planned_start_at) : "");
    setPlannedEndAt(row.planned_end_at ? toLocalDateTime(row.planned_end_at) : "");
    setTasks([]);
    setSelectedId("");
    setPhotoPreviews({});
    setPhotoFiles({});
    setActivePage("boards");
  };

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
      setPhotoFiles(prev => ({ ...prev, [selected.id]: file }));
      updateTask(selected.id, { photoName: file.name });
      setToast("Photo selected. Get a GPS fix, then confirm board placement to submit the evidence.");
      window.setTimeout(() => setToast(""), 4500);
    };
    reader.readAsDataURL(file);
  };

  const confirmBoardPlaced = async () => {
    if (!selected.dbId || !worksiteId) { setToast("Save the work site and marker board before submitting evidence."); return; }
    if (!selected.placementRequestedAt) { setToast("The PICOP has not requested this board to be placed yet."); return; }
    const file = photoFiles[selected.id];
    if (!file) { setToast("Take or select a photo of the placed marker board first."); return; }
    if (!gps) { setToast("Get a live GPS fix before confirming placement."); return; }
    setWorkflowBusyId(selected.id);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${worksiteId}/${selected.dbId}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("railsite-board-evidence").upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const { error } = await supabase.rpc("operative_submit_marker_board", {
        p_marker_board_id: selected.dbId, p_photo_path: path,
        p_latitude: gps.position[0], p_longitude: gps.position[1], p_accuracy_m: gps.accuracy
      });
      if (error) throw error;
      updateTask(selected.id, { status: "Awaiting PICOP verification", photoUrl: path, submittedLatitude: gps.position[0], submittedLongitude: gps.position[1], submittedGpsAccuracy: gps.accuracy, submittedAt: new Date().toISOString() });
      setToast("Board placement submitted with photo and GPS evidence. The PICOP has been notified.");
    } catch (error) { setToast("Could not submit board evidence: " + (error?.message || "Please try again.")); }
    finally { setWorkflowBusyId(""); }
  };

  const verifySelectedBoard = async (approved) => {
    if (!selected.dbId) return;
    setWorkflowBusyId(selected.id);
    const { error } = await supabase.rpc("picop_verify_marker_board", { p_marker_board_id: selected.dbId, p_approved: approved, p_notes: selected.verificationNotes || null });
    if (error) setToast("Could not verify marker board: " + error.message);
    else {
      updateTask(selected.id, { status: approved ? "Verified" : "Assigned", verificationNotes: selected.verificationNotes || "" });
      setToast(approved ? "Marker-board evidence verified." : "Board returned for correction. The assigned user has been notified.");
    }
    setWorkflowBusyId("");
  };

  const activateWorksite = async (item) => {
    setWorkflowBusyId(item.id);
    const { data, error } = await supabase.rpc("picop_activate_worksite", { p_worksite_id: item.id });
    if (error) setToast("Work site cannot be activated yet: " + error.message);
    else {
      setCalendarWorksites(prev => prev.map(row => row.id === item.id ? { ...row, status: "active", possession_status: "In progress", activated_at: new Date().toISOString() } : row));
      setToast(`Work site activated. ${data?.verified_boards ?? "All"} marker boards were verified.`);
    }
    setWorkflowBusyId("");
  };

  const assignSelectedBoard = async (email) => {
    if (!selected.dbId) { setToast("Save this work site and board before assigning a user."); return; }
    setWorkflowBusyId(selected.id);
    const { error } = await supabase.rpc("picop_assign_marker_board", { p_marker_board_id: selected.dbId, p_member_email: email });
    if (error) setToast("Could not assign marker board: " + error.message);
    else {
      const profile = teamOptions.find(item => item.email === email);
      updateTask(selected.id, { assignedEmail: email, assignee: profile?.display_name || email, status: "Assigned" });
      setToast("Marker board assigned. The placement request will notify this user when the PICOP requests placement.");
    }
    setWorkflowBusyId("");
  };

  const visibleTasks = useMemo(() => filter === "All tasks" ? tasks : tasks.filter(t => t.status === filter), [tasks, filter]);
  const count = (status) => tasks.filter(t => t.status === status).length;

  if (authLoading) return <main className="login-page"><section className="login-card"><div className="login-brand-mark">R</div><h1>Opening RailSite…</h1><p className="login-intro">Checking your secure session.</p></section></main>;
   if (!session || !membership) return <LoginScreen configured={Boolean(supabase)} loading={authLoading} error={authError} onSignIn={handleSignIn} onResetPassword={handleResetPassword} />;

  return <div className={"app-shell " + (sidebarCollapsed ? "sidebar-collapsed" : "")}>
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

    <div className="app-frame">
      <aside className="app-sidebar" aria-label="Main navigation">
        <button className="sidebar-toggle" type="button" onClick={() => setSidebarCollapsed(v => !v)} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}><span>{sidebarCollapsed ? "☰" : "‹"}</span><span className="sidebar-label">{sidebarCollapsed ? "" : "Collapse menu"}</span></button>
        <div className="sidebar-section-label">WORKSPACE</div>
        {membership.role !== "member" && <button className={`sidebar-link ${activePage === "overview" ? "sidebar-link-active" : ""}`} onClick={() => setActivePage("overview")}><span className="sidebar-icon">▦</span><span className="sidebar-label">{membership.role === "planner" ? "Planning overview" : membership.role === "picop" ? "PICOP overview" : "Overview"}</span></button>}
        {membership.role !== "member" && <button className={`sidebar-link ${activePage === "calendar" ? "sidebar-link-active" : ""}`} onClick={() => setActivePage("calendar")}><span className="sidebar-icon">▦</span><span className="sidebar-label">Possession calendar</span></button>}
        {["owner", "admin"].includes(membership.role) && <button className={`sidebar-link ${activePage === "map" ? "sidebar-link-active" : ""}`} onClick={() => setActivePage("map")}><span className="sidebar-icon">⌖</span><span className="sidebar-label">Worksites &amp; map</span></button>}
        {membership.role !== "planner" && <button className={`sidebar-link ${activePage === "boards" ? "sidebar-link-active" : ""}`} onClick={() => setActivePage("boards")}><span className="sidebar-icon">⚑</span><span className="sidebar-label">{membership.role === "member" ? "My board tasks" : "Marker boards &amp; tasks"}</span></button>}
        {["owner", "admin"].includes(membership.role) && <button className={`sidebar-link ${activePage === "profiles" ? "sidebar-link-active" : ""}`} onClick={() => setActivePage("profiles")}><span className="sidebar-icon">♙</span><span className="sidebar-label">Manage profiles</span></button>}
        <div className="sidebar-spacer"></div><div className="sidebar-footer"><span className="online-dot"/><span className="sidebar-label">Company workspace</span></div>
      </aside>
      <main className="workspace">
      {notifications.length > 0 && <section className="notification-center" aria-label="Notifications"><div className="notification-center-heading"><strong>Notifications</strong><span>{notifications.length} unread</span></div>{notifications.map(note => <div className="notification-row" key={note.id}><span className="notification-mark">!</span><p>{note.message}<small>{new Date(note.created_at).toLocaleString("en-GB")}</small></p><button type="button" onClick={() => markNotificationRead(note.id)} aria-label="Mark notification as read">×</button></div>)}</section>}
      {activePage === "calendar" && <>
      {["owner", "admin", "planner"].includes(membership.role) && null}
      <section className="planning-calendar" id="calendar-screen">
        <div className="calendar-heading">
          <div><div className="eyebrow">POSSESSION PLANNING</div><h2>Possession calendar</h2><p>Select a date to plan a new possession, or open an existing one.</p></div>
          <div className="calendar-actions">
            <button className="btn btn-secondary" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth()-1, 1))} aria-label="Previous month">‹</button>
            <strong>{calendarMonth.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</strong>
            <button className="btn btn-secondary" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth()+1, 1))} aria-label="Next month">›</button>
            {["owner", "admin", "planner"].includes(membership.role) && <button className="btn btn-primary" onClick={() => startNewPossession(toLocalDateTime(new Date()).slice(0, 10))}>+ New possession</button>}
          </div>
        </div>
        <div className="calendar-weekdays">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(day => <div key={day}>{day}</div>)}</div>
        <div className="calendar-grid">
          {Array.from({ length: 42 }, (_, index) => {
            const first = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
            const offset = (first.getDay() + 6) % 7;
            const dayDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), index - offset + 1);
            const dateKey = `${dayDate.getFullYear()}-${String(dayDate.getMonth()+1).padStart(2,"0")}-${String(dayDate.getDate()).padStart(2,"0")}`;
            const inMonth = dayDate.getMonth() === calendarMonth.getMonth();
            const entries = calendarWorksites.filter(item => item.planned_start_at && toLocalDateTime(item.planned_start_at).slice(0, 10) === dateKey);
            return <div key={dateKey} className={`calendar-day ${inMonth ? "" : "calendar-day-muted"} ${selectedCalendarDate === dateKey ? "calendar-day-selected" : ""}`}>
              <button className="calendar-day-number" onClick={() => ["owner", "admin", "planner"].includes(membership.role) ? startNewPossession(dateKey) : setSelectedCalendarDate(dateKey)} aria-label={`${["owner", "admin", "planner"].includes(membership.role) ? "Plan possession on" : "Select"} ${dayDate.toLocaleDateString("en-GB")}`}>{dayDate.getDate()}</button>
              {["owner", "admin", "planner"].includes(membership.role) && <button className="calendar-add-day" onClick={() => startNewPossession(dateKey)} aria-label={`Add possession on ${dayDate.toLocaleDateString("en-GB")}`}>+ Plan</button>}
              <div className="calendar-day-events">
                {entries.map(item => <div key={item.id} className="calendar-event-wrap">
                  <button className={`calendar-event event-${statusClass(item.possession_status || item.status || "Planning")}`} onClick={() => ["owner", "admin", "planner"].includes(membership.role) ? openPossession(item) : selectWorksiteTasks(item)} title={item.name}>
                    <span>{item.name || "Untitled possession"}</span>
                    <small>{(item.possession_status || item.status || "").toLowerCase() === "cancelled" ? "CANCELLED · " : ""}{item.elr || "ELR TBC"}{item.start_miles !== null && item.start_miles !== undefined ? ` · ${item.start_miles}m ${String(item.start_chains ?? 0).padStart(2,"0")}ch` : ""}{item.assigned_picop_email ? ` · PICOP: ${item.assigned_picop_email}` : " · PICOP unassigned"}{item.picop_response && item.picop_response !== "pending" ? ` · ${item.picop_response.toUpperCase()}` : ""}</small>
                  </button>
                  {membership.role === "picop" && (item.picop_response || "pending") === "pending" && <div className="picop-event-actions"><button type="button" onClick={() => respondToPossession(item,"accepted")} disabled={workflowBusyId === item.id}>Accept</button><button type="button" onClick={() => respondToPossession(item,"declined")} disabled={workflowBusyId === item.id}>Decline</button></div>}
                  {membership.role === "picop" && item.picop_response === "accepted" && !item.board_placement_requested_at && <div className="picop-event-actions"><button type="button" className="request-boards-button" onClick={() => requestBoardPlacement(item)} disabled={workflowBusyId === item.id}>Request board placement</button></div>}
                  {membership.role === "picop" && item.board_placement_requested_at && <div className="picop-event-actions"><button className="request-boards-button" type="button" onClick={() => activateWorksite(item)} disabled={workflowBusyId === item.id || item.activated_at}>{item.activated_at ? "Work site active" : workflowBusyId === item.id ? "Checking board evidence…" : "Activate work site"}</button></div>}
                </div>)}
              </div>
            </div>;
          })}
        </div>
        <div className="calendar-legend"><span><i className="legend-planning"/> Planning</span><span><i className="legend-active"/> In progress</span><span><i className="legend-complete"/> Complete</span><span>{calendarWorksites.length} saved possession(s)</span></div>
      </section>
      {possessionEditorOpen && ["owner", "admin", "planner"].includes(membership.role) && <div className="possession-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) { setPossessionEditorOpen(false); setEditorPlacingBoard(false); } }}>
        <section className="possession-modal" role="dialog" aria-modal="true" aria-labelledby="possession-editor-title">
          <div className="possession-modal-header">
            <div><div className="eyebrow">POSSESSION PLANNING</div><h2 id="possession-editor-title">{worksiteId ? "Edit possession" : "Plan a new possession"}</h2><p>{selectedCalendarDate ? new Date(`${selectedCalendarDate}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "Set the date, time and railway mileage"}</p></div>
            <button className="calendar-close" type="button" onClick={() => { setPossessionEditorOpen(false); setEditorPlacingBoard(false); }} aria-label="Close possession editor">×</button>
          </div>
          <div className="possession-modal-body">
            <div className="possession-form-grid">
              <label>Possession / work-site name<input value={workSiteName} onChange={e => setWorkSiteName(e.target.value)} placeholder="e.g. Grantham track renewal" autoFocus /></label>
              <label>Work-site reference<input value={workRef} onChange={e => setWorkRef(e.target.value)} placeholder="e.g. WS-2026-014" /></label>
              <label>Possession status<select value={possessionStatus} onChange={e => setPossessionStatus(e.target.value)}><option>Planning</option><option>Briefing</option><option>In progress</option><option>Suspended</option><option>Complete</option><option>Cancelled</option></select></label>
              <label>Assign PICOP<select value={assignedPicopEmail} onChange={e => { setAssignedPicopEmail(e.target.value); setPicopResponse("pending"); }}><option value="">Select a PICOP…</option>{picopOptions.map(profile => <option key={profile.user_id} value={profile.email}>{profile.display_name ? profile.display_name + " — " : ""}{profile.email}</option>)}</select></label>
              <div className="possession-time-row">
                <label>Exact start date &amp; time<input type="datetime-local" value={plannedStartAt} onChange={e => { setPlannedStartAt(e.target.value); setSelectedCalendarDate(e.target.value.slice(0,10)); }} required /></label>
                <label>Exact finish date &amp; time<input type="datetime-local" value={plannedEndAt} onChange={e => setPlannedEndAt(e.target.value)} required /></label>
              </div>
            </div>
            <div className="possession-mileage-form">
              <div className="modal-section-heading"><div><strong>Railway location</strong><small>Use the operational ELR and route mileage, in miles and chains</small></div><span className="mileage-format-tag">Miles &amp; chains</span></div>
              <div className="possession-form-grid two">
                <label>ELR<input value={elr} onChange={e => setElr(e.target.value.toUpperCase())} placeholder="e.g. GRAN" /></label>
                <label>Route / line reference<input value={routeReference} onChange={e => setRouteReference(e.target.value)} placeholder="Route / line" /></label>
              </div>
              <div className="mileage-range-fields">
                <div className="mileage-endpoint"><span>Work-site FROM</span><div><label>Miles<input type="number" min="0" step="1" value={startMiles} onChange={e => setStartMiles(e.target.value)} placeholder="0" /></label><label>Chains<input type="number" min="0" max="79" step="1" value={startChains} onChange={e => setStartChains(e.target.value)} placeholder="00" /></label></div></div>
                <div className="mileage-endpoint"><span>Work-site TO</span><div><label>Miles<input type="number" min="0" step="1" value={endMiles} onChange={e => setEndMiles(e.target.value)} placeholder="0" /></label><label>Chains<input type="number" min="0" max="79" step="1" value={endChains} onChange={e => setEndChains(e.target.value)} placeholder="00" /></label></div></div>
              </div>
            </div>
            <div className="possession-map-editor">
              <div className="modal-section-heading"><div><strong>Marker boards</strong><small>{tasks.length} board(s) in this possession. Add pins here or enter their mileage in the board details after saving.</small></div><button type="button" className={`btn ${editorPlacingBoard ? "btn-warning" : "btn-secondary"}`} onClick={() => setEditorPlacingBoard(v => !v)}>{editorPlacingBoard ? "Tap map to place…" : "+ Place board"}</button></div>
              <div className="possession-mini-map">
                <MapContainer center={[52.915, -0.636]} zoom={13} minZoom={5} maxZoom={19} zoomControl={true} scrollWheelZoom={true}>
                  <LayersControl position="topright"><LayersControl.BaseLayer checked name="OpenStreetMap"><TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /></LayersControl.BaseLayer><LayersControl.Overlay name="Railway infrastructure (OpenRailwayMap)"><TileLayer attribution='Data &copy; OpenStreetMap contributors · OpenRailwayMap' url="https://tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png" maxZoom={19} /></LayersControl.Overlay></LayersControl>
                  <MapClickHandler enabled={editorPlacingBoard} onSelect={position => {
                    let nextNumber = 1;
                    while (tasks.some(task => task.id === `MB-${String(nextNumber).padStart(2,"0")}`)) nextNumber += 1;
                    const id = `MB-${String(nextNumber).padStart(2,"0")}`;
                    const newTask = { id, label: `Marker board ${nextNumber}`, assignee: "Unassigned", status: "Unassigned", position, elr, routeReference, mileageMiles: "", mileageChains: "", notes: "", demo: false, dbId: null };
                    setTasks(prev => [...prev, newTask]);
                    setSelectedId(id);
                    setEditorPlacingBoard(false);
                    setToast(`${id} added to this possession. Set its mileage reference in the board details.`);
                  }} />
                  {tasks.filter(task => !task.demo).map(task => <Marker key={task.id} position={task.position} icon={boardIcon}><Popup><strong>{task.label}</strong><br/>{task.id}</Popup></Marker>)}
                </MapContainer>
              </div>
              <p className="map-safety-note">Map pins placed manually are approximate. Accurate automatic positioning from ELR + miles/chains requires a validated railway track-mileage dataset for the correct route and track; RailSite will not infer a safety-critical position from GPS or a generic basemap.</p>
              {tasks.filter(task => !task.demo).length > 0 && <div className="modal-board-list">{tasks.filter(task => !task.demo).map(task => <div className="modal-board-row" key={task.id}><div className="modal-board-row-heading"><span><strong>{task.label}</strong><small>Board reference: {task.elr || elr || "ELR TBC"} / {task.routeReference || routeReference || "route TBC"}</small></span><button type="button" onClick={() => setTasks(prev => prev.filter(item => item.id !== task.id))} aria-label={`Remove ${task.label}`}>Remove</button></div><div className="modal-board-mileage"><label>ELR<input value={task.elr || elr} onChange={e => setTasks(prev => prev.map(item => item.id === task.id ? {...item, elr:e.target.value.toUpperCase()} : item))} placeholder="ELR" /></label><label>Route<input value={task.routeReference || routeReference} onChange={e => setTasks(prev => prev.map(item => item.id === task.id ? {...item, routeReference:e.target.value} : item))} placeholder="Route / line" /></label><label>Miles<input type="number" min="0" step="1" value={task.mileageMiles} onChange={e => setTasks(prev => prev.map(item => item.id === task.id ? {...item, mileageMiles:e.target.value} : item))} placeholder="Miles" /></label><label>Chains<input type="number" min="0" max="79" step="1" value={task.mileageChains} onChange={e => setTasks(prev => prev.map(item => item.id === task.id ? {...item, mileageChains:e.target.value} : item))} placeholder="00–79" /></label></div></div>)}</div>}
            </div>
          </div>
          <div className="possession-modal-footer"><span>Changes are saved to the shared company workspace.</span><div className="possession-footer-actions">{worksiteId && possessionStatus !== "Cancelled" && <button className="btn btn-danger" type="button" onClick={cancelWorksite} disabled={siteSaving}>Cancel work site</button>}{worksiteId && <button className="btn btn-danger-outline" type="button" onClick={deleteWorksite} disabled={siteSaving}>Delete work site</button>}<button className="btn btn-secondary" type="button" onClick={() => { setPossessionEditorOpen(false); setEditorPlacingBoard(false); }}>Close</button><button className="btn btn-primary" type="button" onClick={saveWorksite} disabled={siteSaving || siteLoading}>{siteSaving ? "Saving…" : "Save possession"}</button></div></div>
        </section>
      </div>}
      </>}
      {membership.role !== "member" && activePage === "overview" && <section className="dashboard-overview" id="overview-screen">
        <div className="dashboard-heading">
          <div><div className="eyebrow">OPERATIONS CONTROL</div><h1>{membership.role === "planner" ? "Planning overview" : "PICOP dashboard"}</h1><p>{membership.role === "planner" ? "Plan possessions, manage the calendar and track PICOP responses." : "Work-site status, marker-board progress and railway location reference."}</p></div>
          <div className="dashboard-live"><span className="online-dot"/><span>SESSION ACTIVE</span><small>{membership.companies?.name || "Company workspace"}</small></div>
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
      </section>}
      {["owner", "admin"].includes(membership.role) && activePage === "map" && <section className="map-column" id="map-screen">
        <div className="site-toolbar">
          <div className="site-title-group">
            <div className="eyebrow">ACTIVE WORK SITE</div>
            <input className="site-name" value={workSiteName} onChange={e => setWorkSiteName(e.target.value)} aria-label="Work site name" />
            <div className="site-ref"><input value={workRef} onChange={e => setWorkRef(e.target.value)} aria-label="Work-site reference" placeholder="Work-site reference"/> <span className="separator">•</span> {siteLoading ? "Loading saved site…" : worksiteId ? "Saved work site" : "New work-site draft"}</div>
          </div>
          <div className="toolbar-actions">
            <button className={`btn ${placingPin ? "btn-warning" : "btn-secondary"}`} onClick={() => setPlacingPin(v => !v)}>{placingPin ? "Tap map to place pin" : "+ Place board pin"}</button>
            <button className="btn btn-primary" onClick={saveWorksite} disabled={!worksiteId || siteSaving || siteLoading}>{siteSaving ? "Saving…" : "Save work site changes"}</button>
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
      </section>}

      {["owner", "admin", "picop", "member"].includes(membership.role) && activePage === "boards" && <aside className="side-panel" id="boards-screen">
        <div className="panel-heading">
          <div><div className="eyebrow">{membership.role === "member" ? "MY ASSIGNED TASKS" : membership.role === "picop" ? "PICOP DASHBOARD" : "WORKSITE TASKS"}</div><h1>{membership.role === "member" ? "My board tasks" : "Work-site tasks"}</h1>{["picop","member"].includes(membership.role) && <label className="worksite-task-picker">Work site<select value={worksiteId || ""} onChange={e => { const row = calendarWorksites.find(item => item.id === e.target.value); if (row) selectWorksiteTasks(row); }}><option value="" disabled>Select a work site…</option>{calendarWorksites.map(row => <option key={row.id} value={row.id}>{row.name || row.reference || "Untitled work site"}</option>)}</select></label>}</div>
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
          {membership.role !== "member" && <div className="field">
            <label htmlFor="assignee">Assign team member</label>
            <select id="assignee" value={selected.assignedEmail || ""} disabled={membership.role === "picop" && workflowBusyId === selected.id} onChange={e => membership.role === "picop" ? assignSelectedBoard(e.target.value) : updateTask(selected.id, { assignedEmail: e.target.value, assignee: teamOptions.find(item => item.email === e.target.value)?.display_name || e.target.value || "Unassigned", status: e.target.value ? "Assigned" : "Unassigned" })}>
              <option value="">Unassigned</option>{teamOptions.map(profile => <option key={profile.user_id} value={profile.email}>{profile.display_name ? profile.display_name + " — " : ""}{profile.email}</option>)}
            </select>
          </div>}
          <div className="marker-mileage-card">
            <div className="eyebrow">BOARD LOCATION REFERENCE</div>
            <div className="marker-reference-fields">
              <label>ELR<input disabled={["member","picop"].includes(membership.role)} value={selected.elr || ""} onChange={e => updateTask(selected.id, { elr: e.target.value.toUpperCase() })} placeholder="ELR"/></label>
              <label>Route / line<input disabled={["member","picop"].includes(membership.role)} value={selected.routeReference || ""} onChange={e => updateTask(selected.id, { routeReference: e.target.value })} placeholder="Route or line"/></label>
            </div>
            <div className="marker-chain-fields">
              <label>Miles<input disabled={["member","picop"].includes(membership.role)} type="number" min="0" step="1" value={selected.mileageMiles ?? ""} onChange={e => updateTask(selected.id, { mileageMiles: e.target.value })} placeholder="0"/></label>
              <label>Chains (0–79)<input disabled={["member","picop"].includes(membership.role)} type="number" min="0" max="79" step="1" value={selected.mileageChains ?? ""} onChange={e => updateTask(selected.id, { mileageChains: e.target.value })} placeholder="00"/></label>
            </div>
            <small>Board mileage is saved with the work site. The map pin remains a manually placed visual reference until an approved railway geometry dataset is connected.</small>
          </div>
          <div className="field">
            <label htmlFor="notes">Instructions</label>
            <textarea id="notes" rows="2" disabled={["member","picop"].includes(membership.role)} value={selected.notes || ""} onChange={e => updateTask(selected.id, { notes: e.target.value })} placeholder="Add task instructions…"/>
          </div>
          <div className="coord-box">
            <div><span>Map latitude</span><strong>{selected.position[0].toFixed(6)}</strong></div>
            <div><span>Map longitude</span><strong>{selected.position[1].toFixed(6)}</strong></div>
          </div>
          {membership.role === "member" && <button className="btn btn-secondary btn-full" onClick={requestGps}>◎ Get my current GPS location</button>}
          {gpsError && <div className="inline-error">{gpsError}</div>}
          {gps && <div className="gps-confirm"><span className="online-dot"/> Location acquired · ±{gps.accuracy} m</div>}
          {membership.role === "member" && <div className="field photo-field">
            <label htmlFor="photo">Photo evidence</label>
            <label className="upload-zone" htmlFor="photo">
              {photoPreviews[selected.id] ? <img src={photoPreviews[selected.id]} alt="Selected task evidence preview"/> : <><span className="upload-icon">↑</span><strong>Choose a photo</strong><small>Use your phone camera or select an image</small></>}
            </label>
            <input id="photo" className="file-input" type="file" accept="image/*" capture="environment" onChange={onPhoto}/>
            {selected.photoName && <div className="file-caption">Attached: {selected.photoName}</div>}
          </div>}
          {selected.photoUrl && <div className="board-evidence-card"><strong>Submitted placement evidence</strong>{photoPreviews[selected.id] ? <img src={photoPreviews[selected.id]} alt="Marker board placement evidence"/> : <button type="button" className="btn btn-secondary btn-full" onClick={async () => { const { data, error } = await supabase.storage.from("railsite-board-evidence").createSignedUrl(selected.photoUrl, 3600); if (error) setToast("Could not open evidence photo: " + error.message); else window.open(data.signedUrl, "_blank", "noopener,noreferrer"); }}>View submitted photo</button>}<small>Submitted {selected.submittedAt ? new Date(selected.submittedAt).toLocaleString("en-GB") : "time unavailable"} · GPS ±{selected.submittedGpsAccuracy ?? "?"} m</small><small>{selected.submittedLatitude != null ? `GPS: ${Number(selected.submittedLatitude).toFixed(6)}, ${Number(selected.submittedLongitude).toFixed(6)}` : "GPS evidence unavailable"}</small></div>}
          {membership.role === "member" && <div className="operative-confirm-panel"><strong>Placement confirmation</strong><p>{selected.placementRequestedAt ? "The PICOP has requested this board. Photograph it in place, acquire GPS, then confirm." : "Waiting for the PICOP to request board placement. You cannot confirm placement before that request."}</p>{selected.verificationNotes && <div className="inline-error">PICOP feedback: {selected.verificationNotes}</div>}{selected.placementRequestedAt && selected.status !== "Verified" && <button className="btn btn-primary btn-full" onClick={confirmBoardPlaced} disabled={workflowBusyId === selected.id || !photoFiles[selected.id] || !gps}>{workflowBusyId === selected.id ? "Submitting evidence…" : "Confirm board placed with photo + GPS"}</button>}</div>}
          {membership.role === "picop" && selected.status === "Awaiting PICOP verification" && <div className="operative-confirm-panel"><strong>PICOP verification</strong><label className="verification-notes-label">Notes for the operative<textarea rows="2" value={selected.verificationNotes || ""} onChange={e => updateTask(selected.id, { verificationNotes: e.target.value })} placeholder="Required if returning for correction"/></label><div className="button-row"><button className="btn btn-danger" onClick={() => verifySelectedBoard(false)} disabled={workflowBusyId === selected.id || !(selected.verificationNotes || "").trim()}>Return for correction</button><button className="btn btn-primary" onClick={() => verifySelectedBoard(true)} disabled={workflowBusyId === selected.id}>Verify evidence</button></div></div>}
          {["owner", "admin", "planner"].includes(membership.role) && <button className="btn btn-danger btn-full delete-board-button" onClick={deleteSelectedBoard} disabled={!selected.id}>Delete selected marker board</button>}
          <p className="safety-note"><strong>Safety note:</strong> This prototype does not confirm railway protection, safe access, or correct placement. Use approved railway procedures and independent checks.</p>
          </>}
        </div>
        <div className="panel-bottom-note"><span className="lock-icon">▣</span> Demo data only · Changes are not saved between reloads</div>
      </aside>}
      {activePage === "profiles" && ["owner", "admin"].includes(membership.role) && <section className="profiles-page">
        <div className="dashboard-heading"><div><div className="eyebrow">COMPANY ACCESS</div><h1>Manage profiles</h1><p>Create accounts and assign the correct RailSite role. New users receive an invitation email to set their password.</p></div><div className="dashboard-live"><span className="online-dot"/><span>{companyProfiles.length} PROFILES</span></div></div>
        <div className="profiles-layout">
          <form className="profile-create-card" onSubmit={createProfile}>
            <div className="profile-card-heading"><span className="overview-icon">＋</span><div><h2>Create a profile</h2><p>Invitation sent to the user's email address</p></div></div>
            <label>Full name<input value={profileName} onChange={e => setProfileName(e.target.value)} required placeholder="e.g. Jamie Taylor" autoComplete="name"/></label>
            <label>Work email address<input type="email" value={profileEmail} onChange={e => setProfileEmail(e.target.value)} required placeholder="name@company.co.uk" autoComplete="email"/></label>
             <label>Profile type<select value={profileRole} onChange={e => setProfileRole(e.target.value)}><option value="planner">Planner — possessions and calendar</option><option value="picop">PICOP — acceptance and board verification</option><option value="member">Board-placement user — assigned tasks</option></select></label>
            <div className="profile-role-note">{profileRole === "planner" ? "Can create, schedule, edit, cancel and delete work sites." : profileRole === "picop" ? "Can review assigned possessions and manage marker-board verification." : "Can view assigned board tasks and submit placement evidence."}</div>
            <button className="btn btn-primary btn-full" type="submit" disabled={profileSaving}>{profileSaving ? "Creating profile…" : "Create profile & send invitation"}</button>
          </form>
          <section className="profile-list-card"><div className="profile-card-heading"><span className="overview-icon">♙</span><div><h2>Company profiles</h2><p>Role assignments for this workspace</p></div></div>
            {profilesLoading ? <p className="profile-empty">Loading profiles…</p> : companyProfiles.length === 0 ? <p className="profile-empty">No profiles found.</p> : <div className="profile-list">{companyProfiles.map(profile => <div className="profile-row" key={profile.user_id}><div className="profile-avatar">{(profile.display_name || profile.email || "?").slice(0,1).toUpperCase()}</div><div className="profile-row-main"><strong>{profile.display_name || profile.email || "Company user"}</strong><small>{profile.email || "Email not recorded"}</small></div><span className={`profile-role-badge role-${profile.role}`}>{profile.role === "member" ? "BOARD USER" : profile.role.toUpperCase()}</span></div>)}</div>}
          </section>
        </div>
        <p className="profile-security-note"><strong>Access control:</strong> Profile invitations are created by a protected server function. Do not share passwords; each user sets their own password from the invitation.</p>
      </section>}
      </main>
    </div>
    <footer className="app-footer"><span>RAILSITE MVP <b>0.1.0</b></span><span>Prototype for workflow review · Not for operational use</span></footer>
  </div>;
}
