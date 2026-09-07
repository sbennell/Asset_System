# Version History

All notable changes to the Asset Management System are documented in this file.

---

## [1.28.29] - 2026-09-07

### Changed

- DYMO 24mm Tape label: text lines are bold again, trying it out after 1.28.21 removed bold.

### Technical Details

- `apps/api/src/services/labelService-dymo.ts`: `buildDymoLabelManagerXml()`'s `lines` array sets `bold: true` for every field again.

---

## [1.28.28] - 2026-09-07

### Changed

- Removed the "Show Hostname" and "Show IP Address" options for the Dymo 24mm Tape label type - the tape is too narrow for that content. This applies in Settings and both print dialogs, and the LabelManager XML now always omits hostname/IP regardless of the stored setting (previously the fields were hidden by whatever the setting happened to be, not guaranteed off).

### Technical Details

- `apps/api/src/services/labelService-dymo.ts`: `buildDymoLabelManagerXml()` no longer includes `hostIpText` in its rendered lines at all.
- `apps/web/src/components/LabelPreviewModal.tsx`, `BatchPrintModal.tsx`: hide the Show Hostname/Show IP Address checkboxes when `dymo-labelmanager` is selected.
- `apps/web/src/pages/settings/GeneralTab.tsx`: same, keyed off the saved `labelType` setting.

---

## [1.28.27] - 2026-09-07

### Changed

- Renamed the "DYMO LabelManager Executive 640 (24mm tape)" Label Size option to "Dymo 24mm Tape" in Settings and the print dialogs.

### Technical Details

- `apps/api/src/routes/labels.ts` (`/label-types`), `apps/web/src/pages/settings/GeneralTab.tsx`, `apps/web/src/components/LabelPreviewModal.tsx`, `apps/web/src/components/BatchPrintModal.tsx`: updated the `dymo-labelmanager` display label.

---

## [1.28.26] - 2026-09-07

### Fixed

- DYMO LabelManager Executive 640 label: reverted the QR/text overlap introduced in 1.28.24/1.28.25 - it shifted the entire label (QR included) to the right instead of closing the gap, which means our fixed leader/trailer assumption doesn't hold once the declared print length changes (the printer's own tape-alignment centering likely repositions everything based on the length we declare, not just the object we moved). Back to the flush, zero-overlap layout that printed with everything correctly positioned.

### Technical Details

- `apps/api/src/services/labelService-dymo.ts`: `LABELMANAGER_QR_TEXT_OVERLAP_IN` set back to `0`.

---

## [1.28.25] - 2026-09-07

### Changed

- DYMO LabelManager Executive 640 label: the previous 0.15in text/QR overlap wasn't enough to close the gap (it reportedly looked wider) - increased the overlap to 0.3in. Tuning this value blind against a printer we don't have on hand; expect another round if it overshoots.

### Technical Details

- `apps/api/src/services/labelService-dymo.ts`: `LABELMANAGER_QR_TEXT_OVERLAP_IN` raised from `0.15` to `0.3`.

---

## [1.28.24] - 2026-09-07

### Changed

- DYMO LabelManager Executive 640 label: closed the visible gap between the QR code and the text. The QR and text boxes were already flush in our layout with zero gap between them - the visible whitespace was the QR renderer's own quiet-zone margin inside its box - so the text box now overlaps 0.15in into that margin, and the label's overall content width/print length shrank to match.

### Technical Details

- `apps/api/src/services/labelService-dymo.ts`: added `LABELMANAGER_QR_TEXT_OVERLAP_IN = 0.15`; `buildDymoLabelManagerXml()`'s `textX` and `contentWidth` both subtract it.

---

## [1.28.23] - 2026-09-07

### Changed

- DYMO LabelManager Executive 640 label: QR code density set to `Large` instead of `Medium` so it fills its allotted space more tightly (the box itself is already at the tape's max usable print height, so this was the only remaining lever to make it look bigger).

### Technical Details

- `apps/api/src/services/labelService-dymo.ts`: `buildDymoLabelManagerXml()`'s `QRCodeObject` `Size` element changed from `Medium` to `Large`.

---

## [1.28.22] - 2026-09-07

### Changed

- DYMO LabelManager Executive 640 label: text is now left-aligned instead of centered.

### Technical Details

- `apps/api/src/services/labelService-dymo.ts`: `buildDymoLabelManagerXml()`'s "Details" `TextObject`/`FormattedText` `HorizontalAlignment` changed from `Center` to `Left`.

---

## [1.28.21] - 2026-09-07

### Changed

- DYMO LabelManager Executive 640 label: all text lines (Assigned To, Item Number, Model, Serial Number, Hostname/IP, Organization) now print regular weight instead of some lines being bold.

### Technical Details

- `apps/api/src/services/labelService-dymo.ts`: `buildDymoLabelManagerXml()`'s `lines` array now sets `bold: false` for every field.

---

## [1.28.20] - 2026-09-07

### Fixed

- DYMO LabelManager Executive 640 printing still failed after the cutMode fix, now with "Invalid label file: The 'DieCutLabel' element is not declared." DYMO Connect only recognizes continuous-media (tape) labels in a completely different XML schema than the die-cut LabelWriter schema the 1933081 label (and the LabelManager builder up to this point) used - `<DesktopLabel><DYMOLabel><ContinuousLayoutManager>...` (measured in inches) rather than `<DieCutLabel Version="8.0" Units="twips">`. Confirmed by exporting a real label from DYMO Connect Desktop for this exact printer and tape cassette ("24X7-TAPE BLACK/WHITE"), and cross-checked against DYMO's public SDK samples for the QR code object shape.

### Technical Details

- `apps/api/src/services/labelService-dymo.ts`: rewrote `buildDymoLabelManagerXml()` to emit the `DesktopLabel`/`DYMOLabel`/`ContinuousLayoutManager` schema instead of scaling the `DieCutLabel` template. Layout constants (tape leader/trailer of 10mm, top/bottom margin, usable print height for 24mm tape) were read directly off the label DYMO Connect Desktop itself generated for this printer, rather than guessed. Uses a native `QRCodeObject` (DYMO renders the QR itself) instead of the rasterized-PNG `ImageObject` workaround the old schema needs. Extracted the asset-field derivation (assigned-to/item/model/serial/hostname+IP/org text) shared by both builders into `deriveLabelFields()`.

---

## [1.28.19] - 2026-09-07

### Fixed

- DYMO LabelManager Executive 640 printing failed with "Failed to execute webservice command: PrintLabel. Error: 400" - `printDymoTapeLabel()` was passing `cutMode: 'Auto'` to DYMO Connect's `createTapePrintParamsXml()`, which writes the value verbatim into the print params XML with no client-side validation. DYMO's actual `TapeCutMode` enum values are `AutoCut`/`ChainMarks`, so the local DYMO web service was receiving an invalid `<CutMode>Auto</CutMode>` and rejecting the whole print request.

### Technical Details

- `apps/web/src/lib/dymoLabelPrinter.ts`: `createTapePrintParamsXml` param type and `printDymoTapeLabel()`'s call now use `cutMode: 'AutoCut'` instead of `'Auto'`.

---

## [1.28.18] - 2026-09-07

### Added

- Added a third Label Type option, "DYMO LabelManager Executive 640 (24mm tape)", alongside the existing Brother DK-22211 and Dymo 1933081 label types in Settings, the single-asset print dialog, and the batch print dialog. Like the existing Dymo 1933081 integration, it prints client-side through DYMO Connect's local web service on the user's own machine rather than through the server. The LabelManager Executive 640 is a D1-tape device rather than a die-cut LabelWriter, so it's detected and printed through DYMO Connect Framework's separate "Tape printer" API instead of the LabelWriter API used for the 1933081. Label layout/sizing is unverified against the physical printer and expected to need tuning once tested on real hardware.

### Technical Details

- `apps/web/public/vendor/dymo.connect.framework.js`: confirmed (no changes) the vendored DYMO Connect Framework SDK already exposes `getTapePrintersAsync()` / `createTapePrintParamsXml()` for D1-tape ("Tape") printers, separate from `getLabelWriterPrintersAsync()` / `createLabelWriterPrintParamsXml()` used for die-cut LabelWriter printers.
- `apps/web/src/lib/dymoLabelPrinter.ts`: added `listDymoTapePrinters()` and `printDymoTapeLabel()` (auto-cut, no Twin Turbo roll concept) alongside the existing LabelWriter functions, plus a separate `dymo.lastTapePrinterName` localStorage key so LabelWriter/LabelManager printer selections don't clobber each other on a shared device.
- `apps/web/src/hooks/useDymoPrinting.ts`: added a `family: 'labelwriter' | 'tape'` parameter that switches which printer-listing/last-selected functions are used.
- `apps/api/src/services/labelService-dymo.ts`: extracted the Dymo 1933081 XML template into a shared `buildAddressStyleLabelXml()` parameterized by label width/height in twips, so the same QR+text layout scales per-axis to a new label size instead of being duplicated. Added `buildDymoLabelManagerXml()` (24mm tape, 2in print length) alongside the existing `buildDymoLabelXml()` (unchanged 1933081 output, scale factor 1:1).
- `apps/api/src/routes/labels.ts`: `/dymo-xml/:assetId` and `/dymo-xml-batch` now accept a `variant=labelmanager` query param to select `buildDymoLabelManagerXml` over `buildDymoLabelXml`; `/label-types` lists the new type; the Brother-vs-Dymo branches in the preview/print/download routes now check membership in a `DYMO_LABEL_TYPES` set instead of an exact `'dymo-1933081'` match.
- `apps/api/src/services/labelService.ts`, `apps/web/src/lib/api.ts`: extended the `LabelSettings.labelType` union with `'dymo-labelmanager'`.
- `apps/web/src/components/LabelPreviewModal.tsx`, `BatchPrintModal.tsx`, `apps/web/src/pages/settings/GeneralTab.tsx`: added the new dropdown option and switched the DYMO branch to also match `'dymo-labelmanager'`, picking the tape print path/hook family when it's selected.

---

## [1.28.17] - 2026-09-04

### Changed

- Removed the "Also satisfies the MACS annual asset register review requirement..." notice from the top of the Stocktake Review report tab.

### Technical Details

- `apps/web/src/pages/reports/StocktakeReviewTab.tsx`: removed the `<p>` element with that copy.

---

## [1.28.16] - 2026-09-04

### Fixed

- Warranty Expiry report: the "Days Until Expiry" filter only relabeled each asset's status badge — it never actually filtered the table, so the list looked identical no matter what value you entered. It now excludes assets whose warranty is comfortably in the future, so the table (and its total count) actually shrinks/grows as you change the threshold. The summary cards and expiration timeline chart were also silently computed from just the current page of results instead of the full matching set, so they under-reported whenever there was more than one page.
- Stocktake Review report: the Review Status and Review Year filters were computed but never applied to the table - a leftover `filteredAssets`/`filteredByYear` calculation whose result was discarded, so the table always showed every asset regardless of what you selected. They now correctly filter the table.

### Technical Details

- `apps/api/src/routes/reports.ts` (`GET /warranty`): added `listWhere` (category/location plus `warrantyExpiration IS NULL OR <= thresholdDate`) for the paginated table/count, while `baseWhere` (category/location only) now drives the summary and `byMonth` chart via a dedicated `allAssets` query instead of the paginated slice.
- `apps/api/src/routes/reports.ts` (`GET /stocktake-review`): added `listWhere` that layers `status`/`year` conditions (via Prisma `AND`) onto the paginated table/count; removed the dead `filteredAssets`/`filteredByYear` variables. `summary`/`byYear` remain scoped to category/location only, unaffected by the status/year filter, matching the Warranty report's pattern.

---

## [1.28.15] - 2026-09-04

### Fixed

- Edit/Add Asset dropdowns (Manufacturer, Category, Location, Supplier) could load empty and stay that way until a hard refresh, with no indication anything had failed. Root cause was two-fold: the API's SQLite connection had no WAL mode or busy timeout configured, so a burst of concurrent reads on page load could occasionally collide with a write (e.g. the student-import watcher) and fail with "database is locked"; and the form silently swallowed that failure instead of surfacing it.

### Technical Details

- `apps/api/src/index.ts`: sets `PRAGMA journal_mode = WAL` and `PRAGMA busy_timeout = 5000` on the Prisma connection at startup, so readers no longer block on an in-flight writer and brief lock contention is retried instead of failing immediately.
- `apps/web/src/pages/AssetForm.tsx`: the four lookup queries (`categories`, `manufacturers`, `suppliers`, `locations`) now retry up to 3 times and surface a dismissable "failed to load" banner with a Retry button when they still error out, instead of leaving the corresponding `<select>` silently empty.

---

## [1.28.14] - 2026-08-20

### Changed

- Student export's Birthdate column now formats dates as DD-MM-YYYY instead of YYYY-MM-DD.

### Technical Details

- `apps/api/src/routes/students.ts`: `GET /students/export` sets `numFmt = 'dd-mm-yyyy'` on the `student_birthdate` column.

---

## [1.28.13] - 2026-08-20

### Added

- Student export now offers a "Password" column, visible only to users with the "View student passwords" permission (same permission that gates Login Cards and the student detail password field).

### Technical Details

- `apps/api/src/routes/students.ts`: `STUDENT_EXPORT_FIELDS` gains a `password` entry; `GET /students/export` drops `password` from the requested field list unless `canViewStudentPasswords(req)` is true, so a crafted `?fields=password` request from an unprivileged session is silently ignored rather than honored.
- `apps/web/src/components/StudentExportModal.tsx`: the "Password" checkbox is only rendered when `hasPermission('canViewStudentPasswords')`, matching the existing Login Cards button gating in `StudentList.tsx`.

---

## [1.28.12] - 2026-08-14

### Added

- Unauthenticated `GET /api/public/asset-by-serial/:serialNumber` endpoint that returns an asset's item number for a given serial number. Intended for device-side scripts (e.g. lockscreen asset-tag tooling) that run as SYSTEM with no ITMS credentials available; rate-limited to 30 requests/minute per IP.

### Technical Details

- `apps/api/src/routes/public.ts` (new): dedicated unauthenticated router, kept separate from `assets.ts` (which applies `requireAuth`/`requirePermission` to its whole router) so this route never passes through session auth. Looks up via `prisma.asset.findFirst({ where: { serialNumber } })` since `serialNumber` isn't `@unique` in the schema, and returns only `{ itemNumber }` to minimize disclosure on a no-auth route.
- `apps/api/src/index.ts`: mounts the new router at `/api/public`.

---

## [1.28.11] - 2026-08-07

### Added

- "Last Stocktake" filter on the Hardware Assets list (Reviewed / Overdue / Never Reviewed), so you can see which assets haven't been stocktaken recently without opening a specific stocktake round or the Reports page. Uses the same 12-month overdue logic as the existing Stocktake Review report, so the two views agree.

### Technical Details

- `apps/api/src/routes/assets.ts`: `GET /assets` now accepts a `stocktakeStatus` query param (`reviewed`/`overdue`/`never`) and filters on `Asset.lastReviewDate` accordingly, mirroring `reports.ts`'s `getReviewStatus` logic.
- `apps/web/src/lib/api.ts`: `getAssets` accepts `stocktakeStatus`.
- `apps/web/src/pages/AssetList.tsx`: new "Last Stocktake" dropdown in the filters panel, wired through the existing URL-search-param filter pattern.

---

## [1.28.10] - 2026-08-07

### Added

- "Copies" field on the Print Label modal, so you can print more than one copy of an asset's label in a single action (e.g. a spare, or a mis-print).

### Technical Details

- `apps/web/src/components/LabelPreviewModal.tsx`: new `copies` state and number input, passed through to `api.printLabel(assetId, copies, ...)` and `printDymoLabel(xml, printer, copies, ...)`. No backend changes — `POST /labels/print/:assetId` already looped a `copies` field from the request body, and the DYMO SDK already accepts a native `copies` param; both were just hardcoded to `1`. "Download PDF" is unaffected and still produces a single-page PDF.

---

## [1.28.9] - 2026-08-07

### Added

- "Duplicate" action on the asset detail page. Opens the Add Asset form pre-filled with the source asset's manufacturer, model, category, description, status, condition, purchase info, lifecycle dates, comments, and compliance/governance fields — while leaving serial number, assignment, location, hostname, MAC addresses, and device credentials blank so they can be entered for the new unit. Useful when adding another unit of an asset already in the system (e.g. buying several identical laptops).

### Technical Details

- `apps/web/src/pages/AssetDetail.tsx`: new "Duplicate" button next to Edit/Delete, links to `/assets/new?duplicateFrom=<id>`.
- `apps/web/src/pages/AssetForm.tsx`: reads the `duplicateFrom` query param, fetches the source asset, and `reset()`s the form with the template fields (mirroring the existing edit-populate effect and the field split already used by the bulk-add `sharedFields` pattern in `apps/api/src/routes/assets.ts`). No backend changes — reuses the existing `GET /assets/:id` and `POST /assets` endpoints.

---

## [1.28.8] - 2026-07-28

### Fixed

- Hardware Asset Register export now includes the assigned student's name. Previously the export only read the free-text "Assigned To" field, so assets assigned via the student picker (which links a `Student` record instead of writing to that field) exported with a blank "Assigned To" column.

### Technical Details

- `apps/api/src/routes/import.ts`: `/api/import/export` now includes the `student` relation and falls back to `${student.firstName} ${student.surname}` when an asset is linked to a student, matching the same pattern already used for labels (`labels.ts`) and the asset detail page.

---

## [1.28.7] - 2026-07-24

### Added

- Item number in the Stocktake records table is now a link that opens the asset's detail page in a new tab, so you can look up an asset's details mid-scan without losing your place in the stocktake.

### Technical Details

- `apps/web/src/pages/Stocktake.tsx`: item number cell now renders a `react-router-dom` `Link` with `target="_blank" rel="noopener noreferrer"`, matching the styling used for item number links elsewhere (e.g. `AssetList.tsx`)

---

## [1.28.6] - 2026-07-24

### Added

- Lookup tables (Categories, Manufacturers, Suppliers, Locations, Software Publishers, Software Categories) can now be renamed in place from Settings > Lookups, not just added/deleted. Click the pencil icon next to an entry, edit the name, and save (or press Escape to cancel).

### Technical Details

- Backend `PUT /:id` routes for all six lookup types already existed; this only adds the missing frontend wiring
- Added `updateCategory`/`updateManufacturer`/`updateSupplier`/`updateLocation`/`updateSoftwarePublisher`/`updateSoftwareCategory` to `apps/web/src/lib/api.ts`
- `LookupManager` in `apps/web/src/pages/settings/LookupsTab.tsx` gained an inline-edit state (pencil/check/cancel icons) shared by all six lookup instances

---

## [1.28.5] - 2026-07-24

### Fixed

- Renamed the top Criticality tier from "Crown Jewel" to "Critical". "Crown Jewel" is MACS-specific terminology and this system is also used by non-MACS schools; the MACS Asset Management Standard only requires "a tier rating system" for criticality, it doesn't mandate that literal label, so this doesn't affect MACS compliance while being clearer for everyone else. The underlying stored value is unchanged.

### Technical Details

- Updated `CRITICALITY_LABELS` in `apps/web/src/lib/utils.ts`, `apps/api/src/routes/import.ts`, and `apps/api/src/routes/software.ts`, plus the "Crown Jewel" wording in the Criticality field's hover-help text in `AssetForm.tsx` and `SoftwareForm.tsx`

---

## [1.28.4] - 2026-07-24

### Fixed

- Data Classification labels now match the exact wording of the MACS Data Security Management Standard: "Internal" is now "Business Use" and "Sensitive" is now "Confidential" (the underlying stored values are unchanged, so existing records, exports, and imports keep working - only the displayed/exported text changed).

### Technical Details

- Updated `DATA_CLASSIFICATION_LABELS` in `apps/web/src/lib/utils.ts`, `apps/api/src/routes/import.ts`, and `apps/api/src/routes/software.ts` (all three previously duplicated the same label map)

---

## [1.28.3] - 2026-07-24

### Fixed

- Fixed `update.ps1` leaving the server's git checkout in a broken, diverged state ("ahead of origin by N commits" with unmerged `package-lock.json`) after repeated updates. The old flow (`git stash` / `git pull` / `git stash pop`) never checked whether the stash-pop actually succeeded, so when a prior `npm install` had left `package-lock.json` modified locally (platform-specific optional dependencies resolve differently) and a later pull also touched that file, the stash-pop silently conflicted and the script carried on regardless - compounding across runs. Replaced with fetch + hard-reset to `origin/<branch>`, which always converges the tree to exactly what's on GitHub and self-heals from any previously diverged/conflicted state. `.env` is gitignored and untouched by this either way.

### Technical Details

- `update.ps1`: "Pulling latest code" step now does `git fetch origin $Branch` then `git reset --hard origin/$Branch` instead of `git stash` / `git pull` / `git stash pop`
- Verified against a reproduction of the exact failure (local commit + local `package-lock.json` drift + origin ahead with a conflicting change to the same file) using a throwaway test repo - confirmed the new logic recovers to a clean tree matching origin in all cases
- **If your server is currently stuck in this state**, run this once by hand in `C:\ITMS\app` to recover before the next update: `git reset --hard origin/main` (discards the local-only commits and the conflicted merge; your `.env` and database are untouched)

---

## [1.28.2] - 2026-07-23

### Fixed

- Fixed "Import Software assetss" (double s) in Settings > Data - the software import panel's singular noun was accidentally set to the already-plural "software assets", which then had another "s" appended by the pluralization logic. Also corrected the "Update existing software assets" checkbox label to match.

---

## [1.28.1] - 2026-07-23

### Changed

- Shortened the Data Import/Export description text in Settings > Data

---

## [1.28.0] - 2026-07-22

### Added

- **Software Register Import**: New "Import Software items" section in Settings > Data (admin only), mirroring the existing hardware asset import - upload an Excel/CSV file to create or update software items, with Skip Duplicates / Update Existing options. Accepts the same column headers as the Software export (including Compliance/Governance fields), so a downloaded export can be edited and re-uploaded directly. Publisher, Category, and Supplier values are matched to existing lookups or auto-created, same as hardware import. Invalid Status/Criticality/Data Classification/Hosting/Support Type/Internet Facing values are rejected per-row with a clear error instead of silently dropped

### Technical Details

- `apps/api/src/routes/software.ts`: new `POST /import` route (`requireAdmin`, in addition to the router-level `canAccessSoftware` gate), with its own `multer.memoryStorage()` instance separate from the attachment upload's `diskStorage`; duplicates the `parseDate`/`resolveEnumValue`/`getCellString` helpers and `VALID_SOFTWARE_STATUS` list (mirroring the equivalent hardware helpers in `import.ts`, kept local since they aren't exported)
- `apps/web/src/lib/api.ts`: new `importSoftware()` function mirroring `importAssets()`
- `apps/web/src/pages/settings/DataTab.tsx`: extracted the shared file-upload/options/results UI into a reusable `ImportPanel` component, used for both the existing hardware import and the new software import section

---

## [1.27.5] - 2026-07-22

### Changed

- Moved "Export Software Register" next to "Export Hardware Asset Register" in Settings > Data (previously in its own section below), and renamed "Export Asset Register" to "Export Hardware Asset Register" for clarity alongside the software export

### Technical Details

- `apps/web/src/pages/settings/DataTab.tsx`: merged the separate "Software" export section into the main export button row; updated button label

---

## [1.27.4] - 2026-07-22

### Fixed

- Fixed a bug where exporting the full Asset Register and re-importing that same file dropped all Compliance/Governance data (Business Purpose, Business Owner, Technical Owner, Version, Criticality, Data Classification, Hosting, Support Type, Internet Facing) - the importer had never been taught to read these columns back in, even though the export had included them since they were added. Re-importing an export now round-trips these fields correctly, whether the cell contains the exported human label (e.g. "High") or the raw stored value (e.g. "HIGH") - invalid values are rejected with a clear error, same as the existing Status/Condition validation.

### Technical Details

- `apps/api/src/routes/import.ts`: added column-header mappings for `businessPurpose`/`businessOwner`/`technicalOwner`/`version`/`criticalityTier`/`dataClassification`/`hostingType`/`supportType`/`internetFacing`; new `resolveEnumValue()` helper resolves a cell's text back to its enum key by matching either the raw key or the human label (case-insensitive), used for the four tier/classification fields; `internetFacing` accepts Yes/No/true/false (case-insensitive); unrecognized values produce a per-row import error instead of silently dropping data

---

## [1.27.3] - 2026-07-22

### Changed

- Renamed the hardware worksheet in the "Export for MACS" workbook from "MACS Asset Register" to "Hardware", so it pairs clearly alongside the "Software" worksheet

### Technical Details

- `apps/api/src/routes/import.ts`: `/export-macs` now names the first worksheet `Hardware` instead of `MACS Asset Register`

---

## [1.27.2] - 2026-07-22

### Added

- The "Export for MACS" download now includes a second worksheet, "Software", with the same minimum MACS-required fields as the hardware sheet, sourced from the Software register (plus a Name column, since a software category alone doesn't identify a specific item)

### Technical Details

- `apps/api/src/routes/import.ts`: new `SOFTWARE_MACS_COLUMNS` array (mirrors `MACS_COLUMNS` with `initialInstallDate`/`licenseExpiration` in place of `acquiredDate`/`endOfLifeDate`, plus `name`); `/export-macs` now also queries `prisma.software.findMany()` and adds a second worksheet to the same workbook
- `apps/web/src/pages/settings/DataTab.tsx`: updated the "Export for MACS" button's tooltip to mention both worksheets

---

## [1.27.1] - 2026-07-22

### Changed

- Renamed "Assets" to "Hardware Assets" and "Software" to "Software Assets" in the sidebar nav, list page headings, and the Settings > Users permission checkboxes, to make the distinction between the two registers clearer. URLs (`/assets`, `/software`), buttons (Add Asset, Export Asset Register, etc.), and form titles are unchanged.

### Technical Details

- `apps/web/src/components/Layout.tsx`: `NAV_ITEMS` display names updated
- `apps/web/src/pages/AssetList.tsx`, `SoftwareList.tsx`: H1 heading text updated
- `apps/web/src/pages/settings/UsersTab.tsx`: `PERMISSION_FIELDS` labels updated

---

## [1.27.0] - 2026-07-22

### Added

- **Software Register**: New "Software" section in the sidebar, fully separate from hardware Assets - its own list/detail/add/edit pages, its own permission toggle (`Software`, off by default for existing USER accounts), and its own Publisher/Category lookup tables
- Tracks licensing/deployment details (publisher, category, version, URL, app store, deployment mechanism, license expiration, license count, supplier) alongside the same Compliance/Governance fields as hardware assets (business purpose, business/technical owner, criticality, data classification, hosting, support type, internet facing)
- **File Attachments**: Real working file upload/download for Software items (PDF, Word, Excel, PNG, JPEG; 10MB limit) - stored under a configurable `UPLOAD_DIR` (defaults to `./uploads`), with automatic cleanup on delete
- **Change History**: Full audit log for Software (create/update/attachment add/remove), mirroring the existing Asset audit log
- **Software Export**: New admin-only Excel export (Settings > Data Import/Export)
- Seeded a starter set of Software Categories (Operating System, Productivity Suite, Security, Educational, Administration/SIS, Creative, Communication)

### Technical Details

- `apps/api/prisma/schema.prisma`: new `Software`, `SoftwarePublisher`, `SoftwareCategory`, `SoftwareAttachment`, `SoftwareAuditLog` models; `Supplier` is reused (not duplicated) as the software vendor lookup; new `canAccessSoftware` boolean on `User` (defaults `false`, unlike the other feature flags)
- `apps/api/src/routes/software.ts`: new route file mirroring `assets.ts`'s CRUD/pagination/audit-log/export patterns; attachment routes use `multer.diskStorage()` with a file-type allowlist and size limit (no existing disk-storage pattern to mirror - this is new)
- `apps/api/src/routes/lookups.ts`: added `SoftwarePublisher`/`SoftwareCategory` CRUD sections, same shape as the existing four lookups
- `apps/api/src/routes/auth.ts`: `canAccessSoftware` threaded through the `PermissionFlag` union, `PERMISSION_FLAGS` array, session typing, login/session population, response bodies, and `/users` `select` clauses
- `apps/web/src/pages/SoftwareList.tsx`, `SoftwareDetail.tsx`, `SoftwareForm.tsx`: new pages mirroring the Asset equivalents structurally, reusing `FieldLabel` for form help tooltips and the existing Criticality/Data Classification/Hosting/Support label maps from `utils.ts`; new `SOFTWARE_STATUS_LABELS`/`_COLORS` (Planned/Active/Trial/Decommissioned) since hardware's status set doesn't fit software
- `apps/web/src/components/Layout.tsx` / `App.tsx`: new "Software" nav item and `/software` routes, permission-gated via `PermissionRoute`
- `apps/web/src/pages/settings/UsersTab.tsx`, `LookupsTab.tsx`, `DataTab.tsx`: extended with the new permission toggle, lookup managers, and export button
- New `UPLOAD_DIR` environment variable (`.env.example`, `doc/MANUAL_INSTALL.md`, `install.ps1`); the automated installer and backup script now also create/zip-back-up `data\uploads` alongside the database
- No changes to any existing hardware Asset routes, models, or pages - fully additive except for the shared `User`/permission plumbing

---

## [1.26.4] - 2026-07-22

### Added

- Added "DET Managed Hosted" as a Hosting option for assets, alongside On-Premises, School Managed Cloud, MACS Managed Cloud, and Third-Party Managed Cloud

### Technical Details

- `apps/web/src/lib/utils.ts`: added `DET_HOSTED: 'DET Managed Hosted'` to `HOSTING_LABELS`
- `apps/api/src/routes/import.ts`: mirrored the same entry in its server-side `HOSTING_LABELS` copy, used by the asset register export

---

## [1.26.3] - 2026-07-22

### Changed

- Field help tooltips (added in 1.26.2) are now shown on the Asset Form (Add/Edit) only. Removed from the read-only Asset Detail page based on feedback

### Technical Details

- `apps/web/src/pages/AssetDetail.tsx`: reverted to plain `dt` labels with no `help`/`HelpCircle` rendering; `DetailRow` dropped the `help` prop
- `apps/web/src/pages/AssetForm.tsx` and `apps/web/src/components/FieldLabel.tsx` unchanged

---

## [1.26.2] - 2026-07-22

### Added

- **Field Help Tooltips**: Every field label on the Asset Form and Asset Detail page now shows a small (?) icon that explains what the field means on hover - covers all fields, from basics like Serial Number and Category through to the newer Compliance/Governance fields (Criticality, Data Classification, Hosting, Support Type, etc.)

### Technical Details

- `apps/web/src/components/FieldLabel.tsx`: new reusable component - renders a label with an optional `help` tooltip (native `title` attribute on a `HelpCircle` icon from lucide-react, wrapped in a `<span>` since Lucide's icon props don't include `title` directly)
- `apps/web/src/pages/AssetForm.tsx`: every `<label>` replaced with `<FieldLabel text=".." help=".." />`
- `apps/web/src/pages/AssetDetail.tsx`: `DetailRow` gained an optional `help` prop rendering the same icon/tooltip pattern next to each `dt`; the four hand-rolled detail rows (Assigned To, IP Addresses, Password, Criticality) got the icon added inline

---

## [1.26.1] - 2026-07-22

### Added

- **MACS Asset Register Export**: New "Export for MACS" button (Settings > Data Import/Export, admin only) downloads a focused spreadsheet containing just the 17 minimum required fields from the MACS IT Security Asset Management Standard, in the standard's order (Unique ID, Type of Asset, Business Purpose/Function, Business Owner, Technical Owner, Date of Acquisition, Status, Date of Decommissioning, Supplier, Version, End-of-Life Support Date, Criticality Category, Data Classification, Hosting, Support, Internet Facing, Supporting Notes) - a smaller, audit-ready alternative to the full asset export

### Technical Details

- `apps/api/src/routes/import.ts`: new `GET /export-macs` route and `MACS_COLUMNS` array, reusing the existing `CRITICALITY_LABELS`/`DATA_CLASSIFICATION_LABELS`/`HOSTING_LABELS`/`SUPPORT_LABELS` maps for human-readable values. Same `requireAdmin` gate as the existing `/export` route - unchanged
- `apps/web/src/lib/api.ts`: new `exportAssetsMacs()` helper
- `apps/web/src/pages/settings/DataTab.tsx`: new "Export for MACS" button alongside "Export Asset Register"

---

## [1.26.0] - 2026-07-22

### Added

- **MACS Asset Register Compliance Fields**: Assets now carry a "Compliance / Governance" section - Business Purpose, Business Owner, Technical Owner, Version, Criticality (Low/Medium/High/Crown Jewel), Data Classification (Public/Internal/Sensitive/Restricted), Hosting (On-Premises/School Managed Cloud/MACS Managed Cloud/Third-Party Managed Cloud), Support Type (In-house IT/SaaS/Vendor Supported), and Internet Facing (Yes/No/Unknown). All fields are optional so existing assets keep saving/editing unchanged
- Added a new `Planned` status option for assets that are budgeted/approved but not yet acquired
- The asset list now shows a Criticality column, and the full asset export (Settings > Data Import/Export, admin only) includes all the new compliance columns with human-readable labels
- The Reports > Stocktake Review tab now notes that it also satisfies the MACS annual asset register review requirement (via the existing Last Review Date tracking)

### Technical Details

- `apps/api/prisma/schema.prisma`: added nullable `businessPurpose`, `businessOwner`, `technicalOwner`, `version`, `criticalityTier`, `dataClassification`, `hostingType`, `supportType`, `internetFacing` columns to `Asset`. No lookup tables - these are fixed, standard-mandated enumerations rendered via label maps, consistent with how `status`/`condition` are already handled
- `apps/web/src/lib/utils.ts`: new `CRITICALITY_LABELS`/`_COLORS`, `DATA_CLASSIFICATION_LABELS`/`_COLORS`, `HOSTING_LABELS`, `SUPPORT_LABELS` maps; added `Planned` to `STATUS_LABELS`/`STATUS_COLORS`
- `apps/api/src/routes/assets.ts`: `POST /` and `PUT /:id` read/write the new fields; bulk-update already supported them for free via its generic field pass-through
- `apps/api/src/routes/import.ts`: `/export` route adds the 9 new columns (server-side label maps mirror the frontend's, exporting human-readable values); `VALID_STATUS` accepts `Planned`. Export/import routes remain admin-only, unchanged
- `apps/web/src/pages/AssetForm.tsx`, `AssetDetail.tsx`, `AssetList.tsx`: new "Compliance / Governance" form/detail section and a Criticality list column
- Scope: hardware assets only - software/SaaS/cloud asset tracking is not yet modeled in ITMS; "to-be-decommissioned" is inferred from a future Decommission Date rather than a dedicated status value

---

## [1.25.1] - 2026-07-22

### Added

- **Customizable Student Export Fields**: The Students page "Export" button now opens a field picker instead of exporting a fixed set of columns. Choose any combination of 9 student fields (name, home group, year level, status, email, username, edupass username, birthdate) and 14 asset fields (item number, category, manufacturer, model, serial number, description, status, condition, location, acquired date, warranty expiration, order number, supplier, comments), with the previous default columns pre-checked and "Select All" / "Select None" shortcuts

### Technical Details

- `apps/api/src/routes/students.ts`: `GET /students/export` now accepts `?fields=` (comma-separated keys), validated against `STUDENT_EXPORT_FIELDS`/`ASSET_EXPORT_FIELDS` whitelists; builds the Prisma `select` and worksheet columns dynamically from the requested fields, with `ASSET_FIELD_SELECT` mapping relation fields (category/manufacturer/location/supplier) to their nested selects. Falls back to the prior default column set when `fields` is omitted; 400s if nothing is selected. Rows are only duplicated per asset when at least one asset field is requested
- `apps/web/src/components/StudentExportModal.tsx`: new modal with grouped checkboxes for student vs. asset fields, replacing the old one-click export button
- `apps/web/src/pages/StudentList.tsx`: "Export" button now opens `StudentExportModal` instead of calling the export URL directly
- `apps/web/src/lib/api.ts`: `getStudentsExportUrl()` accepts an optional `fields: string[]` and appends it as a comma-separated query param

---

## [1.25.0] - 2026-07-21

### Added

- **Export Students with Assigned Assets**: New "Export" button on the Students page downloads an Excel file of the currently filtered student list. One row per assigned asset (item number, category, manufacturer, model, serial number) alongside the student's name, home group, year level, status, and email; students with no assets get a single row with blank asset columns

### Technical Details

- `apps/api/src/routes/students.ts`: new `GET /students/export` route reuses the list view's filter logic (extracted into `buildStudentWhere`), includes each student's `assets` relation (with category/manufacturer), and streams an ExcelJS workbook (`students-export-YYYY-MM-DD.xlsx`, one row per student-asset pair) following the same pattern as `GET /import/export` for assets
- `apps/web/src/lib/api.ts`: `getStudentsExportUrl()` builds the export URL from the active search/status/schoolYear/homeGroup filters
- `apps/web/src/pages/StudentList.tsx`: new "Export" button next to "Login Cards" opens the export URL with current filters applied

---

## [1.24.2] - 2026-07-21

### Changed

- **Login Card Filename for Single Student**: Downloading a login card for one student now names the file `login-card-firstname-lastname-homegroup.pdf` instead of just the surname, making it easier to identify when downloading multiple students' cards individually

### Technical Details

- `apps/api/src/routes/students.ts`: `GET /login-cards` filename logic for the `studentId` case now slugifies and joins `firstName`, `surname`, and `homeGroup` (skipping any that are empty)

---

## [1.24.1] - 2026-07-14

### Changed

- **Split "View Passwords" into Separate Device and Student Toggles**: The single `canViewPasswords` permission from 1.24.0 is now two independent toggles - "View device passwords" and "View student passwords" - so a user can be granted visibility into one without the other (e.g. an asset technician who shouldn't see student login credentials, or a student-office clerk who shouldn't see device passwords)

### Technical Details

- `apps/api/prisma/schema.prisma`: `User.canViewPasswords` replaced with `canViewDevicePasswords` and `canViewStudentPasswords`, both `Boolean @default(true)`
- `apps/api/src/lib/redact.ts`: split into `canViewDevicePasswords(req)`/`canViewStudentPasswords(req)`; `apps/api/src/routes/assets.ts` uses the device variant, `apps/api/src/routes/students.ts` (including the `GET /login-cards` gate) uses the student variant
- `apps/api/src/routes/auth.ts`: `PermissionFlag`/`PERMISSION_FLAGS`/`SessionData` updated to the two flags
- `apps/web/src/lib/api.ts`, `UsersTab.tsx`, `AssetDetail.tsx`, `AssetForm.tsx`, `StudentDetail.tsx`, `StudentList.tsx`: updated to check the appropriate one of the two flags instead of a single combined flag

---

## [1.24.0] - 2026-07-14

### Added

- **Per-User Feature Permissions**
  - USER accounts can now be scoped to just the areas they need instead of getting full access by default. Five independent toggles per user, set in Settings > Users: Assets (incl. label printing), Students, Stocktake, Reports & Network/IPAM, and a separate "View device/student passwords" toggle
  - ADMIN accounts are unaffected and always have full access - the toggles only ever restrict USER accounts
  - Restricted users only see the nav items, routes, and Settings tabs they have permission for; navigating directly to a blocked URL redirects to the first area they do have access to
  - New users created via Settings > Users default to every toggle unchecked (admin must explicitly grant each area); existing accounts are unaffected by the upgrade (all toggles default to enabled) so nothing changes for current users

### Security

- **Real Server-Side Password Redaction**: `Asset.devicePassword` and `Student.password` were previously sent to the browser in full and only masked in the UI (visible via dev tools/network inspection regardless of the "click to reveal" flow). They're now stripped from the API response entirely for any user without the new "View passwords" permission
- **Settings Lock-Down**: Settings > Lookups, General, Networking, Data, and Users are now admin-only (both the tab in the UI and the underlying API routes) - previously any logged-in user could edit categories/locations/organization settings with no backend check, which would have let a restricted account bypass the new area permissions entirely
- **Student Login Cards Gated**: `GET /students/login-cards` (whose whole purpose is printing a student's password on a card) now requires the "View passwords" permission instead of just being logged in

### Technical Details

- `apps/api/prisma/schema.prisma`: `User` gains `canAccessAssets`, `canAccessStudents`, `canAccessStocktake`, `canAccessReports` (covers Reports and Network/IPAM), and `canViewPasswords`, all `Boolean @default(true)`
- `apps/api/src/routes/auth.ts`: new `requirePermission(flag)`/`requireAnyPermission(...flags)` middleware (ADMIN always bypasses); session and `/status`/`/login`/`/users` payloads extended with the 5 flags
- `apps/api/src/lib/redact.ts` (new): `redactAssetPassword`/`redactStudentPassword` helpers, applied at every response boundary that returns a full asset or student row
- `apps/api/src/routes/labels.ts`: per-asset label routes gated by `canAccessAssets`; the asset-agnostic condition-sheet route accepts `canAccessAssets` OR `canAccessStocktake`; `PUT /settings` (global label defaults) is admin-only, matching the General tab lock-down
- `apps/web/src/App.tsx`: `AuthContext` gains `hasPermission()`; new `PermissionRoute` component (`apps/web/src/components/PermissionRoute.tsx`) guards each area route and redirects to the user's first accessible area
- `apps/web/src/pages/AssetForm.tsx`: fixes a data-loss edge case introduced by redaction - a user without "View passwords" editing an asset that has one set would previously see a blank field (since the API now returns `null`) and any save would wipe the real stored password; the field is now omitted from the update payload entirely when the user lacks permission, leaving the existing value untouched

---

## [1.23.0] - 2026-07-14

### Security

- **CORS Misconfiguration Fixed** - In production, the API reflected any request's `Origin` header (`origin: true`) while also allowing credentials, letting any external website issue authenticated cross-origin requests using a logged-in user's session cookie. The frontend is served same-origin by this same server, so cross-origin API access was never actually needed in production - CORS is now disabled outright there (`origin: false`), with the permissive `localhost` regex kept only for the Vite dev server.
- **Session Cookie Hardening** - The `secure` flag was hardcoded to `false` even in production (despite a comment saying otherwise), and no `sameSite` attribute was set. Cookies now default to `sameSite: 'lax'`, and `secure` is now driven by a new `COOKIE_SECURE` env var (still defaulting to `false` to match the plain-HTTP LAN deployments this app ships to via `install.ps1`; set to `true` if you terminate HTTPS in front of it).
- **`SESSION_SECRET` Fallback Removed** - The server previously fell back to a hardcoded, publicly-known secret if `SESSION_SECRET` was unset, which would let an attacker forge session cookies. It now refuses to start in production without one (`install.ps1` already generates and sets this automatically for every install, so this shouldn't affect existing deployments).
- **Login Rate Limiting** - `POST /api/auth/login` is now limited to 10 attempts per 15 minutes per client, closing a brute-force gap.
- **Stronger Password Policy, Enforced Server-Side** - Minimum password length raised from 4 to 8 characters, and it's now enforced by the API itself (previously only the frontend checked, so the minimum was trivially bypassable via direct API calls).
- **Security Headers** - Added `helmet` for standard hardening headers (`X-Content-Type-Options`, `X-Frame-Options`, etc.) on every response. Content-Security-Policy is intentionally left off for now, pending a follow-up pass to verify it against everything the SPA loads.
- **Upload Size Limit** - The asset-import file upload (`POST /api/import/assets`) had no size cap, risking memory exhaustion from a very large file; capped at 25MB.
- **User Role Validation** - `role` is a free-text column; user create/update now rejects anything other than `ADMIN`/`USER` instead of silently accepting arbitrary strings.
- **Dependency Vulnerabilities** - Resolved 10 of 12 `npm audit` findings (all 6 high-severity: `react-router`, `tmp`, `picomatch`, `path-to-regexp`, `minimatch`; plus 4 moderate: `express`, `body-parser`, `qs`, `brace-expansion`). One moderate advisory remains in `uuid` via `exceljs`'s pinned dependency - it only affects a code path (a caller-supplied `buf` argument) that `exceljs` doesn't use, and fixing it upstream would require a breaking downgrade, so it's left as a tracked, low-risk residual.

### Technical Details

- `apps/api/src/index.ts`: `cors()` now takes `origin: isProduction ? false : /^http:\/\/localhost:\d+$/`; added a startup guard throwing if `SESSION_SECRET` is unset in production; `cookie.secure` now reads `process.env.COOKIE_SECURE === 'true'`; added `cookie.sameSite: 'lax'`; added `app.use(helmet({ contentSecurityPolicy: false }))`
- `apps/api/src/routes/auth.ts`: added `express-rate-limit` on `/login`; added `MIN_PASSWORD_LENGTH` (8) checks to first-admin creation, `/change-password`, `POST /users`, and `/users/:id/reset-password`; added `USER_ROLES` allowlist check to `POST /users` and `PUT /users/:id`
- `apps/api/src/routes/import.ts`: `multer` now has `limits: { fileSize: 25 * 1024 * 1024 }`
- `apps/api/.env.example`: documented the new `COOKIE_SECURE` variable and that `SESSION_SECRET` is now required in production
- `apps/web/src/pages/settings/AccountTab.tsx`, `UsersTab.tsx`: password minimum raised from 4 to 8 to match the server
- Added `helmet` and `express-rate-limit` as new `apps/api` dependencies

---

## [1.22.2] - 2026-07-14

### Fixed

- **Displayed App Version Was Out of Sync**
  - The version shown in the app footer/About dialog was a separately hand-maintained constant that didn't get updated during the 1.22.0/1.22.1 releases
  - It's now derived from the root `package.json` at build time, so it can no longer drift out of sync with the version bumped in `package.json`/`README.md`/`VERSION_HISTORY.md`

### Technical Details

- `apps/web/vite.config.ts`: reads `../../package.json` at config-load time and injects its `version` via Vite's `define` as a global `__APP_VERSION__` constant
- `apps/web/src/vite-env.d.ts`: new file declaring the `__APP_VERSION__` global for TypeScript
- `apps/web/src/lib/useVersionCheck.ts`: `APP_VERSION` now reads `__APP_VERSION__` instead of a hardcoded string literal

---

## [1.22.1] - 2026-07-14

### Added

- **"No Change" Barcode on the Condition Sheet**
  - The printable A4 condition barcode sheet now includes a "No Change" QR code alongside the six condition codes
  - Scanning it clears any locked condition in Quick Verify (equivalent to clicking the "No Change" button), so the lock can be cleared by scanning instead of touching the screen

### Technical Details

- `apps/api/src/services/labelService.ts`: `CONDITION_LABELS` gains a leading `['NONE', 'No Change']` entry; grid grows from 2x3 to 2x4 to fit the 7th cell (`createConditionSheetPDF()` is otherwise unchanged - it already looped generically over the list)
- `apps/web/src/pages/Stocktake.tsx`: `handleQuickVerify()` special-cases a scanned `CONDITION:NONE` to clear `activeCondition` rather than trying to match it against `CONDITION_LABELS`

---

## [1.22.0] - 2026-07-14

### Added

- **Printable Stocktake Condition Barcodes**
  - New "Print condition barcodes (A4)" link in the Stocktake Quick Verify panel opens a printable A4 sheet with one scannable QR code per condition (New, Excellent, Good, Fair, Poor, Non-Functional), each in its own cut-lined cell
  - Scanning one of these codes into Quick Verify locks that condition (same behavior as manually typing `CONDITION:GOOD`, etc.), so a printed sheet can be used to batch-set conditions without typing

### Technical Details

- `apps/api/src/services/labelService.ts`: new `createConditionSheetPDF()` builds a 2x3 grid A4 PDF using the existing `generateQRCode()` helper, one `CONDITION:<VALUE>` QR per cell
- `apps/api/src/routes/labels.ts`: new `GET /api/labels/condition-sheet` endpoint (session-authenticated, same pattern as `/download-batch`)
- `apps/web/src/pages/Stocktake.tsx`: link opens the endpoint in a new tab via a plain `<a href>` (no download button/modal needed since it takes no parameters)

---

## [1.21.0] - 2026-07-02

### Added

- **Print Dialogs Rework**
  - Label Options (Show Assigned To/Hostname/IP Address) are now always visible in a two-column layout, instead of hidden behind a collapsed toggle
  - QR Code Content choice removed from the print dialogs - now only configurable in Settings > Label Printing
  - New "Label Size" selector lets you choose Brother DK-22211 vs DYMO 1933081 per print/download job, without changing the saved Settings default
  - The label preview now matches the selected label size's real aspect ratio (Brother 62x29mm vs DYMO 89x25mm), instead of a fixed generic box

### Technical Details

- `apps/api/src/routes/labels.ts`: `/preview`, `/print`, `/print-batch`, `/download`, and `/download-batch` all accept an optional `labelType` override now, following the same override pattern already used for `showAssignedTo`/`showHostname`/`showIpAddress`/`qrCodeContent`
- `LabelPreviewModal.tsx` and `BatchPrintModal.tsx`: `isDymo` is now derived from the local per-dialog `labelType` selection rather than only the global settings value

---

## [1.20.8] - 2026-07-02

### Changed

- **DYMO Label - Dynamic Layout for Missing Hostname/IP**
  - When Hostname/IP isn't shown (disabled in settings, or the asset has neither), Item Number, Model, and Serial Number now grow from 10pt to 13pt and their boxes expand to fill the freed row, instead of leaving blank space
  - No change when Hostname/IP is present - layout stays at 10pt as before

---

## [1.20.7] - 2026-07-02

### Changed

- **DYMO Label - Layout and Typography Refinements**
  - Item Number, Model, Serial Number, Hostname, and IP Address text are now centered (previously left-aligned)
  - Hostname and IP Address combined onto a single line ("hostname \ ip"), matching the existing PDF label format, freeing up a full row of vertical space
  - Item Number, Model, Serial Number, and the combined Hostname/IP line now all use a matching 10pt font (previously a mix of 9/10/11pt), with evenly spaced boxes

---

## [1.20.6] - 2026-07-02

### Changed

- **DYMO Label - Organization Name Bold and Repositioned**
  - Organization Name is now bold, matching Assigned To's weight
  - Repositioned closer to the bottom edge of the label for better visual balance, confirmed on a test print

---

## [1.20.5] - 2026-07-02

### Changed

- **DYMO Label - Organization Name Size and Layout**
  - Organization Name font increased from 7pt to 14pt, matching Assigned To
  - Assigned To and Organization Name were both centered across the full label width, which caused Organization Name to visibly overlap the QR code once enlarged - both are now confined to the same right-hand text column as Item Number/Model/Serial Number, entirely clear of the QR

### Known limitation

- Organization Name's box can still vertically overlap the IP Address line for assets that have an IP address set - not yet fixed

---

## [1.20.4] - 2026-07-02

### Fixed

- **DYMO Label - QR Code Sizing and Position**
  - DYMO's native barcode "Size: Large" auto-sizing wasn't reliably honoring the requested dimensions - two different test sizes printed at inconsistent, incorrect sizes, with visible clipping on one
  - QR code is now rendered as a PNG image and embedded directly in the label (same method already used for the PDF/download path), which scales predictably and precisely
  - QR now prints at the requested 20mm x 20mm
  - Repositioned the QR further from the label's top-left corner, with the text column shifted right to match

### Technical Details

- `buildDymoLabelXml()` is now async - it renders the QR via the existing `generateQRCode()` (bwip-js) and embeds it as a base64 PNG in a DYMO `ImageObject` (`ScaleMode=Fill`) instead of a native `BarcodeObject`
- Both callers in `apps/api/src/routes/labels.ts` (`/dymo-xml/:assetId` and `/dymo-xml-batch`) updated to await it

---

## [1.20.3] - 2026-07-02

### Changed

- **DYMO Label - Bigger QR Code**
  - Increased the QR code size on DYMO labels from 1200x1200 to 1300x1300 twips (~8% bigger)
  - Text column shifted right slightly (1340 -> 1370 twips) and narrowed to match (3600 -> 3570 twips) to stay clear of the bigger QR, keeping the same right-hand margin

---

## [1.20.2] - 2026-07-02

### Changed

- **DYMO Label - Bigger Assigned To Text**
  - Increased the "Assigned To" name font size on DYMO labels from 10pt to 14pt for better readability
  - Text box height increased to match (180 -> 250 twips)
  - Item Number, Model, Serial Number, Hostname, and IP Address shifted down 70 twips each to stay clear of it, with a safe 55-twip gap kept before the organization name at the bottom

---

## [1.20.1] - 2026-07-02

### Fixed

- **DYMO Label - Assigned To Text Clipped at Top Edge**
  - Fixed the "Assigned To" name being cut off at the top of printed DYMO labels
  - Top margin was only 30 twips (~0.5mm), too tight for bold/capital letters near the physical edge of the label
  - Moved Assigned To, Item Number, Model, and Serial Number text blocks down by 100 twips (~1.76mm) to give proper clearance, keeping their relative spacing unchanged

---

## [1.20.0] - 2026-07-02

### Added

- **DYMO LabelWriter 450 Twin Turbo - Roll Selection**
  - New "Roll (Twin Turbo)" dropdown (Auto / Left / Right) in the print dialog and batch print dialog for DYMO labels
  - Only shown when the detected local printer is actually a Twin Turbo model - no change for single-roll LabelWriters
  - Fixes labels always printing to the right-side roll on Twin Turbo printers, with no way to choose the left roll instead
  - Roll choice is remembered per-device (localStorage), same as the printer selection

### Technical Details

- `dymo.connect.framework.js` reports `isTwinTurbo` per detected printer and accepts a `TwinTurboRoll` ("Auto"/"Left"/"Right") print parameter - both were already supported by the vendored SDK, just not wired into the UI
- `apps/web/src/lib/dymoLabelPrinter.ts`: `listDymoPrinters()` now returns `{ name, isTwinTurbo }`; `printDymoLabel()` takes an optional roll argument
- `useDymoPrinting` hook tracks the selected roll and persists it via `dymo.lastRoll` in localStorage

---

## [1.19.1] - 2026-07-02

### Fixed

- **DYMO Label Printing - XML Schema Errors**
  - Fixed "PrintLabel" failing with HTTP 400 against DYMO Label Software's local web service
  - QR code `BarcodeObject` now includes the required `QuietZonesPadding` element
  - Text object `Attributes` now include `ForeColor` alongside `Font`, as DYMO's schema requires both
  - Removed XML comments from the generated label template - DYMO's label parser doesn't tolerate them, unlike a standard XML parser
  - DYMO labels now print successfully end-to-end from the browser

---

## [1.19.0] - 2026-07-02

### Added

- **DYMO Label Printing from the Browser**
  - DYMO labels can now be printed directly, instead of download-only
  - Detects DYMO Label Software running on the user's own device and lists its local printers
  - Print modal and batch print modal show a per-device printer picker for DYMO labels
  - Falls back to "Download PDF" with a specific reason (not installed / not running / unsupported browser) when DYMO Label Software isn't detected on the device

### Technical Details

- Root cause of previous DYMO printing attempts: the printer is attached to each user's own PC, not the server, so backend calls to the local DYMO web service (127.0.0.1:41951) could never reach it. Printing now happens client-side in the browser instead, where that address correctly resolves to the user's own machine.
- Vendored DYMO's official `dymo.connect.framework.js` SDK (`apps/web/public/vendor/`), lazy-loaded only when a DYMO print UI is shown
- New `buildDymoLabelXml()` in `labelService-dymo.ts` generates native DYMO DieCutLabel XML; new endpoints `GET /labels/dymo-xml/:assetId` and `GET /labels/dymo-xml-batch` return label XML only, with the actual print call made by the browser
- New `apps/web/src/lib/dymoLabelPrinter.ts` and `useDymoPrinting` hook wrap the SDK for environment detection, printer listing, and printing
- Settings page hides the (server-side) printer dropdown for DYMO, since printing is now selected per-device in the print dialog
- Existing server-side DYMO PDF print path (`pdf-to-printer`) left in place for the "Download PDF" fallback

---

## [1.18.4] - 2026-03-20

### Fixed

- **Student CSV Import Updates**
  - Fixed student import to update existing records (matched by firstName + surname + birthdate)
  - Previously existing students were skipped; now status, homeGroup, schoolYear, username, and email fields are updated from CSV
  - Allows re-importing student data to refresh changed information

---

## [1.18.3] - 2026-03-12

### Added

- **New Asset Status: Missing**
  - Added "Missing" status to track lost or missing assets
  - Displayed with red badge styling (matches alert severity)
  - Available in asset forms and status filters
  - Allows tracking of missing/lost assets separately from decommissioned items

---

## [1.18.2] - 2026-03-06

### Changed

- **Asset List UI Improvements**
  - Removed Hostname column from asset list table
  - Added Serial Number column after Model column for better asset identification
  - Improves visibility of critical asset identification information

---

## [1.18.1] - 2026-03-06

### Fixed

- **CSV Import - UTF-8 BOM Handling**
  - Fixed "Invalid Opening Quote" error when importing CSV files exported from Excel
  - CSV parser now removes UTF-8 BOM (Byte Order Mark) before parsing
  - BOM is a special character that some applications add to UTF-8 files
  - Imports now work seamlessly with Excel-exported CSV files

---

## [1.18.0] - 2026-03-04

### Added

- **Student Login Cards PDF Generator**
  - Download printable student login cards as PDF from Students list and detail pages
  - Three download scopes: All students, filtered by year level, or filtered by home group
  - A4 portrait format with 16 compact cards per page (2 columns × 8 rows)
  - Centered credential display: Username, Password, Email with bold labels and regular values
  - Vertically centered card content with proper spacing distribution
  - Student footer with name, year level, and home group in larger, readable font
  - Professional dashed borders around each card with separator line
  - Automatic sorting by year level → home group → first name
  - Automatic page breaks when home group changes for better organization
  - Clean, space-efficient layout with no wasted whitespace

### Technical Details

- New service: studentLoginCardService.ts using pdf-lib for PDF generation
- New API endpoint: GET /api/students/login-cards with query parameters for filtering
- Card layout calculations for optimal spacing and readability
- Responsive sorting logic for organizing students by academic groupings

---

## [1.17.0] - 2026-03-03

### Added

- **Student Management**
  - Complete student management system with CSV import support
  - Student list with pagination, filtering, and advanced search
  - Full-name search support (e.g., "John Smith") with intelligent matching
  - Debounced search as-you-type for improved performance
  - Student detail page showing personal information, account details, and assigned assets
  - CSV Column Mapping for flexible student data imports
  - Asset-to-student linking with automatic name reconciliation
  - EduPass Username field conditional on "Department of Education" school type
  - Automatic asset reconciliation when student names match existing asset assignments
  - Students sidebar navigation item placed after Stocktake

### Technical Details

- New Student Prisma model with fields: firstName, surname, homeGroup, schoolYear, status, birthdate, username, edupassUsername, email, password
- Student import service with CSV parsing and upsert logic
- File watcher for automatic student imports on file changes
- Asset-to-student FK relationship with studentId field
- Student search endpoints with intelligent name matching using startsWith for precision
- Conditional CSV mapping UI based on schoolType setting
- Asset reconciliation logic matching student names to existing assets

---

## [1.16.0] - 2026-03-02

### Added

- **DYMO Label Printer Support**
  - New label type option: "Dymo 1933081" available in Settings
  - Customizable label dimensions: 23mm height × 85mm width
  - QR code positioned on left side of label, vertically centered
  - All text fields centered in the space to the right of QR code (accounting for ~17mm QR area)
  - Text fields include: Assigned To (bold), Item Number, Model, Serial Number, Hostname \ IP, Organization Name (bold)
  - Improved text layout with reduced line heights and auto-fitting for wider models
  - Download-only mode: DYMO labels can only be downloaded as PDF (no direct printing)
  - Print button disabled when DYMO label type is selected; shows "DYMO is Download only" message
  - Users can download DYMO label PDFs for manual printing or external label printer software

### Technical Details

- New label service: `labelService-dymo.ts` handles DYMO-specific PDF generation
- Label dimensions: 85mm width × 23mm height (adjustable via constants)
- Text centering calculated to account for QR code area (margin 3pt + QR 45pt + gap 1pt = 49pt)
- All font sizes reduced by 1pt from previous version for better fit on smaller label
- QR code generation consistent with existing bwip-js implementation
- Backend checks `labelType === 'dymo-1933081'` to route requests to correct service
- Frontend UI prevents printing when DYMO is selected, enforcing download-only workflow

---

## [1.15.1] - 2026-02-23

### Added

- **"Waiting Repair" Status Support in Stocktakes**
  - Assets with "Waiting Repair" status are now included when creating stocktakes
  - Previously only "In Use", "Awaiting allocation", "Awaiting delivery", and "Awaiting collection" statuses were included
  - Allows inventory verification of assets currently waiting for repair service

---

## [1.15.0] - 2026-02-23

### Added

- **Audio Beep Feedback for Stocktake Scanning**
  - Distinct audio cues for different scan outcomes during stocktake:
    - **Success**: Single short high-pitched beep (1880 Hz, 120 ms) — confirms item scanned successfully
    - **Already Scanned (Duplicate)**: Two medium beeps (880 Hz, 120 ms each, 80 ms gap) — warns that item was already verified
    - **Error**: Single long low-pitched beep (220 Hz, 400 ms) — indicates item not found or invalid scan
  - Improves stocktake workflow by providing immediate audio feedback without requiring users to watch the screen
  - Works in all modern browsers (Chrome, Firefox, Safari) using Web Audio API
  - Gracefully falls back to silent if audio is not supported

---

## [1.14.0] - 2026-02-18

### Added

- **redone the Asset Reports Suite**
  - **Warranty Expiry Report** — Track warranty status, expiration dates, and upcoming expirations with configurable thresholds
  - **Fleet Health Report** — Monitor asset condition breakdown across the organization with visual charts and category analysis
  - **Asset Value Report** — Financial analysis with totals by category, location, and manufacturer
  - **Age & Lifecycle Report** — Track asset age groups and end-of-life status with EOL date projections
  - **Stocktake Review Report** — Monitor asset review compliance and identify overdue reviews
  - All reports feature pagination, filtering by category/location, summary statistics, charts, and exportable asset tables

---

## [1.13.1] - 2026-02-18

### Added

- **Clickable Asset Links on IP Addresses Page**
  - Asset item numbers on the IP Addresses page are now clickable links
  - Click to navigate directly to the asset detail page
  - External link icon indicates the cell is clickable
  - Free IPs (without linked assets) display "-" as before

---

## [1.13.0] - 2026-02-18

### Added

- **QR Code Content Option for Labels**
  - Users can now choose between two QR code encoding modes:
    - **Full**: Encodes all label information (Assigned To, Item, Model, S/N, Hostname, IP, Organization)
    - **Item Number Only**: Encodes just the item number for simpler QR codes
  - Setting available in Settings → Label Printing
  - Per-print override available in Print Label modal

- **Stocktake Condition Scanning with Mode Toggle**
  - Improved quick-verify workflow with two condition-setting modes:
    - **Single Asset**: Condition applies to next scanned asset only, then resets
    - **Continuous**: Condition locks in place until changed (efficient for bulk scanning groups)
  - Visual condition buttons replace dropdown (No Change, New, Excellent, Good, Fair, Poor, Non-functional)
  - Colored condition buttons with active state indicator
  - Condition banner shows locked state in continuous mode
  - Condition QR code support: scan `CONDITION:GOOD` format to set condition and auto-enable continuous mode
  - On-screen buttons for quick condition changes without printing QR codes

- **New Asset Status: "Waiting Repair"**
  - Added new asset status "Waiting Repair" for assets awaiting repair service
  - Assigned orange badge color to indicate attention needed
  - Available in asset status dropdowns throughout the system
  - Supported in CSV import/export

---

## [1.12.3] - 2026-02-18

### Fixed

- **Subnet Tab Switching Unresponsiveness on IP Addresses Page**
  - Fixed unresponsiveness when changing subnets on the IP addresses page
  - **Root Cause**: Sorting and pagination state from previous subnet carried over when switching tabs
  - **Solution**: Force component remount when subnet changes using React key prop
  - **Technical**: Added `key={activeTabId}` to SubnetIPTable component in Network page
  - Added `useEffect` as backup to reset state when subnet changes
  - Now switches between subnets smoothly with fresh state

### Technical Details

- SubnetIPTable now remounts completely when subnet changes (using React key prop)
- Added useEffect cleanup for state reset (`sorting`, `page`, `limit`) as additional safeguard
- Ensures no state carryover between subnet tabs

---

## [1.12.2] - 2026-02-18

### Fixed

- **Report Tables & IP Address Table Unresponsiveness**
  - Fixed critical performance issue where sorting and pagination caused UI freezing
  - **Root Cause**: Sorting was applied to paginated data (current page only) instead of the complete dataset
  - **Solution**: Pass all data to TanStack Table for sorting, then paginate the sorted results
  - **Impact**: All report tables and IP address browser now respond instantly to sort and pagination actions
  - **Affected Components**:
    - Stocktake Review Report
    - Warranty Expiry Report
    - Asset Value Report
    - Age & Lifecycle Report
    - Condition Report
    - IP Address Browser
  - **Bonus**: Sorting now automatically resets page to 1 for better UX

### Technical Details

- Modified sorting strategy to operate on complete dataset before pagination
- Added page reset (`setPage(1)`) in `onSortingChange` callback for all tables
- All tables now pass full data to TanStack `useReactTable()` instead of paginated slice
- Extracted sorted rows and then applied pagination for rendering

---

## [1.12.1] - 2026-02-18

### Fixed

- **TypeScript Build Errors in SubnetIPTable.tsx**
  - Removed unused `Link` import from react-router-dom (TS6133)
  - Fixed type errors by adding explicit type casts for `cell.getValue()` calls (TS2322)
  - Build now completes successfully with no TypeScript errors

---

## [1.12.0] - 2026-02-18

### Added

#### Interactive Table Features — Sorting & Pagination
- **Click-to-Sort Column Headers** — Make all report tables fully sortable
  - Click any column header to toggle ascending/descending sort
  - Visual indicators (chevron icons) show sort state for each column
  - Unsorted columns display dimmed chevron indicating they're clickable
  - Custom sorting logic for object-based columns (Category, Location, Manufacturer sort by name)

- **Client-Side Pagination** — Enhanced data table navigation
  - Configurable page sizes: 10, 25, 50, 100 items per page
  - Page navigation with Previous/Next buttons
  - Page indicator showing current position (e.g., "Page 1 of 17")
  - Automatic reset to page 1 when filters are applied
  - Applied to all 5 report tabs and IP address table

#### Reports Affected
- Stocktake Review Report — Click headers to sort, paginate through assets
- Warranty Expiry Report — Sort and navigate through warranty data
- Asset Value Report — Sort by price, category, location
- Age & Lifecycle Report — Sort by age, EOL status, acquisition date
- Condition Report — Sort by condition, status, category
- IP Address Table — Sort IPs, hostnames, status; paginate large subnets

### Changed

- **Table Interaction Model** — From static read-only to fully interactive
  - Headers are now clickable with visual feedback
  - Sorting state persists within page but resets with filter changes
  - Improved user experience for navigating large datasets

### Technical Details

- Uses TanStack Table v8 `getSortedRowModel` for efficient client-side sorting
- Implements React `useState` for sort state management (`SortingState`)
- Custom `sortingFn` added to object-based columns for proper alphabetical sorting
- All pagination logic client-side for immediate responsiveness

---

## [1.11.1] - 2026-02-17

### Fixed

- **TypeScript Build Error** — Removed unused `useMutation` import from DataTab.tsx
  - Fixed TS6133 error that prevented npm build from succeeding
  - Import was declared but never used in the component

- **Database Migration Timeout** — Fixed `prisma db push` hanging during installation
  - Added `--accept-data-loss` flag to enable non-interactive mode
  - Prevents timeout when migrating from single IP field to multi-IP AssetIP model
  - Updated both install.ps1 and update.ps1 scripts

---

## [1.11.0] - 2026-02-17

### Added

#### Settings Page Redesign with Tabbed Interface
- **Tabbed Settings Layout** — Reorganized settings into 6 focused tabs
  - **General Tab** — Organization name and label printing settings
  - **Users Tab** — User management (add, edit, delete, reset password)
  - **Networking Tab** — Network subnet management
  - **Lookups Tab** — Categories, Manufacturers, Suppliers, Locations
  - **Data Tab** — Data import/export functionality
  - **Account Tab** — Personal password change

- **Sidebar Navigation Improvements**
  - Settings link moved to top of user profile section (above username)
  - Navigation items reordered alphabetically (Assets, IP Addresses, Reports, Stocktake)
  - Cleaner, more organized user interface

### Changed

- **Settings Page Structure** — Refactored from single long page to tabbed interface
  - Easier navigation with clear section separation
  - Improved mobile responsiveness
  - Matches existing Reports page tab pattern
- **Sidebar Layout** — Settings link repositioned in user profile section for better discoverability

### Technical Details

- Settings components extracted into separate tab files (`settings/GeneralTab.tsx`, `settings/UsersTab.tsx`, etc.)
- Implemented tab state management using React hooks
- Tab styling matches existing design system (primary-50, primary-700 colors)
- Admin-only tabs (Users, Networking, Data) remain visible but content is protected

---

## [1.10.2] - 2026-02-17

### Added

#### Import/Export Date Fields
- **Last Review Date Support** — Import and export asset review dates
  - New column in Excel template: "Last Review Date"
  - Accepts standard date format (YYYY-MM-DD)
  - Automatically formatted in export files

- **Decommission Date Support** — Track asset decommissioning dates
  - New column in Excel template: "Decommission Date"
  - Accepts standard date format (YYYY-MM-DD)
  - Automatically formatted in export files

- **Enhanced Template Instructions**
  - Updated README tab with documentation for new date fields
  - Clear guidance on date format requirements
  - Expanded tips section for date field usage

### Changed

- **Import Template** — Two new date columns added to Excel template
- **Export Functionality** — All assets now export with Last Review Date and Decommission Date values
- **Column Mapping** — Enhanced import parser to recognize both new date fields

### Technical Details

- Date field handling uses existing `parseDate()` utility function
- Both new date columns formatted as yyyy-mm-dd in Excel
- Column mapping supports common header variations for flexibility
- Full backward compatibility with existing imports (new columns optional)
- Export includes all date fields from asset records

---

## [1.10.1] - 2026-02-17

### Added

#### Comprehensive Audit Logging for Asset Changes
- **IP Address Audit Logging** — All IP address changes now tracked in Recent Changes
  - Add IP address operations logged with before/after states
  - Update IP address operations logged with old/new values
  - Delete IP address operations logged showing removed IPs
  - IP labels included in audit log entries for clarity

- **Lookup Field Resolution** — Audit logs now show readable names for reference fields
  - Location IDs resolved to Location names
  - Category IDs resolved to Category names
  - Manufacturer IDs resolved to Manufacturer names
  - Supplier IDs resolved to Supplier names
  - Prevents confusing UUID display in Recent Changes

- **Password Audit Logging Improvements**
  - Password modifications now properly detected and logged
  - Masking strategy: Store actual passwords in audit log, mask on frontend display only
  - Fixes issue where password changes weren't appearing in Recent Changes
  - Frontend displays as `••••••••••` while maintaining backend integrity for change detection

#### Stocktake Enhancement
- **Extended Stocktake Eligibility** — Assets with awaiting statuses can now be included in stocktakes
  - Stocktake creation now includes assets with:
    - "Awaiting allocation" status
    - "Awaiting delivery" status
    - "Awaiting collection" status
  - In addition to regular "In Use" status assets
  - Allows inventory verification across all active asset statuses

### Fixed

- **Date Field False Positives in Audit Logs**
  - Fixed issue where date fields appeared as changed when they weren't
  - Root cause: Database returns Date objects, form sends date strings
  - Solution: Normalize all dates to YYYY-MM-DD format before comparison
  - Affected fields: Acquired Date, Warranty Expiration, Last Review Date

- **Password Modification Detection**
  - Fixed password modifications not appearing in Recent Changes
  - Previous issue: Both old and new passwords masked before storage (appeared identical)
  - Solution: Store actual passwords in audit log, mask only for display
  - Password changes now correctly detected by frontend

- **Empty Audit Log Entries**
  - Fixed duplicate empty UPDATE entries appearing in Recent Changes
  - Implementation: Smart comparison now only logs fields with actual changes

### Technical Details

- Audit logging enhanced with async lookup resolution for foreign keys
- Date normalization utility function handles both Date objects and ISO strings
- Password masking separated into display layer concern (frontend) vs data integrity concern (backend)
- Stocktake asset filter uses Prisma AND/OR logic for status combinations
- Build validates all type changes and dependencies

---

## [1.10.0] - 2026-02-17

### Added

#### Multi-IP Support Per Asset
- **Asset IP Management** — Each asset can now have multiple IP addresses across multiple subnets
  - Optional labels for each IP (e.g., "LAN", "WLAN", "Management")
  - Full CRUD operations for managing multiple IPs per asset
  - All IPs treated equally; first IP used for backward compatibility with labels and exports

- **Asset Edit Form IP Management**
  - **Add Additional IPs** — New form section to add IPs directly while editing an asset
  - IP Address input with optional Label field
  - Dynamic IP list showing all assigned IPs with their labels
  - Delete individual IPs with confirmation
  - Real-time query updates after IP changes

- **IP Address Display Improvements**
  - Clean display showing IP + label badge for each assigned IP
  - All IPs editable and manageable from the asset form
  - First IP in array used for backward compatibility (label generation, exports)

#### Import/Export Multi-IP Support
- **Enhanced Excel Template** — Support for importing/exporting up to 5 IPs per asset
  - `IP Address` + `IP Address Label` columns for primary IP
  - `IP Address 2-5` + corresponding Label columns for additional IPs
  - All IP labels preserved in round-trip import/export
  - Full backward compatibility with single-IP imports

- **Import Behavior**
  - All IPs created with their specified labels
  - First IP in list exported to "IP Address" column for consistency
  - Update mode: All IPs from import replace existing IPs

- **Export Behavior**
  - First IP exported to "IP Address" and "IP Address Label" columns
  - All additional IPs exported to "IP Address 2-5" columns with corresponding labels
  - Maintains consistent ordering for round-trip imports

#### Backend Enhancements
- New `AssetIP` Prisma model (join table) with fields:
  - `id` (UUID)
  - `assetId` (foreign key)
  - `ip` (string)
  - `label` (optional string)
  - `createdAt` / `updatedAt` timestamps

- New API endpoints in `/api/assets/:id/ips`:
  - `POST /assets/:id/ips` — Add IP to asset
  - `PUT /assets/:id/ips/:ipId` — Update IP entry (ip, label)
  - `DELETE /assets/:id/ips/:ipId` — Remove IP from asset

- Smart IP update logic:
  - Single IP field updates preserve other IPs (edit IP without losing others)
  - Multiple IP array updates trigger full replacement (import/form sync)
  - First IP in array used for label generation and backward compatibility

- Network IP Browser updated:
  - Queries `AssetIP` table instead of single IP field
  - Displays correct asset info for each IP in the range
  - Supports assets with IPs across multiple subnets

- Label Service updated:
  - Resolves primary IP from `ipAddresses` array
  - Maintains backward compatibility with label generation

#### Data Migration
- Automatic migration from single `ipAddress` field to `ipAddresses` array
- Existing single IPs converted to AssetIP entries (becomes first/primary IP in array)
- Zero data loss during migration

### Changed

- **AssetForm UI Refactor**
  - Removed single primary IP input field
  - All IPs now managed through unified "Add Additional IP Address" + "IP Addresses" list
  - Cleaner, more intuitive workflow
  - Labels displayed as badges for quick visual identification

- **API Response Format**
  - Assets now include `ipAddresses: AssetIPEntry[]` array
  - Single `ipAddress` field removed from Asset model
  - First IP in array (`ipAddresses[0]`) used for backward compatibility (labels, exports)

- **Import/Export Template**
  - New columns for IP labels (primary + additional)
  - Updated README with IP fields documentation
  - Enhanced tips section covering multi-IP scenarios

### Removed

- Single `ipAddress: String?` field from Asset model
- `isPrimary` field from AssetIP model — all IPs now treated equally
- "Primary" badge from AssetForm and AssetDetail IP displays
- Inline "Primary" indicator (replaced with label functionality)

### Technical Details

- Type-safe multi-IP handling with explicit label support
- Prisma relation queries optimized for asset IP lookups
- React hooks (useState) for form-based IP input management
- TanStack Query mutations for IP CRUD operations
- Full backward compatibility maintained where possible
- Column mapping enhanced for flexible Excel import headers

---

## [1.9.0] - 2026-02-16

### Added

#### IP Address Manager
- **Network Subnet Configuration** — New "Network Subnets" section in Settings (admin-only)
  - Add, edit, and delete network subnets with CIDR notation (e.g., `192.168.1.0/24`)
  - Subnet prefix validation: /20 to /32 (max 4094 host IPs per subnet to maintain performance)
  - Unique subnet names and CIDR addresses prevent duplicates
  - Clean, intuitive form-based management interface

- **IP Address Browser** — New "IP Addresses" sidebar navigation item
  - View all configured subnets as tabs
  - Interactive table showing every IP in a subnet with real-time status
  - Columns: IP Address, Hostname, Status, Asset, Actions
  - Status badges: "Linked" (green) for IPs with assigned assets, "Free" (gray) for unassigned IPs

- **Asset Linking & Discovery**
  - **Link to Asset**: Search modal with debounced input to find and link existing assets to free IPs
  - Shows matching asset details (Item Number, Model, Current IP if any) for quick identification
  - Warning if selected asset already has a different IP assigned
  - **Create Asset**: Direct link from free IPs to create new asset form with IP pre-filled
  - Real-time table updates after linking or unlinking assets

#### Hostname Display
- Dedicated **Hostname** column in IP table for easy network identification
- Shows linked asset's hostname if available, otherwise dash (—)
- Simplified Asset column now shows only item number (linked to asset detail)

#### Backend Enhancements
- New `Subnet` Prisma model with CIDR validation
- New `/api/network/subnets` endpoints:
  - `GET /subnets` — List all configured subnets
  - `POST /subnets` — Create subnet (admin-only)
  - `PUT /subnets/:id` — Update subnet (admin-only)
  - `DELETE /subnets/:id` — Delete subnet (admin-only)
  - `GET /subnets/:id/ips` — Get all IPs in subnet with asset associations

- **CIDR Processing**: Server-side IP range expansion with automatic host IP filtering
  - Excludes network and broadcast addresses automatically
  - Efficient SQLite `IN` queries for IP-asset correlation
  - Fast computation for even large subnets (tested up to /20 with 4094 IPs)

#### Asset Form Enhancement
- Asset creation form now accepts `?ip=<address>` query parameter
- IP field auto-populated when creating asset from IP manager "Create Asset" button
- Streamlines workflow for assigning IPs to new assets

### UI/UX Improvements
- Network icon added to sidebar navigation
- Clean tab interface for switching between subnets
- Consistent styling with rest of application (TailwindCSS, Lucide icons)
- Empty state messaging when no subnets configured

### Technical Details
- Type-safe CIDR validation using bitwise IP arithmetic (no external dependencies)
- TanStack Query for efficient data fetching and cache invalidation
- React Router integration for URL-driven state
- All components follow existing design patterns and conventions
- Database migration auto-applied on schema push

---

## [1.8.0] - 2026-02-16

### Added

#### New Reports & Analytics
- **Warranty Expiry Report** — Track assets with expiring or expired warranties
  - Summary cards showing warranty status breakdown (No Warranty, Expired, Expiring Soon, OK)
  - Timeline chart showing warranty expirations by month
  - Filterable by expiration threshold (30/60/90/180/365 days), category, and location
  - Detailed asset table with warranty expiration dates and days until expiry

- **Fleet Health Report (Condition)** — Analyze asset condition across the fleet
  - Condition breakdown cards (New, Excellent, Good, Fair, Poor, Non-Functional)
  - Bar chart visualization of fleet condition distribution
  - Filterable by category and location
  - Color-coded condition status badges

- **Asset Value Report (Financial)** — Monitor fleet financial value
  - Summary metrics: Total fleet value, average cost, assets tracked, assets without price
  - Horizontal bar chart showing fleet value by category
  - Side-by-side breakdown tables (by location and by manufacturer)
  - Filterable by category, location, and manufacturer
  - Full asset table with purchase prices and acquisition dates

- **Age & Lifecycle Report** — Track asset age and end-of-life dates
  - Summary cards: Total assets, average age, EOL passed count, EOL upcoming count
  - Asset age distribution chart with age group buckets
  - End-of-life status tracking with color-coded badges
  - Filterable by EOL threshold (90/180/365/730 days), category, and location
  - Asset table with acquired date, age in years, EOL date, and days until EOL

#### UI/UX Improvements
- **Tabbed Reports Interface** — Refactored Reports page to support multiple report tabs
  - Single-page access to all reports (Stocktake Review, Warranty, Condition, Value, Lifecycle)
  - Smooth tab switching without page reloads
  - Consistent tab navigation design

#### Backend Enhancements
- Added 4 new API endpoints for advanced reporting:
  - `GET /api/reports/warranty` — Warranty expiration analytics
  - `GET /api/reports/condition` — Asset condition analytics
  - `GET /api/reports/value` — Financial asset value analytics
  - `GET /api/reports/lifecycle` — Asset age and lifecycle analytics

- All endpoints support filtering by category, location, and report-specific parameters
- Comprehensive aggregation and summary statistics for each report type

#### Dependencies
- Added `recharts` for advanced chart visualizations (bar, line, horizontal bar charts)

### Fixed
- Fixed read-only array sorting error in Condition tab chart rendering

### Technical Details
- New utility export: `CONDITION_COLORS` in utils.ts for consistent condition status styling
- All reports use TanStack Query for efficient data fetching and caching
- Responsive chart layouts with ResponsiveContainer from recharts
- Type-safe API responses with TypeScript interfaces

## [1.7.1] - 2026-02-15

### Bug Fixes

- **Label Printing in Service Mode**: Fixed "Failed to print label" error and printer margin issues
  - Replaced PowerShell-based printing (`Start-Process -Verb Print`) with native Windows printing API via `pdf-to-printer` library
  - Set explicit DK-22211 paper size (29x62mm) with "fit" scaling to use full label area
  - Removed SYSTEM user account option in installer; service now always runs as current logged-in user
  - SYSTEM user account lacks proper printer access and caused 16mm margins on printed labels
  - Service running as current user ensures consistent printer behavior between dev and production

### Installation Improvements

- **Service Account Configuration**: Updated `install.ps1` to configure service to run as current user
  - Prompts for user password during installation for secure service account setup
  - Ensures label printing works correctly with proper printer access
  - Eliminates printer margin issues that occurred with SYSTEM account

---

## [1.7.0] - 2026-02-15

### New Features

- **Bulk Edit Assets**: Select multiple assets from the list and edit shared fields at once
  - "Edit Selected (N)" button appears when assets are checked
  - Modal allows updating: Status, Condition, Category, Location, Decommission Date, and Comments
  - Only filled fields are applied (leave blank to skip)
  - Success/failure summary shows count of updated assets and any errors
  - Full audit logging with human-readable field names
- **Auto-Set Decommission Date**: When an asset status is changed to any "Decommissioned" variant, the Decommission Date is automatically set to today
  - Works in both individual asset editing and bulk edit modal
  - User can manually override the date if needed

### Improvements

- **Audit Log Display**: BULK_UPDATE actions now show detailed field changes
  - Lookup fields (Location, Category, Manufacturer, Supplier) display friendly names instead of raw IDs
  - Example: "Location: (empty) → Conference Room A" instead of UUID
  - Improved readability for tracking what actually changed

---

## [1.6.0] - 2026-02-15

### New Features

- **Bulk Add Assets**: New dedicated page for adding multiple assets at once
  - Enter serial numbers and assigned-to names as side-by-side lists (one per line)
  - Shared fields (manufacturer, model, category, purchase info, etc.) apply to all assets
  - Item numbers auto-generated sequentially
  - Results summary shows created count and any per-asset errors
  - Accessible via "Bulk Add" button on the asset list

### Bug Fixes

- **Update Status Detection**: Replaced `update.lock` file with Task Scheduler status check
  - Update status now determined by querying if `AssetSystemWebUpdate` task is running
  - Eliminates orphaned lock file issue where updates appeared stuck

---

## [1.5.0] - 2026-02-14

### New Features

- **Active Status Filter**: New default "Active" filter on the asset list excludes all Decommissioned assets
  - "All Statuses" option available to show everything including decommissioned
  - Individual status filters still available
- **Auto Item Number**: Item Number field is automatically prefilled with the next available number when creating a new asset
  - Scans all existing item numbers and suggests the next highest value
- **Adobe Reader Install**: Install script now installs Adobe Reader via Chocolatey
  - Required by `pdf-to-printer` for label printing on Windows

---

## [1.4.0] - 2026-02-14

### New Features

- **About Dialog**: Clicking version or update notification opens an About modal
  - Displays current version, changelog summary parsed from GitHub, and copyright info
  - Links to GitHub repository and full changelog
  - Admin users can trigger updates directly from the modal
  - Non-admin users see a link to GitHub releases

### Bug Fixes

- **Update Lock File**: Fixed `update.lock` not being deleted after web update completes
  - Lock file now removed before service restart to avoid script-on-disk changes from `git pull` corrupting the `finally` block
  - `finally` block retained as safety net for failure cases

### Changes

- Sidebar version text is replaced by "Update to vX.X.X" notification when an update is available
- Update confirmation moved from browser `confirm()` dialog to the About modal
- Removed hardcoded default credentials from install script; first login creates the admin account
- Updated README with one-line install command and link to manual install guide
- Updated MANUAL_INSTALL.md with Chocolatey NSSM install, web update instructions, and scheduled task setup

---

## [1.3.2] - 2026-02-14

### Bug Fixes

- **Web Update Process Fix**: Fixed update script being killed when NSSM stops the service
  - NSSM uses Windows Job Objects to kill the entire process tree when stopping the service
  - Update now runs via Windows Task Scheduler, fully independent of the NSSM service
  - Reuses existing `update.ps1` with new `-AutoUpdate` parameter (skips confirmation, logs to file)
  - Scheduled task created during installation via `install.ps1`
  - `update.ps1` try/finally block ensures service restart and lock file cleanup even on failure

---

## [1.3.1] - 2026-02-13

### Bug Fixes

- **Login Fix**: Fixed issue where users had to log in twice after application boot
  - Login now sets auth data directly in the query cache instead of relying on a background refetch
  - Eliminates race condition between navigation and auth status check
- **Web Update Fix**: Fixed 500 error when triggering update from web interface
  - Ensures logs directory is created automatically if it doesn't exist
  - Improved error messages for easier debugging

---

## [1.3.0] - 2026-02-13

### New Features

- **Web-Based Update**: Admins can trigger system updates directly from the web interface
  - "Update to v{x.y.z}" button appears in sidebar when a new version is detected
  - Shows full-page overlay with progress spinner during update
  - Automatically reloads the page when the update completes and service restarts
  - Backs up database, pulls code, rebuilds, and restarts service automatically
  - Update logs saved to server logs directory
  - Only available to admin users in production mode
- **Brother QL Printer Support**: Updated from QL-500 only to support all Brother QL printer models
  - Users select their specific printer model from the available printers list in Settings
  - Label format unchanged (DK-22211, 29mm continuous tape)
- **NSSM via Chocolatey**: Install script now uses `choco install nssm` instead of direct download from nssm.cc (more reliable)
- **dotenv Support**: Production server now loads `.env` file via dotenv as fallback for environment variables

### Changes

- Default printer name no longer hardcoded to "Brother QL-500" - users must select their printer
- Version bumped across all files (root package.json, README, useVersionCheck)

---

## [1.2.1] - 2025-02-11

### New Features

- **Version Update Check**: Automatically checks GitHub for newer versions
  - Compares current app version against latest in VERSION_HISTORY.md on GitHub
  - Shows animated notification badge in sidebar when an update is available
  - Links to GitHub releases page for easy download
  - Checks once per hour in the background
- **Version Link**: Version number in sidebar now links to VERSION_HISTORY.md on GitHub
- **Update Script**: Added `update.ps1` PowerShell script for one-command updates from GitHub
  - Checks for available updates before proceeding
  - Automatic database backup before updating
  - Pulls latest code, installs dependencies, rebuilds, and restarts service
  - Supports custom install path, branch selection, and skip options

---

## [1.2.0] - 2025-02-11

### Security Enhancement

- **Password Protection**: Device passwords on asset detail page now require account password verification before revealing
  - Click Eye icon next to masked password to trigger verification prompt
  - User must enter their own account password to confirm identity
  - Password is re-hidden when clicking the EyeOff icon
  - Added `/verify-password` API endpoint for secure password verification

---

## [1.1.1] - 2025-02-11

### Bug Fixes

- **Print Preview Modal**: Updated preview layout to match v1.1.0 label changes
  - Assigned To name now shown centered at top
  - QR code centered vertically in middle section
  - All text fields now display in bold
  - Layout accurately reflects printed label output

---

## [1.1.0] - 2025-02-11

### Label Printing Improvements

Enhanced label layout and text formatting for better readability.

#### Changes
- **Assigned To Name**: Now centered at top of label with auto-fit sizing (14pt max, 7pt min)
- **Item Number**: Bold text at 9pt
- **Model**: Auto-fit to available width (8pt max, 5pt min) - no truncation
- **All Label Text**: Now uses bold font throughout
- **Organization Name**: Auto-fit to fill label width (14pt max, 6pt min)
- **QR Code**: Centered vertically on full label height
- **Text Spacing**: Increased gap between QR code and text fields

#### Layout
```
┌─────────────────────────────────────────┐
│         Assigned To Name (centered)     │
│ [QR]  Item: 1234                        │
│ [QR]  Manufacturer Model                │
│ [QR]  S/N: ABC123                       │
│ [QR]  hostname                          │
│ [QR]  192.168.1.100                     │
├─────────────────────────────────────────┤
│      Organization Name (centered)       │
└─────────────────────────────────────────┘
```

---

## [1.0.0] - 2025-02-11

### Initial Release

First production release of the Asset Management System.

### Features

#### Asset Management
- Create, read, update, and delete IT assets
- Track item numbers, serial numbers, models, and manufacturers
- Store hostname, IP address, MAC addresses, and device credentials
- Assign assets to users and locations
- Track asset status (In Use, In Storage, Retired, etc.)
- Track asset condition (Excellent, Good, Fair, Poor)
- Record purchase information (price, supplier, order number)
- Set warranty and end-of-life dates
- View complete audit history for each asset

#### Label Printing
- Generate QR code labels for asset identification
- Direct printing to Brother QL label printers (DK-22211 29mm tape)
- Print single labels from asset detail page
- Batch print labels for multiple assets
- Download labels as PDF for manual printing
- Configurable label content (Assigned To, Hostname, IP Address)
- Organization name displayed on all labels

#### Stocktake
- Create stocktake sessions for inventory audits
- Filter stocktake by category or location
- Quick verify assets by scanning QR codes
- Track verification progress in real-time
- Update asset condition during stocktake
- Add notes to verified assets
- Complete or cancel stocktake sessions

#### Data Management
- Import assets from Excel (.xlsx) or CSV files
- Export all assets to Excel
- Download import template with correct format
- Configurable page sizes (50, 100, 200, 500, 1000, All)
- Search across all asset fields
- Filter by status, category, manufacturer, or location
- Sort by any column with natural number ordering

#### Lookup Tables
- Categories - Organize assets by type
- Manufacturers - Track device manufacturers
- Locations - Define physical locations
- Suppliers - Manage vendor information

#### User Management
- Secure authentication with session management
- Role-based access control (Admin, User)
- Admin can create, edit, and disable users
- Password change functionality
- Secure password hashing with bcrypt

#### Settings
- Configure organization name for labels
- Select default label printer
- Set default label field visibility

### Technical Stack
- Frontend: React 18, TypeScript, Vite, TailwindCSS
- Backend: Node.js, Express, TypeScript, Prisma
- Database: SQLite
- Label Generation: pdf-lib, bwip-js, pdf-to-printer

---

## Future Versions

_Planned features and improvements will be documented here as they are released._
