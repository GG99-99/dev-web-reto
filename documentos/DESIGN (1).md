---
name: Sanitary Risk Assessment Engine
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#444651'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#757682'
  outline-variant: '#c5c5d3'
  surface-tint: '#4059aa'
  primary: '#00236f'
  on-primary: '#ffffff'
  primary-container: '#1e3a8a'
  on-primary-container: '#90a8ff'
  inverse-primary: '#b6c4ff'
  secondary: '#006398'
  on-secondary: '#ffffff'
  secondary-container: '#5bb8fe'
  on-secondary-container: '#00476e'
  tertiary: '#222a3e'
  on-tertiary: '#ffffff'
  tertiary-container: '#384055'
  on-tertiary-container: '#a4acc5'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dce1ff'
  primary-fixed-dim: '#b6c4ff'
  on-primary-fixed: '#00164e'
  on-primary-fixed-variant: '#264191'
  secondary-fixed: '#cce5ff'
  secondary-fixed-dim: '#93ccff'
  on-secondary-fixed: '#001d31'
  on-secondary-fixed-variant: '#004b73'
  tertiary-fixed: '#dae2fd'
  tertiary-fixed-dim: '#bec6e0'
  on-tertiary-fixed: '#131b2e'
  on-tertiary-fixed-variant: '#3f465c'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.05em
  data-metric:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system establishes an ultra-modern, governmental-grade sanitary and food safety compliance interface tailored for progressive web applications (PWA). The system balances institutional authority with high-speed technical utility, built specifically for sanitary inspectors conducting field audits in low-connectivity environments and operational managers analyzing food safety metrics on central command dashboards.

The visual direction follows a modern technical enterprise style:
- **Precision and Impartiality:** Crisp geometries, standardized structural lines, and neutral backdrops eliminate visual noise, allowing critical compliance data to take precedence.
- **High-Velocity Usability:** Large, touch-friendly tap targets, explicit semantic affordances, and direct status indicators reduce cognitive overhead in dynamic, demanding physical inspection sites (e.g., cold storage rooms, food processing plants).
- **Resilience and State Awareness:** Clear visual systems indicate real-time PWA states—Online, Offline Local Storage, and Background Sync in Progress.
- **High-Contrast Safety Semantics:** Audit outcomes rely on a universally recognized sanitary risk traffic-light taxonomy calibrated for zero ambiguity under harsh inspection lighting.

## Colors

The color palette reflects institutional authority, clinical sanitation, and definitive technical assessment:

- **Institutional Primary (`#1E3A8A` - Deep Navy):** Anchors primary command structures, app bars, key call-to-actions, and official document headers.
- **Sanitary Cyan (`#0284C7` - Medical Cyan):** Guides user interaction, highlighting active states, selection focus rings, inline links, and dynamic audit step indicators.
- **Deep Slate Neutral (`#0F172A` - Midnight Slate):** Applied to primary typography, structural table headers, and critical system badges for maximum legibility against white and light backgrounds.
- **Functional Surface Neutrals:**
  - Base Canvas: `#F8FAFC` (Slate 50)
  - Card & Container Surface: `#FFFFFF` (Pure White)
  - Subdued Surface / Disabled: `#F1F5F9` (Slate 100)
  - Structural Borders & Dividers: `#E2E8F0` (Slate 200)
  - Muted Labels & Secondary Text: `#64748B` (Slate 500)
  - Body Text: `#1E293B` (Slate 800)

### Sanitary Risk Assessment Palette (EBR / BPM Semantics)
- **Conforme / Low Risk (`#10B981` Emerald):** Indicates full standard compliance, sanitary clearance, and secure parameters. Surface tint: `#ECFDF5`, Border tint: `#A7F3D0`.
- **Cumple Parcial / Medium Risk (`#F59E0B` Warm Amber):** Denotes minor non-conformities, cautionary thresholds, and non-critical observations. Surface tint: `#FFFBEB`, Border tint: `#FDE68A`.
- **No Conforme / High Risk (`#EF4444` Crimson Red):** Signals critical health risks, biological/chemical hazards, immediate quarantine triggers, and regulatory violations. Surface tint: `#FEF2F2`, Border tint: `#FECACA`.
- **No Aplica / Neutral Observation (`#64748B` Slate Gray):** Surface tint: `#F8FAFC`, Border tint: `#CBD5E1`.

### PWA Connectivity States
- **Online / Cloud Connected:** `#10B981` dot indicator with `#E2E8F0` badge background.
- **Offline / Local Cache Active:** `#F59E0B` dot indicator with subtle `#FFFBEB` background banner.
- **Sync Pending / Transmitting:** `#0284C7` animated rotating indicator.

## Typography

The typographical architecture uses **Inter** across all roles to ensure geometric clarity, high legibility in numeric compliance values, and robust screen rendering on low-cost field tablets or high-resolution desktop terminals.

- **Data Tables & Checklists:** Numerical readouts, verification percentages, and regulatory clause codes (e.g., *CAC/RCP 1-1969*, *BPM Art. 42*) must use tabular figures (`font-variant-numeric: tabular-nums`) to preserve columnar scanability.
- **Labels & Verdict Codes:** `label-sm` utilizes uppercase rendering with a `+0.05em` letter-spacing boost for instant recognition on badge pills (`C`, `CP`, `NC`, `N/A`).
- **Hierarchy Enforcement:** Headings are reserved strictly for module navigation and official section division. Checkpoint descriptors leverage `headline-sm` paired with `body-md` for verification instructions.

## Layout & Spacing

The layout model optimizes for operational dashboards on desktop and split-view touch workflows on mobile and tablet:

- **Field Audit (Mobile & Tablet Handheld):** Single-column fluid stack with strict full-width or segmented assessment rows. Layout margins are pinned to `1rem` to maximize horizontal real estate for inspection criteria. Interactive assessment controls must feature a minimum touch boundary of 48px.
- **Operational Dashboard (Desktop):** 12-column fluid grid with `1.5rem` gutters and a max-width container of `1600px` centered within a `2rem` viewport margin. 
  - Risk heatmaps and critical alerts consume 4 columns.
  - Core inspection checklist and facility profiles span 8 columns.
- **Vertical Spacing Rhythm:** Standard 8pt base grid. Component paddings leverage `space-md` (`1rem`) internally, while form field groupings and evaluation blocks use `space-lg` (`1.5rem`) margins to establish separation between checklist items.

## Elevation & Depth

This design system avoids decorative or heavy drop shadows to maintain a clean clinical aesthetic and preserve rendering performance on mobile browsers:

- **Level 0 (Base Surface):** Canvas background (`#F8FAFC`). No elevation or border.
- **Level 1 (Card & Module Layer):** Clean white surface (`#FFFFFF`) bound by a crisp 1px solid border (`#E2E8F0`). Flat elevation; depth is created by surface contrast rather than shadow.
- **Level 2 (Floating Status Bars & Sticky Headers):** Used for top PWA network banners, sticky audit submission bars, and active inspection tabs. Styled with `0 2px 4px -1px rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.04)` combined with an explicit border-bottom (`#E2E8F0`).
- **Level 3 (Modals, Slide-over Evidence Drawers):** Backdrop overlay `#0F172A` at 40% opacity with a clean surface elevation: `0 10px 15px -3px rgba(15, 23, 42, 0.1), 0 4px 6px -4px rgba(15, 23, 42, 0.05)`.
- **Offline / Alert States:** When an alert is critical, elevation is replaced with a 2px high-visibility left border indicator using the designated semantic risk color.

## Shapes

The design system uses a restrained corner radius (`roundedness: 1`), conveying structural rigor, institutional stability, and dense data legibility:

- **Base Components (Inputs, Segmented Pills, Buttons):** `0.25rem` (4px) radius. This produces precise, clean form controls.
- **Cards, Panels, and Field Evidence Modules:** `rounded-lg` at `0.5rem` (8px). Maintains structural cohesion without appearing overly playful or consumer-oriented.
- **Status Badges & Dictamen Pills:** Full capsule radius (`9999px`) reserved specifically for non-interactive state badges (e.g., "Sincronizado", "En Espera") and segmented compliance pills (`C`, `CP`, `NC`, `N/A`) to contrast against rectangular data tables and form inputs.

## Components

### 1. Decision & Assessment Pills (Dictamen C / CP / NC / N-A)
The primary interaction element during on-site inspections. Presented as a connected or segmented 4-way group with minimum 44px height:
- **C (Conforme):** Default outlined slate; when selected, solid Emerald `#10B981` background, white text, bold label.
- **CP (Cumple Parcial):** Selected state displays solid Amber `#F59E0B` background with deep slate or white text.
- **NC (No Conforme):** Selected state triggers solid Crimson `#EF4444` background with white text, automatically revealing an inline evidence container (photo capture + mandatory observation textarea).
- **N/A (No Aplica):** Selected state renders muted Slate `#64748B` with white text.

### 2. Buttons & Fast Action Controls
- **Primary Action (e.g., Finalizar Inspección, Guardar Acta):** Deep Navy background (`#1E3A8A`), hover/active `#1E40AF`, crisp white text, 4px border radius. Minimum height 44px on mobile.
- **Secondary Action (e.g., Adjuntar Evidencia, Reasignar):** Crisp white surface, 1px border `#E2E8F0`, text `#1E3A8A`. Hover state shifts surface to `#F1F5F9`.
- **Critical Destruction / Immediate Closure Action:** Solid Red `#EF4444` background, hover `#DC2626`, white text.

### 3. Cards & Inspection Checkpoints
- Structured with `#FFFFFF` background, 1px border `#E2E8F0`, and 8px radius.
- Checkpoint header displays the clause ID (e.g., "BPM-04.1") in `label-sm` slate text, followed by the requirement title in `headline-sm`.
- If flagged as "NC", the card's left border transitions to a 4px solid `#EF4444` accent to provide clear visual feedback when scrolling long audit sheets.

### 4. Input Fields & Observation Capture
- High-contrast 1px border `#CBD5E1`, internal padding of `0.75rem 1rem`, text `#0F172A`.
- Active focus state uses Sanitary Cyan outline: 2px ring `#0284C7` with zero offset.
- Offline-disabled fields maintain `#F8FAFC` background with distinct slash-cursor indicators.

### 5. PWA Status Indicators & Connectivity Banners
- Fixed, non-intrusive status pill pinned in the global application header:
  - **Online:** Micro-dot (`8px`) `#10B981` + "En Línea".
  - **Offline Active:** Micro-dot `#F59E0B` + "Modo Local (24 pendientes)". Background displays `#FFFBEB` with border `#FDE68A`.
  - **Syncing:** Spinning micro-icon `#0284C7` + "Sincronizando...".

### 6. Evidence & Photo Attachment Strip
- Compact horizontal scroll area inside checklist items. Thumbnail containers (`64x64px`, `roundedness: 1`) with an ambient slate border, photo count badge, and quick-camera trigger button for rapid evidence collection.