export const LOCAL_KEYS = [
  "listening-lab.active.v1",
  "listening-lab.history.v1",
  "listening-lab.pending.v1",
] as const;
export function canonicalLocalOrigin(href: string): string | null {
  const url = new URL(href);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1") return null;
  url.hostname = "localhost";
  return url.origin;
}
export async function ensureLocalhost(): Promise<boolean> {
  if (
    location.hostname === "localhost" &&
    location.hash.startsWith("#listening-lab-transfer=")
  ) {
    const token = location.hash.slice("#listening-lab-transfer=".length);
    const response = await fetch(
      `/__listening-lab/transfer?token=${encodeURIComponent(token)}`,
      { cache: "no-store" },
    );
    if (!response.ok)
      throw new Error(
        "학습 기록 이전을 완료하지 못했어요. 원래 주소의 기록은 보존되어 있습니다.",
      );
    const records = await response.json();
    if (
      !LOCAL_KEYS.every(
        (key) => records[key] === null || typeof records[key] === "string",
      )
    )
      throw new Error("기록 형식이 올바르지 않습니다.");
    const previous = Object.fromEntries(
      LOCAL_KEYS.map((key) => [key, localStorage.getItem(key)]),
    );
    const backup = "listening-lab.localhost-backup.v2";
    if (!localStorage.getItem(backup))
      localStorage.setItem(backup, JSON.stringify(previous));
    try {
      for (const key of LOCAL_KEYS) {
        if (records[key] === null) localStorage.removeItem(key);
        else localStorage.setItem(key, records[key]);
      }
    } catch (e) {
      for (const key of LOCAL_KEYS) {
        if (previous[key] === null) localStorage.removeItem(key);
        else localStorage.setItem(key, previous[key]!);
      }
      throw e;
    }
    history.replaceState(null, "", location.pathname + location.search);
    return false;
  }
  const destination = canonicalLocalOrigin(location.href);
  if (!destination) return false;
  const marker = "listening-lab.migrated-to-localhost.v2";
  const target = new URL(location.href);
  target.hostname = "localhost";
  if (localStorage.getItem(marker) === destination) {
    location.replace(target.href);
    return true;
  }
  try {
    const records = Object.fromEntries(
      LOCAL_KEYS.map((key) => [key, localStorage.getItem(key)]),
    );
    const response = await fetch("/__listening-lab/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(records),
      cache: "no-store",
    });
    if (!response.ok) return false;
    const { token } = await response.json();
    if (typeof token !== "string") return false;
    localStorage.setItem(marker, destination);
    target.hash = `listening-lab-transfer=${token}`;
    location.replace(target.href);
    return true;
  } catch {
    return false;
  }
}
