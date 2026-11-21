const STEPS = [
  {
    title: "Bring your people.",
    text: "Import your network. Venn can help you reconnect from your own notes before anyone else joins.",
  },
  {
    title: "Approve short signals.",
    text: "Your AI drafts what you are working on, need, offer, or plan. You choose what to save or share.",
  },
  {
    title: "Hear about the right person.",
    text: "When a signal fits the moment, your AI can bring up that person inside ChatGPT. You decide what to do next.",
  },
];

export default function HowItWorks() {
  return (
    <section className="section section--paper" id="how-it-works" aria-labelledby="steps-title">
      <div className="wrap">
        <h2 className="h-section" id="steps-title" data-reveal="up">How it works</h2>
        <ol className="steps" data-reveal="group">
          {STEPS.map(({ title, text }, index) => (
            <li className="step" key={title}>
              <span className="step__num" aria-hidden="true">{index + 1}</span>
              <h3 className="step__title">{title}</h3>
              <p className="step__text">{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
