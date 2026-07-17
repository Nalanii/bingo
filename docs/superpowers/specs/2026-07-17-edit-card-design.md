# Edit a card and its squares — design

Tracks [GitHub issue #6](https://github.com/Nalanii/bingo/issues/6).

## Goal

Let a card owner edit an existing card's name, layout, and per-square
label/kind/goal after creation, reusing the same builder wizard used for
card creation. Reachable from the dashboard, which currently has no way to
open a card at all.

Grid size and free-space placement are **not** editable — changing either
would change the required square count, which is a bigger reconciliation
problem (adding/removing squares, re-shuffling positions) that's out of
scope here. Locking them keeps square count and position fixed across an
edit, which keeps this change simple: no square added/removed, no
reshuffling, and every square's `id` carries over unchanged (progress
tracking, per `docs/ARCHITECTURE.md`, will key completions by square id —
this design avoids breaking that even though completions aren't built
yet).

## Restructure: shared builder folder

The wizard (`card-builder.tsx`, `card-settings-step.tsx`,
`square-entry-step.tsx`, `review-step.tsx`, `types.ts`, `positions.ts`)
currently lives under `src/app/dashboard/cards/new/`. It moves to
`src/app/dashboard/cards/_builder/` (underscore prefix excludes it from
Next.js routing) so both the create route and the new edit route can
import it without reaching across sibling route folders.

- `src/app/dashboard/cards/new/page.tsx` — renders `<CardBuilder
  mode="create" />`. `new/actions.ts` keeps `saveCard`, unchanged.
- `src/app/dashboard/cards/[id]/edit/page.tsx` — new. Renders `<CardBuilder
  mode="edit" .../>`. `[id]/edit/actions.ts` — new, holds `updateCard`.

## Firestore layer (`src/lib/firestore/cards.ts`)

Today only `CreateCardInput`/`createCard` and the `CardSummary` projection
exist — no full `Card` read, no update path.

```ts
export interface Card {
  id: string;
  ownerId: string;
  name: string;
  gridSize: number;
  hasFreeSpace: boolean;
  layout: CardLayout;
  squares: Square[];
}

/** Fetches a full card doc by id, or null if it doesn't exist. */
export async function getCard(cardId: string): Promise<Card | null>;

export interface UpdateCardInput {
  name: string;
  layout: CardLayout;
  squares: Square[];
}

/** Updates a card's editable fields (name, layout, squares) and bumps updatedAt. */
export async function updateCard(cardId: string, input: UpdateCardInput): Promise<void>;
```

`updateCard` writes only `name`, `layout`, `squares`, `updatedAt` —
`ownerId`, `gridSize`, `hasFreeSpace`, and `createdAt` are never touched.

## Edit route (`src/app/dashboard/cards/[id]/edit/page.tsx`)

Server component:

1. `getUser()`; redirect to `/` if signed out (same pattern as
   `/dashboard`).
2. `getCard(params.id)`; call `notFound()` if the card doesn't exist **or**
   `card.ownerId !== user.uid`. Using `notFound()` for both cases avoids
   revealing whether a card id belongs to someone else.
3. Derive `initialSettings: CardSettings` and `initialSquares:
   PositionedSquareDraft[]` (non-free-space squares only, sorted by
   `position` ascending — this becomes the stable entry order for editing)
   from the loaded card.
4. Render `<CardBuilder mode="edit" cardId={card.id} initialSettings={...}
   initialSquares={...} />`.

## `CardBuilder` changes (`_builder/card-builder.tsx`)

New props, all optional (default to create-mode behavior):

```ts
{
  mode?: "create" | "edit"; // default "create"
  cardId?: string;           // required when mode === "edit"
  initialSettings?: CardSettings;
  initialSquares?: PositionedSquareDraft[];
}
```

- `settings` state seeds from `initialSettings ?? DEFAULT_SETTINGS`.
- `squares` state seeds from `initialSquares` stripped to `SquareDraft`
  (drop `position`) when in edit mode, else `[]`.
- Step 2 → 3 transition: in **create** mode, keep calling `assignPositions`
  as today. In **edit** mode, skip shuffling — zip the edited `SquareDraft[]`
  back onto `initialSquares`' positions by index (same length, order
  preserved by construction, so this is a direct 1:1 pairing, not a
  matching search).
- Passes `mode` and (in edit mode) `cardId` down to `CardSettingsStep` and
  `ReviewStep`.

## `CardSettingsStep` changes

New prop `mode?: "create" | "edit"` (default `"create"`).

- Title: "Build a new card 🎲" (create) vs "Edit card ✏️" (edit).
- When `mode === "edit"`: the grid-size `SegmentedControl` and free-space
  `Switch` render `disabled`, with a small helper note beneath them: "Grid
  size and free space can't be changed after a card is created." Values
  still flow through unchanged (disabled controls keep their seeded
  value). Name and layout stay fully editable, same as create.

## `SquareEntryStep` changes

None needed. It already seeds from `defaultValues` by index and operates
on a fixed-length list derived from `settings` (grid size × grid size,
minus free space) — since grid size and free space can't change in edit
mode, the list length is always the card's existing square count, and it
gets pre-filled with the existing label/kind/goal per square instead of
blanks.

## `ReviewStep` changes

New props: `mode?: "create" | "edit"`, `cardId?: string` (required when
editing).

- Button label: "Save card" (create) vs "Save changes" (edit).
- `handleSave` calls `saveCard(settings, squares)` in create mode, or
  `updateCard(cardId, settings, squares)` in edit mode. Both redirect to
  `/dashboard` on success; both surface `result.error` inline on failure,
  same as today.

## `updateCard` Server Action (`[id]/edit/actions.ts`)

```ts
export async function updateCard(
  cardId: string,
  settings: CardSettings,
  squares: PositionedSquareDraft[],
): Promise<SaveCardResult>
```

1. `getUser()` — error if signed out (same message as `saveCard`).
2. `getCard(cardId)` — error "Card not found." if missing or
   `card.ownerId !== user.uid` (reuse `notFound`-style message, not a
   silent redirect, since this is a background action call).
3. Re-run the same field-level validation `saveCard` does: non-empty name;
   for every square, non-empty label, `CHECK` ⇒ `goal === 1`, `COUNTER` ⇒
   integer `goal >= 2`.
4. Defense-in-depth position check (the UI locks grid size/free space, but
   the action re-derives from the *existing* card rather than trusting the
   client): submitted square count must equal the existing card's
   non-free-space square count, and the submitted position set must
   exactly equal the existing non-free-space squares' position set. Reject
   with "Square layout doesn't match this card." if not.
5. Build the updated `Square[]`: for each submitted square, find the
   existing square at that position and reuse its `id`; apply the new
   `label`/`kind`/`goal`. Append the existing free-space square unchanged
   (its `id`, `position`, `label` never change here).
6. `updateCard(cardId, { name, layout, squares })`, wrapped in the same
   try/catch + generic error message pattern as `saveCard`.
7. `redirect("/dashboard")` on success.

## Dashboard changes (`src/app/dashboard/page.tsx`)

Each card in the grid becomes a link to its edit page — the only entry
point into a card that will exist after this change:

```tsx
<Link key={card.id} href={`/dashboard/cards/${card.id}/edit`} className="block">
  <Card>...</Card>
</Link>
```

## Non-goals

- No standalone read-only card detail/view page — the edit page doubles as
  the only per-card destination for now.
- No grid size or free-space editing (would require square
  add/remove/reshuffle reconciliation — separate future issue if wanted).
- No card deletion.
- No completions/progress reconciliation logic — that subsystem isn't
  built yet (see `docs/ARCHITECTURE.md`); this design only makes sure
  square `id`s stay stable so that future work isn't broken by edits made
  now.
