type MomentProps = {
  person: string;
  text: string;
  yellow?: boolean;
};

export default function Moment({ person, text, yellow = false }: MomentProps) {
  return (
    <div className={yellow ? "moment moment--yellow" : "moment"}>
      <img className="moment__icon" src="/brand/ai-icon.png" width={66} height={70} alt="" aria-hidden="true" />
      <p className="moment__text">{text}</p>
      <p className="moment__prov">Shared by {person === "both your" ? "both your AIs" : `${person}'s AI`} · via <b>venn</b></p>
    </div>
  );
}
