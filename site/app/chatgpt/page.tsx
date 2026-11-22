import { redirect } from "next/navigation";

// The ChatGPT widget demo is off the site for now (founder, 22.11.2026). ChatGptPreview and
// ChatGptConnection stay in components/ to bring back later. Old links land on the main demo.
export default function ChatGptPage() {
  redirect("/#inside");
}
