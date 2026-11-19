import { defineConfig, type Plugin } from "vite";
import { randomUUID } from "node:crypto";
import {
  officialSource,
  parseOfficialTranscript,
} from "./src/official-transcript";
import { firstSpeechRange } from "./src/transcript-cues";
import { KNOWN_CAPTIONS } from "./src/known-captions";
import { fetchYouTubeCaptions } from "./src/youtube-captions";
import type { IncomingMessage, ServerResponse } from "node:http";
// One-time local transfer between numeric loopback and localhost. Payloads are
// held only in this process, expire after 60s, and never enter URLs or disk.
function localTransfer(): Plugin {
  const captionCache = new Map<string, Awaited<ReturnType<typeof fetchYouTubeCaptions>>>();
  const getCaptions = async (id: string) => {
    const saved = KNOWN_CAPTIONS[id] ?? captionCache.get(id);
    if (saved) return saved;
    const cues = await fetchYouTubeCaptions(id);
    if (captionCache.size >= 100) captionCache.clear();
    captionCache.set(id, cues);
    return cues;
  };
  const transfers = new Map<
    string,
    { records: Record<string, string | null>; expires: number }
  >();
  const keys = [
    "listening-lab.active.v1",
    "listening-lab.history.v1",
    "listening-lab.pending.v1",
  ];
  const middleware = async (
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    if (
      url.pathname !== "/__listening-lab/transfer" &&
      url.pathname !== "/__listening-lab/transcript" &&
      url.pathname !== "/__listening-lab/timing"
    )
      return next();
    const send = (code: number, data: unknown) => {
      res.writeHead(code, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(data));
    };
    if (!["localhost", "127.0.0.1"].includes(url.hostname))
      return send(403, {});
    if (url.pathname === "/__listening-lab/timing") {
      if (req.method !== "GET") return send(405, {});
      try {
        const range = firstSpeechRange(await getCaptions(url.searchParams.get("videoId") ?? ""));
        return send(200, { range: range ?? null });
      } catch { return send(200, { range: null }); }
    }
    if (url.pathname === "/__listening-lab/transcript") {
      if (req.method !== "GET") return send(405, {});
      try {
        const videoId = url.searchParams.get("videoId") ?? "";
        let captionError = "";
        if (!url.searchParams.get("source")) {
          try {
            const cues = await getCaptions(videoId);
            return send(200, { text: cues.map(c => c.text).join("\n"), cues, source: `https://www.youtube.com/watch?v=${videoId}`, kind: "youtube", coverage: "full" });
          } catch (e) { captionError = (e as Error).message; }
        }
        let source: string;
        try { source = officialSource(
          url.searchParams.get("videoId") ?? "",
          url.searchParams.get("source") || undefined,
        ); } catch { throw new Error(captionError || "ABC 공식 페이지 링크를 입력하거나 시간 자막을 붙여넣어 주세요."); }
        const response = await fetch(source, {
          signal: AbortSignal.timeout(12000),
          redirect: "error",
        });
        if (!response.ok)
          throw new Error(
            "공식 자료에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.",
          );
        const html = await response.text();
        return send(200, {
          text: parseOfficialTranscript(html),
          source,
          kind: "abc",
          timingAvailable: false,
          coverage: "full",
        });
      } catch (e) {
        return send(400, { error: (e as Error).message });
      }
    }

    for (const [id, entry] of transfers)
      if (entry.expires < Date.now()) transfers.delete(id);
    if (req.method === "POST") {
      if (req.headers.origin !== url.origin) return send(403, {});
      try {
        let body = "";
        for await (const chunk of req) {
          body += chunk.toString();
          if (body.length > 2_000_000) return send(413, {});
        }
        const records = JSON.parse(body);
        if (
          !keys.every(
            (key) => records[key] === null || typeof records[key] === "string",
          )
        )
          return send(400, {});
        const token = randomUUID();
        transfers.set(token, {
          records: Object.fromEntries(keys.map((k) => [k, records[k]])),
          expires: Date.now() + 60_000,
        });
        return send(200, { token });
      } catch {
        return send(400, {});
      }
    }
    if (req.method === "GET") {
      const token = url.searchParams.get("token") ?? "",
        entry = transfers.get(token);
      if (!entry) return send(404, {});
      transfers.delete(token);
      return send(200, entry.records);
    }
    send(405, {});
  };
  return {
    name: "listening-lab-local-transfer",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
export default defineConfig({
  base: process.env.GITHUB_PAGES === "1" ? "/listening-lab/" : "/",
  define: { __STATIC_HOST__: JSON.stringify(process.env.GITHUB_PAGES === "1") },
  plugins: [localTransfer()],
});
