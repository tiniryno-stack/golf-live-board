// teams.js — cart "jerseys" and the quick team names.
//
// Home jersey: your own cart is always green (--cart-you) on your phone.
// Away jerseys: every other cart has a fixed color that looks the same to everyone.
// (Red is avoided on purpose: red already means double bogey and errors.)

/** Quick cart names: the original 151 Pokémon (feature 009). */
export const TEAM_NAME_PICKS = [
  'Bulbasaur', 'Ivysaur', 'Venusaur', 'Charmander', 'Charmeleon', 'Charizard', 'Squirtle', 'Wartortle', 'Blastoise', 'Caterpie',
  'Metapod', 'Butterfree', 'Weedle', 'Kakuna', 'Beedrill', 'Pidgey', 'Pidgeotto', 'Pidgeot', 'Rattata', 'Raticate',
  'Spearow', 'Fearow', 'Ekans', 'Arbok', 'Pikachu', 'Raichu', 'Sandshrew', 'Sandslash', 'Nidoran♀', 'Nidorina',
  'Nidoqueen', 'Nidoran♂', 'Nidorino', 'Nidoking', 'Clefairy', 'Clefable', 'Vulpix', 'Ninetales', 'Jigglypuff', 'Wigglytuff',
  'Zubat', 'Golbat', 'Oddish', 'Gloom', 'Vileplume', 'Paras', 'Parasect', 'Venonat', 'Venomoth', 'Diglett',
  'Dugtrio', 'Meowth', 'Persian', 'Psyduck', 'Golduck', 'Mankey', 'Primeape', 'Growlithe', 'Arcanine', 'Poliwag',
  'Poliwhirl', 'Poliwrath', 'Abra', 'Kadabra', 'Alakazam', 'Machop', 'Machoke', 'Machamp', 'Bellsprout', 'Weepinbell',
  'Victreebel', 'Tentacool', 'Tentacruel', 'Geodude', 'Graveler', 'Golem', 'Ponyta', 'Rapidash', 'Slowpoke', 'Slowbro',
  'Magnemite', 'Magneton', 'Farfetch’d', 'Doduo', 'Dodrio', 'Seel', 'Dewgong', 'Grimer', 'Muk', 'Shellder',
  'Cloyster', 'Gastly', 'Haunter', 'Gengar', 'Onix', 'Drowzee', 'Hypno', 'Krabby', 'Kingler', 'Voltorb',
  'Electrode', 'Exeggcute', 'Exeggutor', 'Cubone', 'Marowak', 'Hitmonlee', 'Hitmonchan', 'Lickitung', 'Koffing', 'Weezing',
  'Rhyhorn', 'Rhydon', 'Chansey', 'Tangela', 'Kangaskhan', 'Horsea', 'Seadra', 'Goldeen', 'Seaking', 'Staryu',
  'Starmie', 'Mr. Mime', 'Scyther', 'Jynx', 'Electabuzz', 'Magmar', 'Pinsir', 'Tauros', 'Magikarp', 'Gyarados',
  'Lapras', 'Ditto', 'Eevee', 'Vaporeon', 'Jolteon', 'Flareon', 'Porygon', 'Omanyte', 'Omastar', 'Kabuto',
  'Kabutops', 'Aerodactyl', 'Snorlax', 'Articuno', 'Zapdos', 'Moltres', 'Dratini', 'Dragonair', 'Dragonite', 'Mewtwo',
  'Mew',
];

const AWAY = { A: '--t-A', B: '--t-B', C: '--t-C', D: '--t-D', E: '--t-E', F: '--t-F' };

/** CSS color for a cart as seen from this phone. */
export function teamColor(myTeamId, teamId) {
  if (teamId && teamId === myTeamId) return 'var(--cart-you)';
  if (teamId && teamId.length === 2) return teamId.includes('A') ? 'var(--t-A)' : 'var(--t-B)'; // 2v2 pairings ('AB' v 'CD')
  return AWAY[teamId] ? `var(${AWAY[teamId]})` : 'var(--ink-soft)';
}

/** A headline wears the jersey of the team on its positive end; sun when nobody is (halved, tie). */
export function headlineColor(myTeamId, h) {
  return h?.hero ? teamColor(myTeamId, h.hero) : 'var(--warn)';
}

/** Short team name for tight spots: "Hogan’s Heroes" → "Hogan’s", "The Bogey Brigade" → "Bogey". */
export function shortTeam(name) {
  const full = String(name || '').trim();
  if (full.length <= 10 || full.includes(' + ')) return full; // 2v2 pairings keep both names
  const w = full.split(/\s+/).filter((x) => !/^the$/i.test(x));
  if (!w.length) return full;
  return w[0].length <= 3 && w[1] ? `${w[0]} ${w[1]}` : w[0];
}

/** A team still has its placeholder name ("Cart A"…) and can pick one. */
export function isDefaultTeamName(team) {
  return !team?.name || /^Cart [A-D]$/i.test(String(team.name).trim());
}
