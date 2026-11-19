import { load } from "cheerio";
export const OFFICIAL_SOURCES: Record<string, string> = {
  bjcGHsmf540:
    "https://www.abc.net.au/education/learn-english/life-chat-learn-english-dealing-with-difficult-neighbours/11741316",
  KysPzRkN9uw:
    "https://www.abc.net.au/education/learn-english/life-chat-with-learn-english-small-talk/11754412",
  E9sJp2bISxk:
    "https://www.abc.net.au/education/learn-english/life-chat-learn-english-getting-a-refund/11741290",
};
export function officialSource(videoId: string, supplied?: string): string {
  if (supplied) {
    const u = new URL(supplied);
    if (
      u.protocol !== "https:" ||
      u.hostname !== "www.abc.net.au" ||
      u.port ||
      u.username ||
      u.password ||
      !u.pathname.startsWith("/education/learn-english/")
    )
      throw new Error("ABC Learn English 공식 페이지 링크를 입력해 주세요.");
    u.hash = "";
    u.search = "";
    return u.href;
  }
  const source = OFFICIAL_SOURCES[videoId];
  if (!source)
    throw new Error(
      "자동 연결된 공식 자료가 없어요. ABC 공식 자료 링크를 입력하거나 원문을 붙여넣어 주세요.",
    );
  return source;
}
export function parseOfficialTranscript(html: string): string {
  const $ = load(html);
  const blocks: string[] = [];
  let collecting = false,
    finished = false;
  $("p,h2,h3").each((_, el) => {
    if (finished) return;
    const text = $(el)
      .text()
      .replace(/\u00a0/g, " ")
      .trim();
    if (/^Transcript\s*:\s*$/i.test(text)) {
      collecting = true;
      return;
    }
    if (!collecting) return;
    if (
      /^(After you view|Before you view|Posted|For daily English|ABC Education brings)/i.test(
        text,
      )
    ) {
      finished = true;
      return;
    }
    if (text) blocks.push(text);
  });
  const result = blocks.join("\n\n");
  if (result.length < 20)
    throw new Error(
      "이 공식 페이지에서 스크립트를 찾지 못했어요. 원문을 직접 붙여넣어 주세요.",
    );
  return result;
}
