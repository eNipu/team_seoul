// A small fictional rehearsal of the server's curated activity cards, never a live matcher.
const plans = {
  photography: ["One block, two frames", "Take a 30-minute photo walk", "Find two different pictures in the same scene."],
  architecture: ["Read the street", "Walk a block comparing old and new facades", "Choose the detail you’d steal for your dream house."],
  art: ["A color hunt for two", "Look for public art", "Pick a color for each other to find in five minutes."],
  books: ["Judge a book by its first line", "Browse a neighborhood bookshop", "Find two opening lines and guess which story goes with each."],
  coffee: ["Two cups, two tasting notes", "Try a café together", "Each write down one tasting note before comparing answers."],
  walking: ["A walk with one rule", "Explore a public walking path for 20 minutes", "Each point out something the other would have walked past."],
};

export function demoOverlapPlan(mine: string[], theirs: string[], area: string) {
  const common = (Object.keys(plans) as (keyof typeof plans)[]).find(i => mine.includes(i) && theirs.includes(i));
  if (!common) return null;
  let [title, activity, challenge] = plans[common];
  let why = `You both picked ${common}.`;
  const bridges = [
    ["photography", "architecture", "One roll, one neighborhood", "Take a 45-minute architectural photo walk", "Each photograph one doorway the other would have walked past."],
    ["coffee", "books", "Coffee and first lines", "Trade book recommendations over a coffee", "Pitch a favorite book in one sentence without naming it."],
    ["walking", "art", "A gallery without walls", "Look for murals and signs on a short public walk", "Pick one street detail you’d frame as a print."],
  ];
  for (const [a, b, bridgeTitle, bridgeActivity, bridgeChallenge] of bridges) {
    const extra = common === a ? b : common === b ? a : null;
    if (!extra || (!mine.includes(extra) && !theirs.includes(extra))) continue;
    [title, activity, challenge] = [bridgeTitle, bridgeActivity, bridgeChallenge];
    why += ` ${mine.includes(extra) ? (theirs.includes(extra) ? "You both" : "You") : "They"} also picked ${extra}.`;
    break;
  }
  return {title, reason: `${activity} in ${area[0].toUpperCase() + area.slice(1)}. ${why}`, challenge};
}
