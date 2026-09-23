import {
  Permission,
  PluginSlot,
  type PluginContext,
  type UnloadPluginContext,
} from "@sharkord/plugin-sdk";
import type {
  PlayerActionResponse,
  TSharkord,
  TuneBoxTrack,
} from "../contract";
import {
  downloadFfmpeg,
  ensureFfmpeg,
  isFfmpegDownloading,
  isFfmpegPresent,
} from "./downloads";
import { killMusicStream, spawnMusicStream } from "./ffmpeg";
import { setDataDir } from "./paths";
import {
  clearAllChannelStates,
  enqueueTrack,
  formatTrackLabel,
  getChannelIds,
  getExistingState,
  getPlayerStateSnapshot,
  getState,
  removeQueueItem,
  takeNextFromQueue,
  type TPlayableTrack,
} from "./player-state";
import { getTuneBoxPreviewUrl, searchTuneBox } from "./tune-box";

type TMusicContext = PluginContext<TSharkord>;

type TCleanupContext = Pick<TMusicContext, "logger"> &
  Partial<Pick<TMusicContext, "push">>;

type PlaybackSettings = {
  bitrate: string;
};

let ffmpegReady = false;
let ffmpegInitError: Error | null = null;

const publishPlayerState = (ctx: TCleanupContext, channelId: number): void => {
  ctx.push?.toAll({ channelId, player: getPlayerStateSnapshot(channelId) });
};

const cleanupChannel = (ctx: TCleanupContext, channelId: number): void => {
  const state = getExistingState(channelId);

  if (!state) return;

  killMusicStream(state.ffmpegProcess);

  state.ffmpegProcess = null;

  if (state.producerCloseHandler && state.audioProducer) {
    state.audioProducer.observer.off("close", state.producerCloseHandler);
  }

  if (state.routerCloseHandler && state.router) {
    state.router.off("@close", state.routerCloseHandler);
  }

  try {
    state.streamHandle?.remove();
  } catch {}

  try {
    state.audioProducer?.close();
  } catch {}

  try {
    state.audioTransport?.close();
  } catch {}

  state.streamHandle = null;
  state.audioProducer = null;
  state.audioTransport = null;
  state.router = null;
  state.routerCloseHandler = null;
  state.producerCloseHandler = null;
  state.streamActive = false;
  state.streamStarting = false;
  state.currentSong = null;
  state.currentArtists = [];
  state.currentInvokerUserId = null;
  state.currentThumbnailUrl = null;
  state.playbackStartedAtEpochMs = null;
  state.currentTrackDurationSeconds = null;

  publishPlayerState(ctx, channelId);
};

const startFfmpegBootstrap = (ctx: TMusicContext): void => {
  ffmpegReady = false;
  ffmpegInitError = null;

  ensureFfmpeg(ctx.logger)
    .then(() => {
      ffmpegReady = true;
      ctx.logger.log("FFmpeg is ready");
    })
    .catch((err: unknown) => {
      ffmpegInitError = err instanceof Error ? err : new Error(String(err));
      ctx.logger.error("Failed to prepare FFmpeg", err);
    });
};

const assertFfmpegReady = async (): Promise<void> => {
  if (ffmpegInitError) {
    throw new Error(`Failed to prepare FFmpeg: ${ffmpegInitError.message}`);
  }

  if (ffmpegReady || (await isFfmpegPresent())) {
    ffmpegReady = true;
    return;
  }

  throw new Error("FFmpeg is still downloading. Try again in a moment.");
};

const requireVoiceChannelId = (
  channelId: number | null | undefined,
  errorMessage: string,
): number => {
  if (!channelId) {
    throw new Error(errorMessage);
  }

  return channelId;
};


const buildActionResult = (
  ctx: TMusicContext,
  message: string,
  channelId: number,
): PlayerActionResponse => {
  publishPlayerState(ctx, channelId);

  return { message, player: getPlayerStateSnapshot(channelId) };
};

const startMusicStream = async (
  ctx: TMusicContext,
  channelId: number,
  track: TPlayableTrack,
  options: PlaybackSettings,
  invokerUserId: number,
): Promise<string> => {
  const state = getState(channelId);

  if (state.streamActive) {
    throw new Error("Music is already playing in this channel.");
  }

  if (state.streamStarting) {
    throw new Error("Music is already starting. Please wait.");
  }

  state.streamStarting = true;
  const streamGeneration = ++state.streamGeneration;

  try {
    const router = ctx.voice.getRouter(channelId);
    const { announcedAddress, ip } = ctx.voice.getListenInfo();

    state.router = router;

    state.routerCloseHandler = () => {
      ctx.logger.log("Router closed, cleaning up channel", channelId);
      cleanupChannel(ctx, channelId);
    };

    router.on("@close", state.routerCloseHandler);

    const audioSsrc = Math.floor(Math.random() * 1e9);

    state.audioTransport = await router.createPlainTransport({
      listenIp: {
        ip,
        announcedIp: announcedAddress,
      },
      rtcpMux: true,
      comedia: true,
      enableSrtp: false,
    });

    state.audioProducer = await state.audioTransport.produce({
      kind: "audio",
      rtpParameters: {
        codecs: [
          {
            mimeType: "audio/opus",
            payloadType: 111,
            clockRate: 48000,
            channels: 2,
            parameters: {},
            rtcpFeedback: [],
          },
        ],
        encodings: [{ ssrc: audioSsrc }],
      },
    });

    ctx.logger.log("Final source URL:", track.sourceUrl);

    const result = await spawnMusicStream({
      sourceUrl: track.sourceUrl,
      audioPayloadType: 111,
      audioSsrc,
      rtpHost: ip,
      audioRtpPort: state.audioTransport.tuple.localPort,
      bitrate: options.bitrate,
      log: ctx.logger.log,
      error: ctx.logger.error,
      debug: ctx.logger.debug,
      onDuration: (durationSeconds) => {
        if (
          state.streamGeneration !== streamGeneration ||
          (!state.streamStarting && !state.streamActive)
        ) {
          return;
        }

        state.currentTrackDurationSeconds = durationSeconds;
        publishPlayerState(ctx, channelId);
      },
      onEnd: () => {
        ctx.logger.log("Music ended in channel", channelId);

        const queueHasItems = state.queue.length > 0;
        const shouldStartNext =
          state.endAction === "next" ||
          (state.endAction !== "stop" && queueHasItems);

        state.endAction = "none";
        cleanupChannel(ctx, channelId);

        if (shouldStartNext) {
          playNextInQueue(ctx, channelId, options).catch((err: unknown) =>
            ctx.logger.error("Failed to start the next track", err),
          );
        }
      },
    });

    const title = track.title?.trim() || result.title;
    const artists = track.artists ?? [];
    const displayTitle = artists.length > 0 ? `${title} — ${artists.join(" / ")}` : title;
    const thumbnailUrl = track.coverUrl || undefined;
    const durationSeconds = track.durationSeconds ?? undefined;

    state.streamHandle = ctx.voice.createStream({
      key: "music",
      channelId,
      title: displayTitle,
      avatarUrl: "https://i.imgur.com/uVBNUK9.png",
      bannerUrl: thumbnailUrl,
      producers: {
        audio: state.audioProducer,
      },
    });

    state.producerCloseHandler = () => cleanupChannel(ctx, channelId);

    state.audioProducer.observer.on("close", state.producerCloseHandler);

    state.ffmpegProcess = result.process;
    state.currentSong = title;
    state.currentArtists = artists;
    state.currentInvokerUserId = invokerUserId;
    state.currentThumbnailUrl = thumbnailUrl ?? null;
    state.playbackStartedAtEpochMs = Date.now();
    state.currentTrackDurationSeconds =
      durationSeconds ?? state.currentTrackDurationSeconds;
    state.streamActive = true;
    state.endAction = "none";

    publishPlayerState(ctx, channelId);

    return `Now playing: ${displayTitle}`;
  } catch (err) {
    cleanupChannel(ctx, channelId);
    throw err;
  } finally {
    state.streamStarting = false;
  }
};

const playNextInQueue = async (
  ctx: TMusicContext,
  channelId: number,
  options: PlaybackSettings,
): Promise<string> => {
  const nextItem = takeNextFromQueue(channelId);

  if (!nextItem) {
    publishPlayerState(ctx, channelId);

    return "Queue is empty.";
  }

  return startMusicStream(
    ctx,
    channelId,
    nextItem.track,
    options,
    nextItem.invokerUserId,
  );
};

const onLoad = async (ctx: TMusicContext) => {
  setDataDir(ctx.dataPath);
  startFfmpegBootstrap(ctx);

  ctx.logger.log("Music Bot loaded");

  // the panel is only useful to someone who can be in a voice channel; owners
  // narrow this further per role in the plugin's permissions
  ctx.ui.enable({ [PluginSlot.TOPBAR_RIGHT]: Permission.JOIN_VOICE_CHANNELS });

  const settings = await ctx.settings.register([
    {
      key: "bitrate",
      name: "Bitrate",
      description: "The bitrate for the music stream",
      type: "string",
      defaultValue: "128k",
    },

    {
      key: "tuneBoxBaseUrl",
      name: "Tune Box Base URL",
      description: "Tune Box server URL, for example http://tune-box:8080",
      type: "string",
      defaultValue: "http://localhost:8080",
    },
  ] as const);

  const getPlaybackSettings = (): PlaybackSettings => ({
    bitrate: settings.get("bitrate"),
  });

  ctx.events.on("voice:runtime_closed", ({ channelId }) => {
    const state = getExistingState(channelId);

    if (state) {
      state.endAction = "stop";
    }

    cleanupChannel(ctx, channelId);
  });

  ctx.actions.register({
    name: "getPlayerState",
    description: "Reads what is playing in the caller's voice channel",
    executes: async (invoker) =>
      getPlayerStateSnapshot(invoker.currentVoiceChannelId),
  });

  ctx.actions.register({
    name: "searchTuneBox",
    description: "Searches music through the configured Tune Box server",
    requires: Permission.JOIN_VOICE_CHANNELS,
    executes: async (_invoker, payload) => {
      const query = payload.query.trim();
      const provider = payload.provider;

      if (!query) {
        throw new Error("Enter a song or artist to search for.");
      }

      if (provider !== "netease" && provider !== "kuwo") {
        throw new Error("Unsupported Tune Box music provider.");
      }

      return searchTuneBox(
        settings.get("tuneBoxBaseUrl"),
        provider,
        query,
        payload.page,
      );
    },
  });

  ctx.actions.register({
    name: "playTuneBoxTrack",
    description: "Plays or queues a Tune Box search result",
    requires: Permission.JOIN_VOICE_CHANNELS,
    executes: async (invoker, payload) => {
      await assertFfmpegReady();

      const channelId = requireVoiceChannelId(
        invoker.currentVoiceChannelId,
        "You must be in a voice channel to play music.",
      );
      const track: TuneBoxTrack = payload.track;

      if (
        !track ||
        typeof track.id !== "string" ||
        typeof track.provider !== "string" ||
        typeof track.title !== "string" ||
        !track.id.trim() ||
        !track.provider.trim() ||
        !track.title.trim() ||
        track.id.length > 128 ||
        track.provider.length > 64 ||
        track.title.length > 256
      ) {
        throw new Error("The selected Tune Box track is invalid.");
      }

      const artists = Array.isArray(track.artists) ? track.artists : [];
      const playableTrack: TPlayableTrack = {
        sourceUrl: getTuneBoxPreviewUrl(settings.get("tuneBoxBaseUrl"), track),
        title: track.title.trim(),
        artists: artists
          .filter(
            (artist): artist is string =>
              typeof artist === "string" && artist.trim().length > 0,
          )
          .slice(0, 10)
          .map((artist) => artist.trim().slice(0, 128)),
        album: track.album,
        coverUrl: track.coverUrl,
        durationSeconds: track.durationSeconds,
      };
      const state = getState(channelId);

      if (state.streamActive || state.streamStarting) {
        const position = enqueueTrack(channelId, playableTrack, invoker.userId);

        return buildActionResult(
          ctx,
          `Added to queue (#${position}): ${formatTrackLabel(playableTrack)}`,
          channelId,
        );
      }

      const message = await startMusicStream(
        ctx,
        channelId,
        playableTrack,
        getPlaybackSettings(),
        invoker.userId,
      );

      return buildActionResult(ctx, message, channelId);
    },
  });


  ctx.actions.register({
    name: "removeQueueItem",
    description: "Removes one track from the queue",
    requires: Permission.JOIN_VOICE_CHANNELS,
    executes: async (invoker, payload) => {
      const channelId = requireVoiceChannelId(
        invoker.currentVoiceChannelId,
        "You must be in a voice channel to edit the queue.",
      );
      const removedItem = removeQueueItem(channelId, payload.position);

      if (!removedItem) {
        throw new Error("Queue item not found.");
      }

      return buildActionResult(
        ctx,
        `Removed from queue: ${formatTrackLabel(removedItem.track)}`,
        channelId,
      );
    },
  });

  ctx.actions.register({
    name: "nextMusic",
    description: "Skips to the next queued track",
    requires: Permission.JOIN_VOICE_CHANNELS,
    executes: async (invoker) => {
      await assertFfmpegReady();

      const channelId = requireVoiceChannelId(
        invoker.currentVoiceChannelId,
        "You must be in a voice channel to skip music.",
      );
      const state = getState(channelId);

      if (state.streamStarting) {
        throw new Error("Music is still starting. Try again in a moment.");
      }

      if (!state.streamActive) {
        const message = await playNextInQueue(
          ctx,
          channelId,
          getPlaybackSettings(),
        );

        return buildActionResult(ctx, message, channelId);
      }

      // the ffmpeg exit handler picks the next track up
      state.endAction = "next";
      cleanupChannel(ctx, channelId);

      return buildActionResult(ctx, "Skipping current track...", channelId);
    },
  });

  ctx.actions.register({
    name: "jumpToQueueItem",
    description: "Plays a queued track right away",
    requires: Permission.JOIN_VOICE_CHANNELS,
    executes: async (invoker, payload) => {
      await assertFfmpegReady();

      const channelId = requireVoiceChannelId(
        invoker.currentVoiceChannelId,
        "You must be in a voice channel to control the queue.",
      );
      const state = getState(channelId);
      const selectedItem = removeQueueItem(channelId, payload.position);

      if (!selectedItem) {
        throw new Error("Queue item not found.");
      }

      if (!state.streamActive) {
        const message = await startMusicStream(
          ctx,
          channelId,
          selectedItem.track,
          getPlaybackSettings(),
          selectedItem.invokerUserId,
        );

        return buildActionResult(ctx, message, channelId);
      }

      state.queue.unshift(selectedItem);
      state.endAction = "next";
      cleanupChannel(ctx, channelId);

      return buildActionResult(
        ctx,
        `Jumping to: ${formatTrackLabel(selectedItem.track)}`,
        channelId,
      );
    },
  });

  ctx.actions.register({
    name: "stopMusic",
    description: "Stops playback and clears the channel's playback state",
    requires: Permission.JOIN_VOICE_CHANNELS,
    executes: async (invoker) => {
      const channelId = requireVoiceChannelId(
        invoker.currentVoiceChannelId,
        "You must be in a voice channel to stop music.",
      );
      const state = getExistingState(channelId);

      if (state) {
        state.endAction = "stop";
      }

      // unconditional, so a half started stream is recoverable too
      cleanupChannel(ctx, channelId);

      return buildActionResult(ctx, "Stopped music.", channelId);
    },
  });

  ctx.commands.register({
    name: "update-ffmpeg",
    description: "Downloads the latest FFmpeg build",
    requires: Permission.MANAGE_PLUGINS,
    executes: async () => {
      if (isFfmpegDownloading()) {
        return "FFmpeg is already downloading. Follow it in the plugin logs.";
      }

      downloadFfmpeg(ctx.logger)
        .then(async () => {
          ctx.logger.log("Updated FFmpeg to the latest build");
          ffmpegInitError = null;
          ffmpegReady = await isFfmpegPresent();
        })
        .catch((err: unknown) =>
          ctx.logger.error("Failed to update FFmpeg", err),
        );

      return "Downloading the latest FFmpeg. Follow it in the plugin logs.";
    },
  });
};

const onUnload = (ctx: UnloadPluginContext) => {
  for (const channelId of getChannelIds()) {
    const state = getExistingState(channelId);

    if (state) {
      state.endAction = "stop";
    }

    cleanupChannel(ctx, channelId);
  }

  clearAllChannelStates();

  ctx.logger.log("Music Bot unloaded");
};

export { onLoad, onUnload };
