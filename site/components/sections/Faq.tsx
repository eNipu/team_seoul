import type { ReactNode } from "react";

const QUESTIONS = [
  {
    question: "What’s an AI memory?",
    answer: "In Venn, it is a short signal you approve, like “I’m in Berlin on Saturday” or “I’m looking for a designer.” It is not a copy of your chat.",
  },
  {
    question: "Is Venn spying on my friends?",
    answer: "No. Each person approves their own signals. You see only what they choose to share with you, plus your own private notes.",
  },
  {
    question: "Do my friends need to join?",
    answer: "No. Import your network and use your own notes to find people to reconnect with. If someone joins later, you can also see signals they approve for you.",
  },
  {
    question: "Is this an OpenAI feature?",
    answer: "No. Venn is an independent app you’ll use inside ChatGPT. It’s separate from ChatGPT’s built-in memory.",
  },
  {
    question: "Will Venn be expensive?",
    answer: (
      <>
        No. Early access is free. At launch, your circle shares one subscription: the more people you invite, the less each pays, down to $2 a month.{" "}
        <a href="/pricing">See planned pricing.</a>
      </>
    ),
  },
  {
    question: "Will it work with Claude?",
    answer: "ChatGPT comes first. Claude support is planned for later.",
  },
  {
    question: "Can I use Venn now?",
    answer: "Not yet. Join the waitlist for early access. If the form asks you to invite someone to confirm your spot, that is a waitlist step, not a product requirement.",
  },
];

export default function Faq() {
  return (
    <section className="section section--paper faq" id="faq" aria-labelledby="faq-title">
      <div className="wrap" data-reveal="group">
        <h2 className="h-section" id="faq-title">Frequently asked questions</h2>
        {QUESTIONS.map(({ question, answer }: { question: string; answer: ReactNode }) => (
          <details className="faq__item" key={question}>
            <summary>{question}</summary>
            <p>{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
