export default function HeroBackdrop() {
  return (
    <div className="hero__backdrop" aria-hidden="true">
      <div className="hero__circles">
        <span className="hero__circle hero__circle--a" />
        <span className="hero__circle hero__circle--b" />
      </div>
      <div className="hero__veil" />
    </div>
  );
}
