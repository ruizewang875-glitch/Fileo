# FILEO

A desktop web prototype for organizing creative files through two project-scoped modes. The interface keeps the FILEO identity, floating file cards and restrained vaporwave gradients.

## Two ways to organize

- **Quick Clear** prioritizes efficiency. A centered storage/file-count ring shows the project's AI suggestion mix. Four overlapping rounded arc segments carry their category names along the curve. Each rounded leading head has a rounded arrow; text and arrow orientation follow the arc so the lower-half names read naturally. Clicking a segment highlights only that category and immediately filters the file list. Below the ring, percentage/storage/file count stay centered above a quiet Scroll to view files cue. Category names live on the ring, and clicking an already-selected segment keeps the current category. Unselected colors, names and arrows are strongly subdued. The unfiltered overview shows potential cleanup capacity. Shared satin gradients and overlapping joins keep each rounded segment seamless. Very small categories retain their true proportions and use a compact accessible category control when a curved label would not fit. The file list ranks pending Trash recommendations first, then Archive, Undecided and Keep; kept files stay in the active workspace; archived and trashed files leave both browsing modes. Rows carry a category-colored wash that fades toward the thumbnail. A thin, open thumbnail frame meets a lower-right sparkle and the AI category beneath the larger filename; no separate category tile, Top rank caption or trailing open arrow is shown. Clicking the thumbnail or filename opens its preview, while the directly visible reason tags sit to their right. Select individual files, all visible files or suggested Trash files, then archive or move the selection to recoverable Trash. Quick previews place the unboxed AI category at the top and navigation arrows beside the complete artwork. Opening a row starts a continuous preview queue in the current filtered order. The lower-right checkbox preserves selection while navigating, and selecting two or more files changes the central action to Move N files to Trash, acting only on those selected files. With fewer than two selected, the action applies to the current preview; the left Archive action always applies to the current file. Reason tags open individual explanations, with click hints beside the list heading and below the preview tags. Confirming a single-file Trash action keeps the preview open and advances to the next available file; cancellation keeps the current file, and an exhausted queue stays open as a completion state until dismissed.
- **Explore & Decide** prioritizes control. Floating cards lead into a file type within the selected project. Browse large previews, filter by AI suggestion, open details, select up to three files for comparison, or review a selected sequence at your own pace. Pin meaningful files and use Keep, Archive, Trash or clarification to make a decision.

Quick Clear opens with a short staged overview: total storage, file-category preparation, synchronized numbers, then the file list. The 2.5-second presentation runs on entry or project changes, never on filtering or batch decisions, and respects reduced-motion preferences. The idle overview is still, with brief selection transitions and keyboard-operable segments; reduced motion disables transitions. It visualizes the prototype state rather than scanning the disk.

The project dropdown is shared by both modes. Mode and project choices persist on this browser; returning through the homepage opens the last mode. File decisions, pinned files, review position, analysis progress and history also survive reload and local sign-out. AI recommendations remain distinct from the user's decisions.

**History** opens from the side drawer with two spaces: Archive and Recycle bin. Both support individual and bulk restoration. Keep has no separate collection; retained files remain in the active workspace.

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

The welcome page introduces the purpose of FILEO. New projects offer an optional preference step with presets and custom tags. Edit these through the avatar for the current project. Applicable goals update recommendations across both modes without changing user decisions or history. Reason tags are directly visible in Quick Clear rows and Explore file cards, as well as previews, review and comparison. Each pink/lilac gradient-outline tag opens its own specific explanation in one click; category labels remain distinct from reasons and completed decisions.

Suggestions use deterministic local rules; no model API is connected. Demo evidence is authored from the actual example artwork. Local recommendations use file metadata and project preferences. A suspected copy is not verified by comparing bytes. Comparison surfaces previews, dates, sizes and recommendations for the user to assess.

Preview, detail, review and comparison views include a feedback control beside the AI suggestion. Good suggestion saves a filled thumbs-up and shows a thank-you message. Bad suggestion saves a thumbs-down and opens a Clarify dialog above the blurred preview. Choosing a category updates that file's suggestion and individually explained reason tags using the correction and available evidence. It does not move, delete or archive the file. Corrections and ratings persist on this browser, take precedence over project preference rules, and remain synchronized across both modes. This is local prototype behavior, not remote model training or an API re-analysis.

All workspace data stays in this browser: metadata and decisions use localStorage (`fileo-workspace-v2`), while image previews and eligible originals use IndexedDB. Clearing browser data removes the workspace. Keep leaves a file in the active workspace. Archive removes it from browsing and preview until restoration, without an expiry. Trash moves it into a 180-day Recycle bin. Expired records, stored originals and thumbnails are purged from FILEO. **Source files are never modified or deleted from disk**. “Potential to clear” is an estimate, not a claim that physical disk space has been freed.

## Privacy and AI access

First-use consent appears before the workspace can prepare AI suggestions. Users can allow all types, save a selected set, or continue without AI. The account panel opens the same policy and 16 per-type switches. Closing the dialog grants nothing; old workspaces must make an explicit choice. Turning a type off refreshes all projects, removes its displayed evidence and excludes its files from AI comparisons. Manual previews, decisions, originals and reversible history remain available.

Repeated per-file reading receipts are omitted from recommendation surfaces. Reading scope and permission controls remain in Privacy & AI access. Actual import recommendations use names, types, sizes and dates; local preview extraction is a separate user-facing feature. Native design formats would need compatible parsers or exports before their layers, geometry or timelines could support a real model. No AI provider receives file contents in this prototype.

The policy describes original-file and thumbnail retention, how to change permissions, and the limits of preview similarity. It is an accurate prototype disclosure, not a claim of production legal compliance. A connected model would require an updated disclosure and new consent for any external transfer.

## Assets and credits

The custom FILEO symbol and wordmark are reusable SVGs in `dist/assets/`. Space Grotesk is self-hosted with its SIL Open Font License in `dist/assets/fonts/`.

`landscape.webp`, `chair.webp` and `sculpture.webp` were generated for this project. The new nora-oak-final.webp was generated using the built-in image generator: a photoreal studio product render of a sage-upholstered lounge chair with continuous bent-oak arms and a four-leg base, centered on a warm neutral backdrop, without text. Document and design examples under dist/assets/previews/ are original vector artwork. The floating-card concept was inspired by the user-supplied reference [ramp.design](https://ramp.design/).

Photoshop, Illustrator, Figma, Blender and Premiere Pro marks come from [Devicon](https://github.com/devicons/devicon) (MIT; brand marks remain their owners' property). The Rhino mark comes from [Robert McNeel & Associates](https://www.rhino3d.com/reseller/graphics/); Rhinoceros is its registered trademark. InDesign is represented by its familiar Id badge. These marks identify example file formats and imply no affiliation.

The JSON Lines sample contains one JSON object per record. Quick Clear thumbnails, detail previews and comparisons retain the complete original image. Only the Explore home file-type carousel uses full-bleed representative covers. Choosing a type opens a grid of the actual source previews: grid, detail and comparison use the same artwork, centered and uncropped. Three studio variants in `nora-frame-study.webp`, `loop-study.webp` and `dawn-grade-study.webp` were generated from their corresponding original artwork: a stripped chrome chair frame, an early single-loop model, and a cooler dawn grade of the mountain scene. Word, PowerPoint, Excel, Acrobat and VS Code card marks use MIT-licensed artwork from [vscode-icons](https://github.com/vscode-icons/vscode-icons); the SVGs include attribution.

## Archive and Recycle bin

History now has exactly two project-scoped storage spaces, Archive and Recycle bin. Each supports individual selection, select-all and batch restoration to the active file list. There is no Keep collection or event timeline in this drawer. Files in either space show identifying metadata, never content previews or open-file actions. Active lists, search, carousel, reviews and comparison exclude them.

Archived files remain stored indefinitely and become viewable again after restoration. Recycle-bin files display their deletion date and remaining time out of 180 days. Expiry irreversibly removes FILEO records and locally stored copies/previews, with tombstones preventing demo reseeding or history restoration. Cleanup failures remain queued for retry across reloads. Shared thumbnail keys are retained while any other file still needs them.

The prototype has no server: expiry is checked on launch, on return to the tab, before restoring, and every minute while the page is visible. If the browser was closed at expiry, the next visit applies cleanup. Original files on the user's disk are never removed.
