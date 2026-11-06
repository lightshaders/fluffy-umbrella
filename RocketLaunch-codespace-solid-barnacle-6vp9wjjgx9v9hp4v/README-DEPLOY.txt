RCLEAGUE 2.6 - CONSOLIDATED PROJECT

PROJECT LAYOUT
- turball-render/: Render Node/Express app and package files.
- turball_extracted/: game site served by turball-render/server.js.
- turball_extracted/assets/app/: all Render app chunks, the restored FriendsConnection module, and imported dependencies.
- turball_extracted/assets/releases/487732d9f2ee-39108558102-1/: active Render release assets, including non-conflicting assets merged from the supplied CDN export.
- turball_extracted/assets/releases/c9f289f8703c-41278748786-1/: complete second release snapshot from the supplied turball.io/static.turball.io export.
- source-references/: original alternate index and the unmodified loose FriendsConnection upload for reference.

RENDER SETUP
Set the Render service Root Directory to: turball-render
Build Command: npm install
Start Command: npm start
The server resolves the sibling ../turball_extracted folder, so keep both folders at the repository root.

GITHUB IMPORT
Extract the ZIP so turball-render and turball_extracted are at the repository root. Commit/push the folders and files; do not upload the ZIP as a single file.

MERGE POLICY
The supplied EXPORT/render tree was used as the main Render baseline. Files unique to the earlier RCLEAGUE2.6-main archive were added without overwriting it. Generated patches were applied oldest-to-newest so the latest versions of modified files win. The turball.io and static.turball.io assets were merged by release ID; existing files in the active 487 release were not overwritten.

NOTES
- The app uses the external api.turball.io matchmaking service. A complete local project bundle cannot guarantee that upstream service availability or its seat-reservation policy.
- Some asset URLs seen in earlier console logs (for example specific compact-audio clips and compressed .glb variants) were not present in any uploaded source archive. No placeholder media was fabricated.
- source-references/turball.io-index.html is kept separately; it is not used as the Render root index because the Render-served 487 build remains the active entry point.
