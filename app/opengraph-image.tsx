import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "claude-oops — oh no, what did Claude do this time?";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#fef7f0",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          padding: "80px",
          fontFamily: "Georgia, serif",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -100,
            right: -100,
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "radial-gradient(circle, #fed7aa, #fbbf24)",
            opacity: 0.6,
          }}
        />
        <div
          style={{
            fontSize: 32,
            color: "#c2410c",
            fontStyle: "italic",
            marginBottom: 24,
          }}
        >
          claude-oops
        </div>
        <div
          style={{
            fontSize: 88,
            fontStyle: "italic",
            color: "#1a0f08",
            lineHeight: 1,
            letterSpacing: "-0.02em",
            maxWidth: 900,
          }}
        >
          oh no, what did Claude do <span style={{ color: "#c2410c" }}>this time?</span>
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 28,
            color: "#9a5a3a",
            fontFamily: "system-ui",
          }}
        >
          the group chat for when the vibes go off
        </div>
      </div>
    ),
    size,
  );
}
