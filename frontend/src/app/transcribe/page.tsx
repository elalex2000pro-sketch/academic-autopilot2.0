import { redirect } from "next/navigation";

export default function TranscribePage() {
  redirect("/studio?mode=audio");
}
