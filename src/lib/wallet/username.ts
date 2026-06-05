const ADJECTIVES = [
  "bold", "brave", "bright", "busy", "calm", "clever", "cool", "eager",
  "fast", "fierce", "fresh", "gentle", "happy", "jolly", "keen", "lucky",
  "mighty", "neat", "nice", "noble", "quick", "quiet", "sharp", "silly",
  "slick", "smart", "snappy", "sunny", "swift", "tidy", "witty", "wise",
];

const NOUNS = [
  "otter", "fox", "owl", "wolf", "bear", "lion", "eagle", "hawk",
  "falcon", "badger", "beaver", "lynx", "panda", "raven", "swan", "dolphin",
  "whale", "crab", "rabbit", "hare", "deer", "moose", "salmon", "sparrow",
  "robin", "finch", "heron", "puffin", "seal", "stoat", "lemur", "marmot",
];

function pick<T>(arr: readonly T[]): T {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return arr[bytes[0] % arr.length];
}

export function generateRandomUsername(): string {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  const num = 100 + (bytes[0] % 900);
  return `${pick(ADJECTIVES)}-${pick(NOUNS)}-${num}`;
}
