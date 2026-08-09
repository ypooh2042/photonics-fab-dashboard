import { cookies } from "next/headers";
import type { Lang } from "./i18n";

const LANG_COOKIE = "lang";

export async function getServerLang(): Promise<Lang> {
  const store = await cookies();
  return store.get(LANG_COOKIE)?.value === "en" ? "en" : "ko";
}
