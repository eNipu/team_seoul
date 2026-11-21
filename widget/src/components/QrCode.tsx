import { useMemo } from "react";

const QUIET = 4; // modules of white margin required around a QR code

/** Renders QR rows ('1' = dark) as an inline SVG: always dark-on-white so it scans in either theme. */
export default function QrCode({ rows, label }: { rows: string[]; label: string }) {
  const path = useMemo(() => {
    const parts: string[] = [];
    rows.forEach((row, y) => {
      // Merge horizontal runs so the path stays small.
      let x = 0;
      while (x < row.length) {
        if (row[x] !== "1") {
          x += 1;
          continue;
        }
        let end = x;
        while (end < row.length && row[end] === "1") end += 1;
        parts.push(`M${x + QUIET} ${y + QUIET}h${end - x}v1h${x - end}z`);
        x = end;
      }
    });
    return parts.join("");
  }, [rows]);

  if (rows.length === 0) return null;
  const size = rows.length + QUIET * 2;
  return (
    <svg className="qr__code" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  );
}
