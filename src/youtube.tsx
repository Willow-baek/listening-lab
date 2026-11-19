import { useEffect, useRef, useState } from "react";
export type Player = {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(t: number, allow: boolean): void;
  getCurrentTime(): number;
  getPlayerState(): number;
  getDuration(): number;
  setPlaybackRate(n: number): void;
  getPlaybackRate(): number;
  getAvailablePlaybackRates(): number[];
  destroy(): void;
};
declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, options: unknown) => Player };
    onYouTubeIframeAPIReady?: () => void;
  }
}
let api: Promise<void> | undefined;
function loadAPI() {
  return (api ??= new Promise<void>((resolve, reject) => {
    if (window.YT?.Player) return resolve();
    window.onYouTubeIframeAPIReady = resolve;
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.onerror = () => {
      api = undefined;
      reject(
        new Error(
          "YouTube를 불러오지 못했어요. 연결을 확인하고 페이지를 새로고침해 주세요.",
        ),
      );
    };
    document.head.append(s);
  }));
}
export function YouTube({
  id,
  start,
  onReady,
  onState,
  onError,
  onAutoplayBlocked,
  onReload,
  onPlaybackRateChange,
}: {
  id: string;
  start: number;
  onReady(p: Player): void;
  onState(state: number): void;
  onError(message: string): void;
  onAutoplayBlocked?(): void;
  onReload?(): void;
  onPlaybackRateChange?(rate: number): void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const callbacks = useRef({
    onReady,
    onState,
    onError,
    onAutoplayBlocked,
    onReload,
    onPlaybackRateChange,
  });
  callbacks.current = {
    onReady,
    onState,
    onError,
    onAutoplayBlocked,
    onReload,
    onPlaybackRateChange,
  };
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setLoading(true);
    setFailed(false);
    let disposed = false;
    let p: Player | undefined;
    const timeout = window.setTimeout(() => {
      if (!disposed) {
        setLoading(false);
        setFailed(true);
        callbacks.current.onError(
          "플레이어 로딩이 지연되고 있어요. 네트워크·콘텐츠 차단 설정을 확인하고 새로고침해 주세요.",
        );
      }
    }, 15000);
    loadAPI()
      .then(() => {
        if (disposed || !host.current) return;
        const target = document.createElement("iframe");
        const params = new URLSearchParams({
          enablejsapi: "1",
          origin: location.origin,
          start: String(start),
          playsinline: "1",
          controls: "1",
        });
        target.src = `https://www.youtube.com/embed/${id}?${params}`;
        target.title = "YouTube 학습 영상";
        target.referrerPolicy = "strict-origin-when-cross-origin";
        target.allow =
          "autoplay; encrypted-media; picture-in-picture; fullscreen";
        target.allowFullscreen = true;
        host.current.append(target);
        p = new window.YT!.Player(target, {
          width: "100%",
          height: "100%",
          videoId: id,
          playerVars: {
            start,
            playsinline: 1,
            controls: 1,
            origin: location.origin,
          },
          events: {
            onReady: () => {
              clearTimeout(timeout);
              setLoading(false);
              callbacks.current.onReady(p!);
            },
            onStateChange: (e: { data: number }) =>
              callbacks.current.onState(e.data),
            onPlaybackRateChange: (e: { data: number }) => callbacks.current.onPlaybackRateChange?.(e.data),
            onAutoplayBlocked: () => callbacks.current.onAutoplayBlocked?.(),
            onError: (e: { data: number }) => {
              clearTimeout(timeout);
              setLoading(false);
              setFailed(true);
              callbacks.current.onError(
                e.data === 150 || e.data === 101
                  ? `이 재생 환경에서 영상이 차단됐어요 (YouTube ${e.data}). 플레이어를 다시 불러오거나 일반 브라우저에서 같은 앱 주소를 열어 주세요. 영상 자체의 삽입 제한일 수도 있습니다. 기록은 보존됩니다.`
                  : e.data === 153
                    ? "YouTube가 앱의 출처를 확인하지 못했어요 (153). localhost 주소에서 다시 시도해 주세요. 기록은 보존됩니다."
                    : `영상을 재생하지 못했어요 (YouTube ${e.data}). 연결과 영상 공개 상태를 확인한 뒤 다시 시도해 주세요.`,
              );
            },
          },
        });
      })
      .catch((e) => {
        clearTimeout(timeout);
        setLoading(false);
        setFailed(true);
        callbacks.current.onError(e.message);
      });
    return () => {
      disposed = true;
      clearTimeout(timeout);
      p?.destroy();
      host.current?.replaceChildren();
    };
  }, [id, start, attempt]);
  return (
    <>
      <div className="youtube" ref={host} />
      {loading && <p role="status">YouTube 플레이어를 불러오는 중…</p>}
      {failed && (
        <button
          className="quiet"
          onClick={() => {
            callbacks.current.onReload?.();
            setAttempt((n) => n + 1);
          }}
        >
          플레이어 다시 불러오기
        </button>
      )}
    </>
  );
}
