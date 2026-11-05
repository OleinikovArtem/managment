# Lineage II icons

The app loads game icons directly from public hosts; image files are not copied
into the repository or embedded in the SQLite catalog.

## Item icons

`src/components/ui/game-icon.tsx` maps the canonical item name to an L2DB icon
key, then loads `https://l2db.info/uploads/images/icons/{icon-key}.png`.
Exact keys are used for the seeded armor families, listed weapons, Life Stones,
Neolithic Crystals, enchant scrolls, spellbooks, and Giant's Codices. Unknown
names use the package fallback instead of an unrelated guessed game icon.

Item records and their icon keys can be checked against the
[High Five item database](https://l2db.info/high-five/items) and its
[armor set records](https://l2db.info/high-five/armorsets). Examples include
[Vesper Cutter](https://l2db.info/high-five/items/13457),
[Imperial Crusader Breastplate](https://l2db.info/high-five/items/6373),
[Neolithic Crystal - S84](https://l2db.info/high-five/items/21579), and
[Giant's Codex](https://l2db.info/high-five/items/6622).

## Class icons

Profile class icons use the High Five class portrait files hosted by L2Tools
because L2DB's class pages expose skills but do not provide a matching portrait
set. Third-profession names in the app map to their corresponding class portrait
using the predecessor class where needed (for example, Cardinal to Bishop).
The icons load from `https://l2tools.org/images/class-tier-list/v3/` and fall
back to a neutral class glyph if the name has no mapping or the external asset
is unavailable.

## Runtime behavior

- No remote image optimization, server fetch, schema field, or backend API is
  required; images are rendered as CSS backgrounds.
- Item and class fallbacks remain visible beneath transparent icon artwork.
- A changed canonical item name must be reviewed against L2DB before adding an
  icon key. Do not infer item icons only from broad words such as “sword” or
  “armor”.
- External-host availability and URL stability are outside the application's
  control.
