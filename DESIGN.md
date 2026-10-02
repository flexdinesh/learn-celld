---
name: celld systems lab
description: A measured switchboard for learning real distributed cells.
colors:
  blue: "#1859c9"
  blue-hover: "#114799"
  selected-bg: "#dfebfc"
  selected-text: "#154b9d"
  guided-bg: "#e6eefb"
  guided-text: "#164e9e"
  guided-hover: "#d3e2fa"
  ink: "#243446"
  muted: "#5b6c7f"
  work-surface: "#edf1f5"
  rail: "#f7f9fc"
  panel: "#ffffff"
  line: "#d8e0e8"
  hover-surface: "#e0e9f3"
  owner-surface: "#f6f9ff"
  storage-surface: "#edf2f8"
  field-line: "#ccd7e3"
  field-ink: "#2c425c"
  green: "#176544"
  red: "#a42f38"
  amber: "#865c19"
  success-surface: "#dfefe7"
  success-ink: "#235b41"
  error-surface: "#fbe7e8"
  error-ink: "#8f2933"
  badge-surface: "#eaf0f7"
  badge-ink: "#526b89"
typography:
  headline:
    fontFamily: '"Public Sans Variable", sans-serif'
    fontSize: "27px"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-0.035em"
  title:
    fontFamily: '"Public Sans Variable", sans-serif'
    fontSize: "17px"
    fontWeight: 650
    letterSpacing: "-0.025em"
  section:
    fontFamily: '"Public Sans Variable", sans-serif'
    fontSize: "13px"
    fontWeight: 650
  body:
    fontFamily: '"Public Sans Variable", sans-serif'
    fontSize: "12px"
    lineHeight: 1.7
  label:
    fontFamily: '"Public Sans Variable", sans-serif'
    fontSize: "10px"
    fontWeight: 550
  evidence:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "11px"
    lineHeight: 1.65
  measured-value:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: "27px"
rounded:
  badge: "4px"
  control: "5px"
  feedback: "6px"
  node: "7px"
  panel: "10px"
spacing:
  tight: "7px"
  compact: "10px"
  field-gap: "14px"
  grid-gap: "16px"
  panel-inset: "20px"
  workbench-inset: "23px"
  shell-inset: "32px"
components:
  button-primary:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.panel}"
    rounded: "{rounded.control}"
    padding: "11px 13px"
  button-primary-hover:
    backgroundColor: "{colors.blue-hover}"
  button-guided:
    backgroundColor: "{colors.guided-bg}"
    textColor: "{colors.guided-text}"
    rounded: "{rounded.control}"
    padding: "10px 13px"
  button-guided-hover:
    backgroundColor: "{colors.guided-hover}"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.blue}"
    rounded: "{rounded.control}"
    padding: "4px 0"
  field:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.field-ink}"
    rounded: "{rounded.control}"
    padding: "10px"
    height: "37px"
  navigation-selected:
    backgroundColor: "{colors.selected-bg}"
    textColor: "{colors.selected-text}"
    rounded: "{rounded.control}"
    padding: "14px 10px"
  count-badge:
    backgroundColor: "{colors.badge-surface}"
    textColor: "{colors.badge-ink}"
    rounded: "{rounded.badge}"
    padding: "2px 5px"
  panel:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.panel}"
  node:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.node}"
  node-owner:
    backgroundColor: "{colors.owner-surface}"
  storage-strip:
    backgroundColor: "{colors.storage-surface}"
    rounded: "{rounded.control}"
    padding: "12px 15px"
---

# Design System: celld systems lab

## Overview

**Creative North Star: "The Network Switchboard"**

A cool, ruled work surface presents an apparatus that can be operated and inspected. Graphite text, cobalt selections and restrained status colors keep attention on relationships and measured outcomes. This name and atmosphere describe the implemented direction; they were inferred from the brief, not separately confirmed as a brand preference.

Density comes from aligned compartments, short instructions and compact tables. The visual system supports the product commitment to real, observable mechanisms. Page composition and experiment sequencing remain in the surface contract.

**Key Characteristics:**

- Cool surfaces with thin structural rules.
- Cobalt actions and explicit ownership states.
- Public Sans controls with monospace evidence.
- Flat compartments and orthogonal connectivity.
- Responsive apparatus with persistent shared connections.

## Colors

Pale blue-gray neutrals carry the interface; color makes actions and system state distinguishable.

### Primary

- **Connection Cobalt** (`blue`): primary requests, ownership markers, selected evidence tabs and text actions.
- **Deep Cobalt** (`blue-hover`): primary action hover.
- **Selection Wash / Selection Ink** (`selected-bg`, `selected-text`): active experiment navigation.
- **Guided Wash / Guided Ink / Guided Hover** (`guided-bg`, `guided-text`, `guided-hover`): experiment actions subordinate to the request console.
- **Owner Wash** (`owner-surface`): an owning node, accompanied by a cobalt border and named cell.

### Secondary

- **Health Green** (`green`): readiness and acknowledged results.
- **Failure Red** (`red`): destructive controls and failed results.
- **Alarm Amber** (`amber`): pending alarm information.
- **Success Wash / Ink** (`success-surface`, `success-ink`): completed experiment feedback.
- **Error Wash / Ink** (`error-surface`, `error-ink`): connection and request errors.

### Neutral

- **Graphite / Muted Slate** (`ink`, `muted`): primary and secondary reading.
- **Cool Work Surface / Rail / White Panel** (`work-surface`, `rail`, `panel`): shell, navigation and apparatus.
- **Rule Gray / Hover Wash** (`line`, `hover-surface`): separation and ordinary hover response.
- **Storage Wash** (`storage-surface`): shared bucket strip.
- **Field Rule / Field Ink** (`field-line`, `field-ink`): editable values.
- **Count Wash / Count Ink** (`badge-surface`, `badge-ink`): evidence counts.

**The State Has a Name Rule.** Pair status color with text or a distinct marker; health, ownership and ingress carry different meanings.

## Typography

**Display and Body Font:** Public Sans Variable, sans-serif fallback.  
**Evidence Font:** ui-monospace, SFMono-Regular, Menlo, monospace.

Public Sans gives instructions and controls an even, practical voice. Tabular numerals and monospace make changing quantities, IDs, timestamps and payloads easier to compare.

### Hierarchy

- **Headline:** the frontmatter headline role; shrinks to (23px) below the phone breakpoint and grows to (32px) on wide screens.
- **Title:** experiment titles; tighter tracking than explanatory text.
- **Section:** apparatus and console headings.
- **Body:** explanatory premise text, bounded to (65ch); grows to (13px) on wide screens.
- **Label:** short field labels and compact controls.
- **Evidence:** payload blocks and technical details.
- **Measured value:** inspector values; the principal counter uses (24px), or (23px) on phones.

**The Evidence Voice Rule.** Use monospace for measured values and technical identifiers; keep instructions and action names in Public Sans.

Existing (8–9px) metadata and table text are local density compromises, not a reusable reading scale. Do not propagate those sizes to future body text.

## Layout

The desktop shell has a narrow experiment rail (245px), a flexible main area and a maximum width (1800px). Main insets are (32px); topology uses three equal node bays with a shared bus. Workbench compartments use a proportional two-column split and paired field rows. Insets and gaps follow the observed frontmatter rhythm rather than a fabricated universal spacing scale.

At (1150px) the rail narrows to (205px) and content tightens. At (900px) experiment navigation becomes a horizontal scrolling rail. At (650px) the topology and workbench stack; a vertical spine connects all node bays to the shared bucket. Phone main insets are (15px). Node controls and their disclosure summaries gain a minimum hit height (44px). Evidence remains a scrollable table, bounded to (430px) vertically.

At (1500px) main insets grow to (44px), workbench insets to (26px), and explanatory text increases slightly. These thresholds describe the current surface, not mandatory breakpoints for every future layout.

**The Shared Connection Rule.** Reflow the apparatus without losing the common connection between node bays and storage.

## Elevation & Depth

No box shadows. Depth comes from the cool shell, white apparatus, lightly tinted compartments and thin boundaries. Selected ownership uses a colored outline and wash; primary actions use solid cobalt. Focus uses a blue outline (3px) with an offset (3px).

The latest ingress has a brief background-and-outline flash (1.4s), identifying a submitted request rather than observed replication traffic. Ordinary button background changes use (0.15s ease). Reduced-motion preferences disable animations and transitions.

**The Flat Apparatus Rule.** Separate surfaces with tone and rules; reserve outlines and washes for meaningful states.

## Shapes

Controls have restrained corners; nodes and larger containers have slightly softer corners. Use the frontmatter radius roles. Small square markers indicate ownership and ingress; round dots indicate health. Thin orthogonal lines connect the apparatus. Avoid clipping focus outlines; scroll long IDs and payloads or wrap them within their evidence compartment.

## Components

### Buttons

Compact, purposeful actions. Primary requests use solid cobalt with white text; guided experiment actions use a blue wash. Text actions use cobalt and underline on hover. All retain the shared focus outline. Disabled buttons use opacity (0.5) and a waiting cursor. Node crash controls use failure red; phone node controls preserve the measured hit height in Layout.

### Inputs / Fields

White, thin-stroked fields with restrained corners and paired labels. Inputs and selects share the field token, hover border shift and visible focus outline. Disabled fields use the cool work surface. Cell names, operations and ingress remain legible values rather than decorative placeholders.

### Navigation

Experiment choices have a two-line title/context stack with a monospace number. Selection uses a blue wash, darker text and a directional SVG. On smaller screens this becomes a horizontally scrollable strip; the trailing direction mark is removed.

### Chips

Count badges are informational, with a subdued wash and small corners. They accompany evidence tabs and navigation counts; they are not standalone filter controls.

### Cards / Containers

White, thin-ruled apparatus containers with panel corners and clipped inner partitions. Workbench compartments combine tinted instruction space with a white console. Node bays use smaller corners and an owner wash plus cobalt border when selected ownership is observed.

### Shared Storage Strip

A subdued blue-gray strip beneath the orthogonal bus combines the bucket identity, purpose and measured health. On phones it connects to the same vertical spine as the nodes.

### Evidence Tabs and Tables

Text tabs use a cobalt underline for selection and subdued count badges. Tables have sticky headers, thin row rules, monospace values, a hover wash and a distinct selected-row wash. Long object keys wrap; wide tabular evidence scrolls horizontally.

## Do's and Don'ts

### Do:

- **Do** use color with named states and observable evidence.
- **Do** preserve shared connectivity when topology reflows.
- **Do** keep technical values in monospace and explanations in Public Sans.
- **Do** use tonal compartments and thin rules for depth.
- **Do** retain visible keyboard focus and reduced-motion behavior.

### Don't:

- **Don't** represent configured links as measured replication traffic.
- **Don't** conflate request ingress with observed ownership.
- **Don't** replace responsive table scrolling with clipped evidence.
- **Don't** propagate the current tiny metadata sizes into future body text.

