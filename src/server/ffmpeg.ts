import { getFfmpegBinaryPath } from "./paths";

type TSpawnedStreamProcess = ReturnType<typeof Bun.spawn>;

type TMusicStreamResult = {
  process: TSpawnedStreamProcess;
  title: string;
};

type TMusicOptions = {
  sourceUrl: string;
  audioPayloadType: number;
  audioSsrc: number;
  rtpHost: string;
  audioRtpPort: number;
  volume?: number;
  bitrate?: string;
  log: (...messages: unknown[]) => void;
  error: (...messages: unknown[]) => void;
  debug: (...messages: unknown[]) => void;
  onEnd?: () => void;
};

const FORCE_KILL_TIMEOUT_MS = 1500;

const readLines = async (
  stream: ReadableStream<Uint8Array>,
  onLine: (line: string) => void,
): Promise<void> => {
  const reader = stream.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  let reads = 0;

  const flush = (text: string) => {
    const trimmedLine = text.trim();

    if (trimmedLine) onLine(trimmedLine);
  };

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split(/\r\n|[\n\r]/);

      buffer = lines.pop() ?? "";

      for (const line of lines) flush(line);

      if (++reads % 25 === 0) await new Promise<void>((r) => setTimeout(r, 0));
    }

    flush(buffer);
  } finally {
    try {
      reader.releaseLock();
    } catch {}
  }
};

const logFfmpegLine = (line: string, options: TMusicOptions): void => {
  if (/\[(error|fatal|panic)\]/.test(line)) {
    options.error("[FFmpeg]", line);

    return;
  }

  options.log("[FFmpeg]", line);
};

const pendingForcedKill = new WeakSet<object>();

const terminateProcess = (process: TSpawnedStreamProcess | null): void => {
  if (!process) return;

  let exited = false;

  process.exited.finally(() => {
    exited = true;
  });

  try {
    process.kill("SIGTERM");
  } catch {}

  if (pendingForcedKill.has(process as unknown as object)) return;

  pendingForcedKill.add(process as unknown as object);

  setTimeout(() => {
    pendingForcedKill.delete(process as unknown as object);

    if (exited) return;

    try {
      process.kill("SIGKILL");
    } catch {}
  }, FORCE_KILL_TIMEOUT_MS);
};

const normalizeBitrate = (bitrate?: string): string => {
  if (!bitrate?.trim()) return "192k";

  const trimmed = bitrate.trim();

  if (/^\d+(?:\.\d+)?k$/i.test(trimmed)) return trimmed.toLowerCase();
  if (/^\d+$/.test(trimmed)) return trimmed;

  return "192k";
};

const spawnMusicStream = async (
  options: TMusicOptions,
): Promise<TMusicStreamResult> => {
  const ffmpegPath = getFfmpegBinaryPath();
  const volumeLevel = Math.min(100, Math.max(0, options.volume ?? 100)) / 100;
  const audioBitrate = normalizeBitrate(options.bitrate);

  options.log("Using FFmpeg binary at:", ffmpegPath);

  if (audioBitrate === "192k" && options.bitrate) {
    options.log(
      "Invalid bitrate setting, using default 192k:",
      options.bitrate,
    );
  }

  const ffmpegArgs = [
    "-hide_banner",
    "-nostats",
    "-loglevel",
    "level+warning",
    "-re",
    "-readrate_initial_burst",
    "0",
    "-i",
    options.sourceUrl,
    "-vn",
    "-af",
    `volume=${volumeLevel}`,
    "-c:a",
    "libopus",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-b:a",
    audioBitrate,
    "-application",
    "audio",
    "-payload_type",
    String(options.audioPayloadType),
    "-ssrc",
    String(options.audioSsrc),
    "-f",
    "rtp",
    `rtp://${options.rtpHost}:${options.audioRtpPort}?pkt_size=1200`,
  ];

  options.debug("Starting music stream with FFmpeg...");
  options.debug("Command:", ffmpegPath, ...ffmpegArgs);

  const process = Bun.spawn({
    cmd: [ffmpegPath, ...ffmpegArgs],
    stdout: "ignore",
    stderr: "pipe",
    stdin: "ignore",
  });

  if (process.stderr) {
    readLines(process.stderr, (line) => logFfmpegLine(line, options)).catch(
      (err: unknown) => options.error("[FFmpeg stderr error]", err),
    );
  }

  process.exited.then(() => options.onEnd?.());

  return { process, title: options.sourceUrl };
};

const killMusicStream = (process: TSpawnedStreamProcess | null): void => {
  terminateProcess(process);
};

export { killMusicStream, spawnMusicStream };
export type { TMusicOptions, TMusicStreamResult, TSpawnedStreamProcess };
