// Hero headlines. Each Meta ad can pin its matching line with ?h=<key> (message match);
// without ?h= the hero rotates slowly through them. Copy chosen with a generator/evaluator loop
// (vann-ads/scripts/hero_harness.py) and kept close to the founder's wording.
export type Hero = { key: string; rotate: boolean; head: string; sub: string; ask: string; person: string; answer: string };

export const HEROES: readonly Hero[] = [
  {
    key: "keeping",
    rotate: true, // default rotation
    head: "Connecting is easy. Keeping is hard.",
    sub: "Friends share a few updates a week. Your ChatGPT brings them up when they matter.",
    ask: "I have no plans this weekend. Ideas?",
    person: "Emma",
    answer: "Emma from uni is in Berlin on Saturday. You haven't seen her in 2 years.",
  },
  {
    key: "network",
    rotate: true, // default rotation
    head: "Stop networking. Start using your network.",
    sub: "Venn adds chosen weekly updates to ChatGPT, so it can tell you who can help. Never chat history.",
    ask: "Who can introduce me to customers?",
    person: "Raj",
    answer: "Raj, your angel, knows Owen at Onward Labs. Owen needs exactly what you sell.",
  },
  {
    key: "notworking",
    rotate: true, // founder line, 2026-11-22
    head: "Your networking is not working.",
    sub: "Venn adds chosen weekly updates to ChatGPT, so it can tell you who in your network can help.",
    ask: "Who should I talk to about our seed round?",
    person: "Priya",
    answer: "Priya, your old manager, just joined a fund that leads seed rounds in your space.",
  },
  {
    key: "leads",
    rotate: true, // founder line, 2026-11-22
    head: "Stop paying for new leads. Use your network first.",
    sub: "Your next client is often one intro away. Venn tells ChatGPT who, and when.",
    ask: "Who can introduce me to customers?",
    person: "Raj",
    answer: "Raj, your angel, knows Owen at Onward Labs. Owen needs exactly what you sell.",
  },
  {
    key: "connections",
    rotate: true, // default rotation
    head: "1,000 connections. 0 updates.",
    sub: "Venn keeps the people you met in your ChatGPT, with updates they chose to share.",
    ask: "Who should I catch up with?",
    person: "Nate",
    answer: "Nate just moved to New York and wants startup friends. Send him a welcome?",
  },
  {
    key: "mom",
    rotate: false, // only when an ad pins it with ?h= (critic: risky for cold traffic)
    head: "AI knows you better than your mom. Why not your friends?",
    sub: "Share a few chosen updates with your inner circle every week. Not your chat history.",
    ask: "What should I get Lena for her 30th?",
    person: "Lena",
    answer: "Lena has been wanting to try a pottery class. She mentioned it this week.",
  },
  {
    key: "talk",
    rotate: false, // only when an ad pins it with ?h= (critic: risky for cold traffic)
    head: "What if our ChatGPTs talked?",
    sub: "Two people. Two AIs. One shared memory you both choose.",
    ask: "Plan something for us this weekend.",
    person: "both your",
    answer: "You both want something creative. There's a pottery class on Saturday at 11.",
  },
];

export const heroIndex = (key: string | undefined | null) => {
  const i = HEROES.findIndex((h) => h.key === key);
  return i < 0 ? -1 : i;
};
