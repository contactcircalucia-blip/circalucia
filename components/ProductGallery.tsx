"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

type GalleryImage = {
  id: string;
  image_url: string;
};

type MediaItem =
  | { id: string; type: "image"; url: string }
  | { id: string; type: "video"; url: string };

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
          (item) => item.type === "image" && item.url === url
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

  const [activeId, setActiveId] = useState("primary");

  const active =
    media.find((item) => item.id === activeId) ?? media[0];

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

          // Remove the surrounding frame only for video
          padding: active.type === "video" ? 0 : undefined,
          background:
            active.type === "video"
              ? "transparent"
              : undefined,
          overflow: "hidden",
        }}
      >
        {active.type === "video" ? (
          <video
            key={active.url}
            src={active.url}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            disablePictureInPicture
            aria-label={`${productName} product video`}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              display: "block",

              // Fill the entire media area
              objectFit: "cover",

              border: 0,
              outline: 0,
              margin: 0,
              padding: 0,
              background: "transparent",
            }}
          />
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
            const activeThumb = item.id === activeId;

            return (
              <button
                key={item.id}
                type="button"
                aria-label={
                  item.type === "video"
                    ? `Play ${productName} video`
                    : `View ${productName} image ${index + 1}`
                }
                onMouseEnter={() => setActiveId(item.id)}
                onFocus={() => setActiveId(item.id)}
                onClick={() => setActiveId(item.id)}
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
                        fontSize: 20,
                        background: "rgba(255,255,255,0.20)",
                      }}
                    >
                      ▶
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