// Example data shared by the 3D scene, the card under it, and the "inside ChatGPT" example.
// Everyone here is made up; the page footer says so.

// Ordered as a ring: each person below shares two neighbouring interests, so in the scene
// they sit between those two clusters without crossing another one.
export const CLUSTERS = ["Climbing", "Design", "Berlin", "AI tools", "Retail"];

export const PEOPLE = [
  {
    name: "Mina Park",
    clusters: [0, 1],
    quiet: "quiet for 8 months",
    keep: "She shared that she’s trying a new bouldering gym. Ask to join her.",
    use: "Her design studio is hiring freelancers. You know two good ones.",
  },
  {
    name: "Teodor Weiss",
    clusters: [3, 2],
    quiet: "quiet for 14 months",
    keep: "He moved to Berlin last month. Send him your list of cafés to work from.",
    use: "He’s looking for his first enterprise clients. Your old team buys what he sells.",
  },
  {
    name: "Sam Okafor",
    clusters: [3, 4],
    quiet: "quiet for 2 years",
    keep: "You both tried the same checkout tool this year. Compare notes.",
    use: "He’s raising a seed round and wants an advisor who knows retail.",
  },
  {
    name: "Lea Novak",
    clusters: [1, 2],
    quiet: "quiet for 11 months",
    keep: "Her studio turns five in March. Congratulate her.",
    use: "She needs a part-time finance lead. That’s the work you do.",
  },
  {
    name: "Jun Ito",
    clusters: [4, 0],
    quiet: "quiet for 6 months",
    keep: "He’s in town for the trade fair. Offer a climb and a coffee.",
    use: "He wants a partner agency for a store rollout.",
  },
];

export const firstName = (person) => person.name.split(" ")[0];
