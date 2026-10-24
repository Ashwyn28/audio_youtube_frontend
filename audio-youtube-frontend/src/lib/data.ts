import type { Channel } from "./types";
export const defaultChannels: Channel[] = [
  { name: "The PrimeTime", id: "UCUyeluBRhGPCW4rPe_UvBZQ" },
  { name: "vlogbrothers", id: "UCGaVdbSav8xWuFWTadK6loA" },
  { name: "Wendover Productions", id: "UC9RM-iSvTu1uPJb8X5yp3EQ" },
  { name: "Big A", id: "UCdBXOyqr8cDshsp7kcKDAkg" },
  { name: "Man Carrying Thing", id: "UCPdaxSov0mgwh77JvjQO2jQ" },
];

export const defaultsRevision = "youtube-history-2026-10-24";
const starterIds = new Set([
  "UCBJycsmduvYEL83R_U4JriQ",
  "UCEcrRXW3oEYfUctetZTAWLw",
  "UCSHZKyawb77ixDdsGog4iWA",
]);

export function migrateStarterChannels(channels: Channel[]): Channel[] {
  // A missing starter channel means the user already customized the initial set.
  if (![...starterIds].every(id => channels.some(channel => channel.id === id))) return channels;
  const custom = channels.filter(channel => !starterIds.has(channel.id));
  const customIds = new Set(custom.map(channel => channel.id));
  let slots = Math.max(0, 30 - custom.length);
  const defaults = defaultChannels.filter(channel => {
    if (customIds.has(channel.id)) return true;
    if (!slots) return false;
    slots--;
    return true;
  });
  const selectedIds = new Set(defaults.map(channel => channel.id));
  return [...defaults, ...custom.filter(channel => !selectedIds.has(channel.id))];
}
