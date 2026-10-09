import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css";

// Demo records only. Replace with authenticated Supabase records before operational use.
const initialTasks = [
  { id: "MB-01", label: "Marker board 1", assignee: "Alex Morgan", status: "Assigned", position: [52.9127, -0.6424], notes: "Confirm access point before travelling." },
  { id: "MB-02", label: "Marker board 2", assignee: "Jamie Taylor", status: "Photo submitted", position: [52.9150, -0.6358], notes: "Upload a clear photo showing the board in position." },
  { id: "MB-03", label: "Marker board 3", assignee: "Unassigned", status: "Unassigned", position: [52.9170, -0.6288], notes: "" }
];
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
  const [tasks, setTasks] = useState(initialTasks);
  const [selectedId, setSelectedId] = useState("MB-01");
  const [workSite, setWorkSite] = useState([[52.9115,-0.648],[52.9185,-0.648],[52.9185,-0.625],[52.9115,-0.625]]);
  const [placingPin, setPlacingPin] = useState(false);
  const [gps, setGps] = useState(null);
  const [gpsError, setGpsError] = useState("");
  const [workSiteName, setWorkSiteName] = useState("Grantham work site");
  const [workRef, setWorkRef] = useState("WS-2026-001");
  const [filter, setFilter] = useState("All tasks");
  const [toast, setToast] = useState("");
  const [photoPreviews, setPhotoPreviews] = useState({});

  const selected = tasks.find(t => t.id === selectedId) || tasks[0];
  const updateTask = (id, patch) => setTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  const setSite = React.useCallback((coords) => setWorkSite(coords), []);
  const choosePin = React.useCallback((position) => {
    if (!placingPin) return;
    const id = `MB-${String(tasks.length + 1).padStart(2, "0")}`;
    const task = { id, label: `Marker board ${tasks.length + 1}`, assignee: "Unassigned", status: "Unassigned", position, notes: "" };
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

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark"><span>R</span></div>
        <div><div className="brand-name">RAILSITE</div><div className="brand-sub">WORK-SITE COORDINATION</div></div>
      </div>
      <div className="topbar-right">
        <div className="role-chip"><span className="online-dot"/> PICOP VIEW</div>
        <button className="btn btn-quiet" onClick={() => { setToast("Authentication is not connected in this starter build."); window.setTimeout(() => setToast(""), 3000); }}>Sign in</button>
      </div>
    </header>

    <main className="workspace">
      <section className="map-column">
        <div className="site-toolbar">
          <div className="site-title-group">
            <div className="eyebrow">ACTIVE WORK SITE</div>
            <input className="site-name" value={workSiteName} onChange={e => setWorkSiteName(e.target.value)} aria-label="Work site name" />
            <div className="site-ref">{workRef} <span className="separator">•</span> Draft plan</div>
          </div>
          <div className="toolbar-actions">
            <button className={`btn ${placingPin ? "btn-warning" : "btn-secondary"}`} onClick={() => setPlacingPin(v => !v)}>{placingPin ? "Tap map to place pin" : "+ Place board pin"}</button>
            <button className="btn btn-primary" onClick={() => { setToast("Save is a demo action. Connect Supabase to persist this work site."); window.setTimeout(() => setToast(""), 3500); }}>Save work site</button>
          </div>
        </div>
        <div className="map-wrap">
          <MapContainer center={[52.915, -0.636]} zoom={14} minZoom={5} maxZoom={19} zoomControl={true} scrollWheelZoom={true}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
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
          <div className="detail-topline"><span className="eyebrow">SELECTED TASK</span><span className={`status-pill ${statusClass(selected.status)}`}>{selected.status}</span></div>
          <h2>{selected.label}</h2>
          <div className="field">
            <label htmlFor="assignee">Assign team member</label>
            <select id="assignee" value={selected.assignee} onChange={e => updateTask(selected.id, { assignee: e.target.value, status: e.target.value === "Unassigned" ? "Unassigned" : (selected.status === "Unassigned" ? "Assigned" : selected.status) })}>
              <option>Unassigned</option><option>Alex Morgan</option><option>Jamie Taylor</option><option>Sam Patel</option><option>Riley James</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="notes">Instructions</label>
            <textarea id="notes" rows="2" value={selected.notes || ""} onChange={e => updateTask(selected.id, { notes: e.target.value })} placeholder="Add task instructions…"/>
          </div>
          <div className="coord-box">
            <div><span>Latitude</span><strong>{selected.position[0].toFixed(6)}</strong></div>
            <div><span>Longitude</span><strong>{selected.position[1].toFixed(6)}</strong></div>
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
          <p className="safety-note"><strong>Safety note:</strong> This prototype does not confirm railway protection, safe access, or correct placement. Use approved railway procedures and independent checks.</p>
        </div>
        <div className="panel-bottom-note"><span className="lock-icon">▣</span> Demo data only · Changes are not saved between reloads</div>
      </aside>
    </main>
    <footer className="app-footer"><span>RAILSITE MVP <b>0.1.0</b></span><span>Prototype for workflow review · Not for operational use</span></footer>
  </div>;
}
