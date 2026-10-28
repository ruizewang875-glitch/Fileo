# FILEO

A desktop web prototype for organizing creative files through two project-scoped modes. The interface keeps the FILEO identity, floating file cards and restrained vaporwave gradients.

## Two ways to organize

- **Quick Clear** prioritizes efficiency. A storage/file-count ring shows the project's AI suggestion mix. The file list ranks pending Trash recommendations first, then Archive, Undecided and Keep; completed decisions move below pending work. The first three pending files receive priority markers. Select individual files, all visible files or suggested Trash files, check compact previews, then archive or move the selection to recoverable Trash.
- **Explore & Decide** prioritizes control. Floating cards lead into a file type within the selected project. Browse large previews, filter by AI suggestion, open details, select up to three files for comparison, or review a selected sequence at your own pace. Pin meaningful files and use Keep, Archive, Trash or clarification to make a decision.

The project dropdown is shared by both modes. Mode and project choices persist on this browser; returning through the homepage opens the last mode. File decisions, pinned files, review position, analysis progress and history also survive reload and local sign-out. AI recommendations remain distinct from the user's decisions.

**History** opens from the concealed side drawer. It shows project actions and supports undo/restore. Older actions cannot overwrite newer decisions on the same files; undo the latest affected action first.

## Import and originals

After prototype sign-in, choose individual files, drag them in or select a local folder, name the project and authorize local processing. An optional 21-file sample project, **Studio semester**, demonstrates the full flow. Folder-relative paths distinguish same-named files; reselecting an imported image can repair its preview without resetting its decision.

Supported images receive real thumbnails and larger previews. Open original displays browser-supported images, PDF and text in a new tab; native design formats download for opening in their desktop application. Original file copies up to 50 MiB are retained in IndexedDB when storage permits. Larger files are available during the current session and may need to be selected again after reload. The browser cannot silently scan folders or launch arbitrary installed applications.

## Run and check

This is static HTML, CSS and JavaScript with no runtime dependencies. Use Node.js for the checks:

```sh
npm test
npm run check
```

Serve `dist/` with any static server. For example:

```sh
python -m http.server 4173 --directory dist
```

Open `http://localhost:4173/`. The tests cover state persistence, project isolation, priority ordering, scoped review, preview handling, original-file handling and guarded undo. `npm run check` checks the main UI modules' JavaScript syntax.

## Vercel

Connect this repository and deploy its production branch. `vercel.json` configures:

- Framework: Other / no framework
- Build command: `npm run check`
- Output directory: `dist`
- Install command: `npm install --ignore-scripts`

No API keys or environment variables are required for this prototype.

## Prototype boundaries

Email and Google sign-in are interaction demos, not real authentication, account isolation or cloud synchronization. The email flow uses the displayed demo code `123456`.

AI suggestions are deterministic metadata heuristics; no AI API or file-content understanding is connected. A suspected copy is not verified by comparing bytes. Comparison surfaces previews, dates, sizes and recommendations for the user to assess.

All workspace data stays in this browser: metadata and decisions use localStorage (`fileo-workspace-v2`), while image previews and eligible originals use IndexedDB. Clearing browser data removes the workspace. Keep, Archive and Trash update the prototype catalog only: **source files are never modified or deleted from disk**. “Potential to clear” is an estimate, not a claim that physical disk space has been freed.

## Assets and credits

The custom FILEO symbol and wordmark are reusable SVGs in `dist/assets/`. Space Grotesk is self-hosted with its SIL Open Font License in `dist/assets/fonts/`.

`landscape.webp`, `chair.webp` and `sculpture.webp` were generated for this project. Other sample file artwork is composed in the interface. The floating-card concept was inspired by the user-supplied reference [ramp.design](https://ramp.design/).

Photoshop, Illustrator, Figma, Blender and Premiere Pro marks come from [Devicon](https://github.com/devicons/devicon) (MIT; brand marks remain their owners' property). The Rhino mark comes from [Robert McNeel & Associates](https://www.rhino3d.com/reseller/graphics/); Rhinoceros is its registered trademark. InDesign is represented by its familiar Id badge. These marks identify example file formats and imply no affiliation.
