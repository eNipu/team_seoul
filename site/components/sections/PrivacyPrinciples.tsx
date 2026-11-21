const PRINCIPLES = [
  {
    title: "AI memory means a short signal.",
    text: "It can be what you are working on, need, offer, or plan. It is not a copy of your chat history.",
  },
  {
    title: "Nothing leaves without approval.",
    text: "Your AI can draft a signal. You decide what to save and what to share. Venn never sends a message for you.",
  },
  {
    title: "Friends do not need to join.",
    text: "Start with your own contacts and private notes. Venn can still help you find who to reconnect with.",
  },
  {
    title: "Independent from OpenAI.",
    text: "Venn works inside ChatGPT, but it is not an OpenAI feature and it is separate from ChatGPT's built-in memory.",
  },
];

export default function PrivacyPrinciples() {
  return (
    <section className="section principles" id="privacy" aria-labelledby="privacy-title">
      <div className="wrap">
        <h2 className="h-section" id="privacy-title">Consent first.</h2>
        <ul>
          {PRINCIPLES.map(({ title, text }) => (
            <li key={title}>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
