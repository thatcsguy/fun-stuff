// Fight groups on the main screen: how far along each fight is. EDIT HERE to move a fight between groups (by boss id).
// Order inside a group is the order its fights are shown. A boss that is in no group shows up under the last group.
// Ids: cathedral (Maestra Ossia), leviathan (Thalassor), duelist (Issen), engine (Parallax), titan (Molthar), gorgon (Euryale),
// theatre (Impresario), wheel (Lady Fortuna), express (Ironjaw), winter (Huntsman), origami (Oriko), lamp (Vesper),
// chess (Zugzwang), festival (Nian), fall (Anzu), clock (Horologist), portal (Janus), atelier (Pentimento), sumi (Garyo).
const GROUPS = [
  { id: 'nightmare', name: 'Nightmare', bosses: ['duelist', 'atelier', 'theatre', 'gorgon'] },
  { id: 'ready', name: 'Ready', bosses: ['engine'] },
  { id: 'almost', name: 'Almost', bosses: ['cathedral', 'leviathan', 'origami', 'lamp', 'chess', 'festival', 'fall', 'portal'] },
  { id: 'concept', name: 'Concept', bosses: ['titan', 'wheel', 'express', 'winter', 'clock', 'sumi'] },
];
// the fights of each group, as boss defs (unknown ids are skipped; unlisted bosses fall into the last group)
function groupedBosses() {
  const out = GROUPS.map((g) => ({ g, list: g.bosses.map((id) => G.bosses.find((d) => d.id === id)).filter(Boolean) }));
  const used = new Set(GROUPS.flatMap((g) => g.bosses));
  for (const d of G.bosses) if (!used.has(d.id)) out[out.length - 1].list.push(d);
  return out;
}
// which groups the main screen shows (saved in Settings.groups; every group is shown until toggled off)
function groupShown(id) { return !(Settings.groups && Settings.groups[id] === false); }
