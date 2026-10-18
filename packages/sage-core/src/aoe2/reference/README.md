# Halfon reference

`units.json` contains the ID, localized English name, language string ID and type
of each named unit/building from the pinned input in `source.json`.

Source: [SiegeEngineers/halfon](https://github.com/SiegeEngineers/halfon/tree/abb48fdbedba57d5afe2b7941d6ae85cf6e0e803),
AoE II DE update 185872. The upstream MIT license is retained as `halfon-LICENSE`.
Match-local names take precedence. Halfon warns that localized names can be
inaccurate for unconventional objects; no match files are rewritten.

To reproduce, fetch `path` from the repository's pinned `revision`, verify the
SHA256 in `source.json`, then retain `units_buildings` entries having both a
non-empty `localised_name` and nonzero `language_file_name`. Map them to
`{ name: localised_name, stringId: language_file_name, type }` keyed by original ID.
