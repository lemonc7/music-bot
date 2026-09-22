import type { PluginContext } from "@sharkord/plugin-sdk";
import fs from "fs/promises";
import path from "path";
import {
  getBinDir,
  getDownloadDir,
  getFfmpegBinaryPath,
} from "./paths";

type TDownloadLogger = Pick<PluginContext["logger"], "log" | "error">;

const downloadUrls: Record<string, string> = {
  linux_x64:
    "https://github.com/diogomartino/plugin-binaries/releases/latest/download/ffmpeg-linux-x64.tar.gz",
  linux_arm64:
    "https://github.com/diogomartino/plugin-binaries/releases/latest/download/ffmpeg-linux-arm64.tar.gz",
  win32_x64:
    "https://github.com/diogomartino/plugin-binaries/releases/latest/download/ffmpeg-win64.tar.gz",
};

const ensureDir = async (dir: string, logger?: TDownloadLogger) => {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    logger?.error(`Failed to create directory ${dir}:`, err);
    throw err;
  }
};

const pathExists = async (targetPath: string): Promise<boolean> => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const findFileRecursive = async (
  rootDir: string,
  fileName: string,
): Promise<string | null> => {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name);

    if (entry.isFile() && entry.name === fileName) return entryPath;

    if (entry.isDirectory()) {
      const nestedPath = await findFileRecursive(entryPath, fileName);

      if (nestedPath) return nestedPath;
    }
  }

  return null;
};

const extractArchive = async (
  archivePath: string,
  extractPath: string,
  logger: TDownloadLogger,
): Promise<void> => {
  await ensureDir(extractPath, logger);
  logger.log(`Extracting archive ${archivePath} to ${extractPath}`);

  const tarball = await Bun.file(archivePath).bytes();
  const archive = new Bun.Archive(tarball);
  const entryCount = await archive.extract(extractPath);

  logger.log(`Extracted ${entryCount} entries from ${archivePath}`);
};

const downloadFile = async (
  url: string,
  outputPath: string,
  logger: TDownloadLogger,
): Promise<void> => {
  await ensureDir(path.dirname(outputPath), logger);
  logger.log(`Starting download from ${url} to ${outputPath}`);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to download FFmpeg: ${response.status} ${response.statusText}`,
    );
  }

  if (!response.body) {
    throw new Error(`FFmpeg download response has no body: ${url}`);
  }

  const totalBytesHeader = response.headers.get("content-length");
  const totalBytes = totalBytesHeader ? Number(totalBytesHeader) : NaN;
  const hasTotalBytes = Number.isFinite(totalBytes) && totalBytes > 0;
  const file = await fs.open(outputPath, "w");
  const reader = response.body.getReader();

  let downloadedBytes = 0;
  let lastLoggedPercent = -1;
  let lastLoggedBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;
      if (!value) continue;

      await file.write(value);
      downloadedBytes += value.byteLength;

      if (hasTotalBytes) {
        const percent = Math.floor((downloadedBytes / totalBytes) * 100);

        if (percent >= lastLoggedPercent + 10 || percent === 100) {
          logger.log(
            `Downloading FFmpeg: ${percent}% (${downloadedBytes}/${totalBytes} bytes)`,
          );
          lastLoggedPercent = percent;
        }
      } else if (downloadedBytes - lastLoggedBytes >= 5 * 1024 * 1024) {
        logger.log(`Downloading FFmpeg: ${downloadedBytes} bytes`);
        lastLoggedBytes = downloadedBytes;
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {}

    await file.close();
  }

  logger.log(`Finished downloading FFmpeg: ${downloadedBytes} bytes`);
};

const downloadFfmpegArchive = async (
  tempDir: string,
  logger: TDownloadLogger,
): Promise<void> => {
  const arch = `${process.platform}_${process.arch}`;
  const url = downloadUrls[arch];

  if (!url) {
    throw new Error(`No FFmpeg download configured for architecture: ${arch}`);
  }

  const binaryPath = getFfmpegBinaryPath();
  const binaryName = path.basename(binaryPath);
  const urlFilename = path.basename(new URL(url).pathname);
  const extractedName = urlFilename.replace(/\.tar\.gz$/, "");
  const archivePath = path.join(tempDir, `ffmpeg_${arch}.tar.gz`);
  const extractPath = path.join(tempDir, "extract");

  await ensureDir(getBinDir(), logger);

  if (await pathExists(binaryPath)) {
    const existing = await fs.stat(binaryPath);

    if (existing.isDirectory()) {
      await fs.rm(binaryPath, { recursive: true, force: true });
    }
  }

  await downloadFile(url, archivePath, logger);
  await extractArchive(archivePath, extractPath, logger);

  const extractedBinaryPath =
    (await findFileRecursive(extractPath, extractedName)) ??
    (await findFileRecursive(extractPath, binaryName));

  if (!extractedBinaryPath) {
    throw new Error(`Could not find FFmpeg in archive: ${archivePath}`);
  }

  await fs.rename(extractedBinaryPath, binaryPath);

  if (process.platform !== "win32") {
    await fs.chmod(binaryPath, 0o755);
  }

  logger.log(`FFmpeg downloaded successfully to ${binaryPath}`);
};

let inFlightDownload: Promise<void> | null = null;

const runDownload = async (logger: TDownloadLogger): Promise<void> => {
  const tempDir = path.join(getDownloadDir(), "ffmpeg");

  await fs.rm(tempDir, { recursive: true, force: true });
  await ensureDir(tempDir, logger);

  try {
    await downloadFfmpegArchive(tempDir, logger);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
};

const downloadFfmpeg = (logger: TDownloadLogger): Promise<void> => {
  if (inFlightDownload) return inFlightDownload;

  inFlightDownload = runDownload(logger).finally(() => {
    inFlightDownload = null;
  });

  return inFlightDownload;
};

const isFfmpegDownloading = (): boolean => inFlightDownload !== null;

const isFfmpegPresent = async (): Promise<boolean> => {
  const binaryPath = getFfmpegBinaryPath();

  if (!(await pathExists(binaryPath))) return false;

  return (await fs.stat(binaryPath)).isFile();
};

const ensureFfmpeg = async (logger: TDownloadLogger): Promise<void> => {
  if (await isFfmpegPresent()) {
    logger.log(`Using existing FFmpeg binary at ${getFfmpegBinaryPath()}`);
    return;
  }

  logger.log("FFmpeg is missing, starting download");
  await downloadFfmpeg(logger);
};

export {
  downloadFfmpeg,
  ensureFfmpeg,
  isFfmpegDownloading,
  isFfmpegPresent,
  pathExists,
};
