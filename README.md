# FILEO

A desktop web prototype for organizing creative files through two project-scoped modes. The interface keeps the FILEO identity, floating file cards and restrained vaporwave gradients.

## Two ways to organize

- **Quick Clear** prioritizes efficiency. A centered storage/file-count ring shows the project's AI suggestion mix. Four overlapping rounded arc segments carry their category names along the curve. Each rounded leading head has a rounded arrow; text and arrow orientation follow the arc so the lower-half names read naturally. Clicking a segment highlights only that category and immediately filters the file list. Below the ring, the selected category name, percentage/storage/file count, and All files reset form three centered rows. The unfiltered overview shows potential cleanup capacity. Shared satin gradients and overlapping joins keep each rounded segment seamless. Very small categories retain their true proportions and use a compact accessible category control when a curved label would not fit. The file list ranks pending Trash recommendations first, then Archive, Undecided and Keep; completed decisions move below pending work. The first three pending files with permitted AI analysis receive priority markers. Select individual files, all visible files or suggested Trash files, check compact previews, then archive or move the selection to recoverable Trash.
- **Explore & Decide** prioritizes control. Floating cards lead into a file type within the selected project. Browse large previews, filter by AI suggestion, open details, select up to three files for comparison, or review a selected sequence at your own pace. Pin meaningful files and use Keep, Archive, Trash or clarification to make a decision.

Quick Clear opens with a short staged overview: total storage, file-category preparation, synchronized numbers, then the file list. The 2.5-second presentation runs on entry or project changes, never on filtering or batch decisions, and respects reduced-motion preferences. The idle overview is still, with brief selection transitions and keyboard-operable segments; reduced motion disables transitions. It visualizes the prototype state rather than scanning the disk.

The project dropdown is shared by both modes. Mode and project choices persist on this browser; returning through the homepage opens the last mode. File decisions, pinned files, review position, analysis progress and history also survive reload and local sign-out. AI recommendations remain distinct from the user's decisions.

**History** opens from the concealed side drawer. It shows project actions and supports undo/restore. Older actions cannot overwrite newer decisions on the same files; undo the latest affected action first.

## Import and originals

After prototype sign-in, choose individual files, drag them in or select a local folder, name the project and authorize local processing. An optional 37-file sample project, **Studio semester**, demonstrates the full flow. Folder-relative paths distinguish same-named files; reselecting an imported image can repair its preview without resetting its decision.

All 37 demo records have authored previews across 15 carousel categories. Matching copies share artwork; Rhino, Illustrator, Figma, office and editorial studies show meaningful differences. Imported images are decoded locally. Text, supported Office documents and simple PDFs use embedded thumbnails or bounded content excerpts when available; remaining native files show a generated **File cover**, not a simulated view of their contents. Open original displays browser-supported images, PDF and text in a new tab; native design formats download for opening in their desktop application. Original file copies up to 50 MiB are retained in IndexedDB when storage permits. Larger files are available during the current session and may need to be selected again after reload. The browser cannot silently scan folders or launch arbitrary installed applications.

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

The welcome page introduces the purpose of FILEO. New projects offer an optional preference step with presets and custom tags. Edit these through the avatar for the current project. Applicable goals update recommendations across both modes without changing user decisions or history. Click a suggestion badge in either list to see its evidence. In previews, review and comparison, evidence tags are visible and the full explanation is collapsed by default.

Suggestions use deterministic local rules; no model API is connected. Demo evidence is authored from the actual example artwork. Local recommendations use file metadata and project preferences. A suspected copy is not verified by comparing bytes. Comparison surfaces previews, dates, sizes and recommendations for the user to assess.

All workspace data stays in this browser: metadata and decisions use localStorage (`fileo-workspace-v2`), while image previews and eligible originals use IndexedDB. Clearing browser data removes the workspace. Keep, Archive and Trash update the prototype catalog only: **source files are never modified or deleted from disk**. “Potential to clear” is an estimate, not a claim that physical disk space has been freed.

## Privacy and AI access

First-use consent appears before the workspace can prepare AI suggestions. Users can allow all types, save a selected set, or continue without AI. The account panel opens the same policy and 16 per-type switches. Closing the dialog grants nothing; old workspaces must make an explicit choice. Turning a type off refreshes all projects, removes its displayed evidence and excludes its files from AI comparisons. Manual previews, decisions, originals and reversible history remain available.

Expanded recommendation details begin with a per-file reading receipt. Authorized sample files show a green **Successfully read · Demo** status and the proposed reading scope. Actual imports show **Metadata only** because the recommendation engine receives names, types, sizes and dates; local preview extraction is a separate user-facing feature. Native design formats would need compatible parsers or exports before their layers, geometry or timelines could support a real model. No AI provider receives file contents in this prototype.

The policy describes original-file and thumbnail retention, how to change permissions, and the limits of preview similarity. It is an accurate prototype disclosure, not a claim of production legal compliance. A connected model would require an updated disclosure and new consent for any external transfer.

## Assets and credits

The custom FILEO symbol and wordmark are reusable SVGs in `dist/assets/`. Space Grotesk is self-hosted with its SIL Open Font License in `dist/assets/fonts/`.

`landscape.webp`, `chair.webp` and `sculpture.webp` were generated for this project. The new nora-oak-final.webp was generated using the built-in image generator: a photoreal studio product render of a sage-upholstered lounge chair with continuous bent-oak arms and a four-leg base, centered on a warm neutral backdrop, without text. Document and design examples under dist/assets/previews/ are original vector artwork. The floating-card concept was inspired by the user-supplied reference [ramp.design](https://ramp.design/).

Photoshop, Illustrator, Figma, Blender and Premiere Pro marks come from [Devicon](https://github.com/devicons/devicon) (MIT; brand marks remain their owners' property). The Rhino mark comes from [Robert McNeel & Associates](https://www.rhino3d.com/reseller/graphics/); Rhinoceros is its registered trademark. InDesign is represented by its familiar Id badge. These marks identify example file formats and imply no affiliation.

The JSON Lines sample contains one JSON object per record. Quick Clear thumbnails, detail previews and comparisons retain the complete original image. Only the Explore home file-type carousel uses full-bleed representative covers. Choosing a type opens a grid of the actual source previews: grid, detail and comparison use the same artwork, centered and uncropped. Three studio variants in `nora-frame-study.webp`, `loop-study.webp` and `dawn-grade-study.webp` were generated from their corresponding original artwork: a stripped chrome chair frame, an early single-loop model, and a cooler dawn grade of the mountain scene. Word, PowerPoint, Excel, Acrobat and VS Code card marks use MIT-licensed artwork from [vscode-icons](https://github.com/vscode-icons/vscode-icons); the SVGs include attribution.
