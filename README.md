# RailSite MVP

A starter prototype for railway work-site coordination:
- Interactive map with a drawable work-site boundary
- Place marker-board task pins
- Assign tasks to demo team members
- Request current browser GPS position with reported accuracy
- Attach an image preview to a task
- PICOP task list, status filters, and review actions

## Important current limitations

This is a **front-end prototype only**. It is not suitable for operational railway use.

- The basemap uses OpenStreetMap standard tiles and does **not** yet contain a verified, detailed railway track-centreline overlay.
- Demo task data lives in browser memory and is lost on reload.
- There is no login, server-side image upload, live location streaming, role-based access control, audit trail, or Supabase database connection.
- The GPS button takes a single location fix. It does not continuously track a team member.
- Status changes and "verification" are UI demonstrations, not formal railway protection or safety confirmations.
- Use only approved railway procedures and authoritative infrastructure data for real work.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Then open the local URL shown by Vite.

## Next build phase

1. Create a Supabase project and enable PostGIS.
2. Add Supabase Auth and roles: PICOP, team member, administrator.
3. Create work_sites, marker_tasks, location_updates, and photo_evidence tables with row-level security.
4. Store photos in a private Supabase Storage bucket and issue short-lived signed URLs.
5. Implement opt-in active-job location updates, visible freshness/accuracy, and stop sharing at job end.
6. Import a licensed, validated railway GIS dataset and serve it as vector tiles.
7. Add audit logs and explicit task-state transitions.

## Map data

OpenStreetMap standard raster tiles are used for this prototype, with attribution shown on the map. Review the OSM tile usage policy before production deployment. For railway infrastructure detail, import an authoritative dataset whose licensing permits your intended use and redistribution.
