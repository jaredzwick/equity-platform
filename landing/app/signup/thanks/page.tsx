import { permanentRedirect } from "next/navigation";

export default function SignupThanksRedirect(): never {
  permanentRedirect("/join/thanks");
}
