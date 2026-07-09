# Flutter App — Offline Strategy & Performance

## Offline strategy: cache-first reads + queued writes

- **Reads** (timetable, tests, resources metadata, notifications, syllabus
  coverage): on load, serve instantly from the local Drift cache if present, then
  refresh from the network in the background and update the UI when the refresh
  lands (stale-while-revalidate). A student never sees a blank screen just because
  the network is slow — they see the last-known state immediately.
- **Writes**: the only real write path in the student app is **test attempt
  submission** (answers as the student works through a test). Answers are saved
  to the local Drift queue as the student answers each question — not just on
  final submit — so a dropped connection mid-test never loses progress. A
  background sync worker flushes the queue to the backend when connectivity
  returns; the UI shows a small "syncing" / "synced" indicator, never blocking the
  student from continuing the test.
- **Connectivity indicator**: a persistent small banner/badge when offline
  ("Showing saved data — will update when back online") so the student always
  knows whether what they're seeing is live or cached.

## Downloadable resources

- Whether a resource can be downloaded for offline viewing is a **per-resource
  flag** (`is_downloadable`), set by whoever creates it (teacher/admin) — not a
  blanket app setting. Only meaningful for **upload**-type resources (the bytes
  are ours to serve); **link**-type resources (e.g. Google Drive) always open
  externally and need a live connection, since that's outside our control.
- Downloaded files are stored in the app's local file storage; the Resources
  screen shows a clear downloaded/not-downloaded state per item and lets the
  student manage (delete) downloads to reclaim space.

## Performance guidelines

- `ListView.builder` (lazy) for every list — never build all items eagerly.
- `cached_network_image` (disk-cached) for any network images (logos, thumbnails).
- Riverpod's granular providers/`select` to minimize widget rebuilds — avoid
  rebuilding whole screens when only one piece of state changes.
- `const` constructors wherever possible.
- Keep `main()`/app startup minimal — defer non-critical service init until after
  first frame; avoid heavy synchronous work before the first screen paints.
- Paginate any list that can grow over a school year (resource lists, test
  history, notification history) rather than loading it all at once.
- Custom font (Inter) ships only the weights actually used, to keep app/download
  size down for low-bandwidth installs and updates.
