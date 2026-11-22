/** The Venn wordmark. Use the sticker on light surfaces so the yellow stays legible. */
export default function VennMark({ size = 112, variant = "sticker" }: { size?: number; variant?: "sticker" | "plain" }) {
  const sticker = variant === "sticker";
  return (
    <img
      className={`vann-logo${sticker ? " sticker" : ""}`}
      src={sticker ? "/brand/venn-logo-sticker.png" : "/brand/venn-logo-yellow.png"}
      alt="Venn"
      width={sticker ? 920 : 800}
      height={sticker ? 363 : 243}
      style={{ width: size, height: "auto" }}
    />
  );
}
