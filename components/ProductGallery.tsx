"use client";

import Image from "next/image";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type GalleryImage = {
  id: string;
  image_url: string;
};

type MediaItem =
  | {
      id: string;
      type: "image";
      url: string;
    }
  | {
      id: string;
      type: "video";
      url: string;
    };

export default function ProductGallery({
  productName,
  primaryImage,
  additionalImages,
  videoUrl,
}: {
  productName: string;
  primaryImage: string;
  additionalImages: GalleryImage[];
  videoUrl?: string | null;
}) {
  const media = useMemo<MediaItem[]>(() => {
    const result: MediaItem[] = [
      {
        id: "primary",
        type: "image",
        url: primaryImage,
      },
    ];

    for (const image of additionalImages.slice(0, 5)) {
      const url = image.image_url?.trim();

      if (
        url &&
        !result.some(
          (item) =>
            item.type === "image" &&
            item.url === url
        )
      ) {
        result.push({
          id: image.id,
          type: "image",
          url,
        });
      }
    }

    const cleanVideo = videoUrl?.trim();

    if (cleanVideo) {
      result.push({
        id: "video",
        type: "video",
        url: cleanVideo,
      });
    }

    return result;
  }, [primaryImage, additionalImages, videoUrl]);

  const [activeId, setActiveId] =
    useState("primary");

  const [isPlaying, setIsPlaying] =
    useState(false);

  const [isMuted, setIsMuted] =
    useState(false);

  const [showControls, setShowControls] =
    useState(false);

  const videoRef =
    useRef<HTMLVideoElement | null>(null);

  const hideTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  const active =
    media.find((item) => item.id === activeId) ??
    media[0];

  function clearHideTimer() {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }

  function scheduleControlsHide() {
    clearHideTimer();

    hideTimerRef.current = setTimeout(() => {
      if (videoRef.current?.paused === false) {
        setShowControls(false);
      }
    }, 1000);
  }

  function revealControls() {
    setShowControls(true);

    if (videoRef.current?.paused === false) {
      scheduleControlsHide();
    }
  }

  function selectMedia(item: MediaItem) {
    clearHideTimer();

    setActiveId(item.id);

    if (item.type === "video") {
      setShowControls(true);
      setIsPlaying(false);
      setIsMuted(false);
    } else {
      setShowControls(false);
      setIsPlaying(false);
    }
  }

  async function togglePlayback() {
    const video = videoRef.current;

    if (!video) return;

    clearHideTimer();

    if (video.paused) {
      try {
        video.muted = isMuted;

        await video.play();

        setIsPlaying(true);
        setShowControls(true);

        scheduleControlsHide();
      } catch (error) {
        console.warn(
          "Video playback was blocked:",
          error
        );

        setIsPlaying(false);
        setShowControls(true);
      }
    } else {
      video.pause();

      setIsPlaying(false);
      setShowControls(true);
    }
  }

  function toggleMute(
    event: React.MouseEvent<HTMLButtonElement>
  ) {
    event.stopPropagation();

    const video = videoRef.current;

    if (!video) return;

    const nextMuted = !video.muted;

    video.muted = nextMuted;

    setIsMuted(nextMuted);
    setShowControls(true);

    if (!video.paused) {
      scheduleControlsHide();
    }
  }

  function handleVideoClick() {
    revealControls();
  }

  useEffect(() => {
    if (active.type !== "video") {
      return;
    }

    const currentVideo = videoRef.current;

    if (!currentVideo) {
      return;
    }

    const video: HTMLVideoElement =
      currentVideo;

    let cancelled = false;

    async function startVideo() {
      try {
        /*
         * Start with sound ON.
         */
        video.muted = false;
        setIsMuted(false);

        await video.play();

        if (cancelled) return;

        setIsPlaying(true);
        setShowControls(true);

        scheduleControlsHide();
      } catch (error) {
        if (cancelled) return;

        /*
         * Browser may block audible autoplay.
         * In that case the play button stays visible.
         */
        console.warn(
          "Audible autoplay was blocked:",
          error
        );

        setIsPlaying(false);
        setShowControls(true);
      }
    }

    startVideo();

    return () => {
      cancelled = true;
      clearHideTimer();
    };
  }, [active.id, active.type]);

  useEffect(() => {
    return () => {
      clearHideTimer();
    };
  }, []);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 680,
      }}
    >
      {/* MAIN PRODUCT MEDIA */}

      <div
        className="product-visual"
        style={{
          position: "relative",
          width: "100%",
          minHeight: 0,
          height: "auto",
          aspectRatio: "4 / 5",
          maxHeight: 650,

          padding:
            active.type === "video"
              ? 0
              : undefined,

          background:
            active.type === "video"
              ? "transparent"
              : undefined,

          overflow: "hidden",
        }}
      >
        {active.type === "video" ? (
          <>
            <video
              ref={videoRef}
              key={active.url}
              src={active.url}
              loop
              playsInline
              preload="auto"
              disablePictureInPicture
              aria-label={`${productName} product video`}
              onClick={handleVideoClick}
              onPlay={() => {
                setIsPlaying(true);
              }}
              onPause={() => {
                clearHideTimer();
                setIsPlaying(false);
                setShowControls(true);
              }}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                display: "block",
                objectFit: "cover",
                border: 0,
                outline: 0,
                margin: 0,
                padding: 0,
                background: "transparent",
                cursor: "pointer",
              }}
            />

            {/* CENTER PLAY / PAUSE */}

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                togglePlayback();
              }}
              aria-label={
                isPlaying
                  ? "Pause video"
                  : "Play video"
              }
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",

                width: 72,
                height: 72,

                transform:
                  showControls || !isPlaying
                    ? "translate(-50%, -50%) scale(1)"
                    : "translate(-50%, -50%) scale(0.92)",

                display: "flex",
                alignItems: "center",
                justifyContent: "center",

                padding: 0,

                border:
                  "1px solid rgba(255,255,255,0.45)",

                borderRadius: "50%",

                background:
                  "rgba(22,18,15,0.48)",

                color: "#ffffff",

                cursor: "pointer",

                opacity:
                  showControls || !isPlaying
                    ? 1
                    : 0,

                pointerEvents:
                  showControls || !isPlaying
                    ? "auto"
                    : "none",

                transition:
                  "opacity 220ms ease, transform 220ms ease",

                zIndex: 5,
              }}
            >
              {isPlaying ? (
                /*
                 * Proper pause icon
                 */
                <svg
                  width="24"
                  height="28"
                  viewBox="0 0 24 28"
                  fill="none"
                  aria-hidden="true"
                >
                  <rect
                    x="3"
                    y="2"
                    width="6"
                    height="24"
                    rx="2"
                    fill="currentColor"
                  />

                  <rect
                    x="15"
                    y="2"
                    width="6"
                    height="24"
                    rx="2"
                    fill="currentColor"
                  />
                </svg>
              ) : (
                /*
                 * Proper play icon
                 */
                <svg
                  width="27"
                  height="30"
                  viewBox="0 0 27 30"
                  fill="none"
                  aria-hidden="true"
                  style={{
                    marginLeft: 4,
                  }}
                >
                  <path
                    d="M25 12.268C27.6667 13.8076 27.6667 17.6566 25 19.1962L6.25 30.0215C3.58333 31.5611 0.25 29.6366 0.25 26.5574V4.9068C0.25 1.8276 3.58333 -0.0969 6.25 1.4427L25 12.268Z"
                    fill="currentColor"
                  />
                </svg>
              )}
            </button>

            {/* BOTTOM-RIGHT SOUND BUTTON */}

            <button
              type="button"
              onClick={toggleMute}
              aria-label={
                isMuted
                  ? "Unmute video"
                  : "Mute video"
              }
              style={{
                position: "absolute",
                right: 14,
                bottom: 14,

                width: 44,
                height: 44,

                display: "flex",
                alignItems: "center",
                justifyContent: "center",

                padding: 0,

                border:
                  "1px solid rgba(255,255,255,0.65)",

                borderRadius: "50%",

                background:
                  "rgba(22,18,15,0.55)",

                color: "#ffffff",

                cursor: "pointer",

                opacity:
                  showControls || !isPlaying
                    ? 1
                    : 0,

                pointerEvents:
                  showControls || !isPlaying
                    ? "auto"
                    : "none",

                transition:
                  "opacity 220ms ease",

                zIndex: 5,
              }}
            >
              {isMuted ? (
                /*
                 * Muted speaker
                 */
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M4 9V15H8L13 19V5L8 9H4Z"
                    fill="currentColor"
                  />

                  <path
                    d="M17 9L22 14"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />

                  <path
                    d="M22 9L17 14"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                /*
                 * Sound ON speaker
                 */
                <svg
                  width="23"
                  height="23"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M4 9V15H8L13 19V5L8 9H4Z"
                    fill="currentColor"
                  />

                  <path
                    d="M16 9.5C17.3333 10.8333 17.3333 13.1667 16 14.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />

                  <path
                    d="M18.5 7C21.1667 9.66667 21.1667 14.3333 18.5 17"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
          </>
        ) : (
          <Image
            src={active.url}
            alt={productName}
            fill
            sizes="(max-width: 900px) 100vw, 50vw"
            className="product-image"
            priority={active.id === "primary"}
          />
        )}
      </div>

      {/* THUMBNAILS */}

      {media.length > 1 && (
        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 12,
            flexWrap: "wrap",
          }}
        >
          {media.map((item, index) => {
            const activeThumb =
              item.id === activeId;

            return (
              <button
                key={item.id}
                type="button"
                aria-label={
                  item.type === "video"
                    ? `Play ${productName} video`
                    : `View ${productName} image ${
                        index + 1
                      }`
                }
                onMouseEnter={() => {
                  /*
                   * Images can still switch on hover.
                   * Video only starts when clicked.
                   */
                  if (item.type !== "video") {
                    selectMedia(item);
                  }
                }}
                onFocus={() => {
                  if (item.type !== "video") {
                    selectMedia(item);
                  }
                }}
                onClick={() => selectMedia(item)}
                style={{
                  position: "relative",

                  width: 82,
                  height: 82,

                  flex: "0 0 82px",

                  padding: 0,

                  border: activeThumb
                    ? "1px solid var(--ink)"
                    : "1px solid var(--line)",

                  background: "var(--paper)",

                  cursor: "pointer",
                  overflow: "hidden",
                }}
              >
                {item.type === "video" ? (
                  <>
                    <video
                      src={item.url}
                      muted
                      playsInline
                      preload="metadata"
                      style={{
                        position: "absolute",
                        inset: 0,

                        width: "100%",
                        height: "100%",

                        display: "block",
                        objectFit: "cover",

                        border: 0,
                      }}
                    />

                    <span
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        inset: 0,

                        display: "grid",
                        placeItems: "center",

                        background:
                          "rgba(255,255,255,0.16)",
                      }}
                    >
                      <span
                        style={{
                          width: 34,
                          height: 34,

                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",

                          borderRadius: "50%",

                          background:
                            "rgba(22,18,15,0.48)",

                          color: "#ffffff",
                        }}
                      >
                        <svg
                          width="13"
                          height="15"
                          viewBox="0 0 27 30"
                          fill="none"
                          aria-hidden="true"
                          style={{
                            marginLeft: 2,
                          }}
                        >
                          <path
                            d="M25 12.268C27.6667 13.8076 27.6667 17.6566 25 19.1962L6.25 30.0215C3.58333 31.5611 0.25 29.6366 0.25 26.5574V4.9068C0.25 1.8276 3.58333 -0.0969 6.25 1.4427L25 12.268Z"
                            fill="currentColor"
                          />
                        </svg>
                      </span>
                    </span>
                  </>
                ) : (
                  <Image
                    src={item.url}
                    alt=""
                    fill
                    sizes="82px"
                    style={{
                      objectFit: "cover",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}