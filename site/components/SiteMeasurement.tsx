"use client";

import { usePathname } from "next/navigation";
import Clarity from "./Clarity";
import MetaPixel from "./MetaPixel";

export default function SiteMeasurement() {
  // The demo displays typed draft text in the page alongside the isolated widget.
  if (usePathname() === "/chatgpt") return null;
  return <><Clarity /><MetaPixel /></>;
}
