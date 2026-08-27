import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  LayoutChangeEvent,
  NativeModules,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { colors } from "@common/styles/colors";
import { AvatarLook } from "./viewer-html";
import { LookFace } from "../look-face";

export const avatarViewerUri = (nonce = 0) => {
  const scriptURL = NativeModules.SourceCode?.scriptURL || "";
  const match = String(scriptURL).match(/^(https?):\/\/([^/:]+)(?::(\d+))?/);
  if (!match) {
    return null;
  }
  const protocol = match[1];
  const host = match[2];
  const metroPort = match[3] || "8081";
  return `${protocol}://${host}:${metroPort}/ph-avatar/viewer.html?v=bozo10&r=${nonce}`;
};

const LOAD_TIMEOUT_MS = 15000;

type LoadStatus = "loading" | "ready" | "error";

type AvatarPreviewProps = {
  look: AvatarLook;
  width: number;
  height: number;
  viewMode?: "full" | "bust";
  revealBody?: boolean;
};

const metroHint = (uri: string) =>
  `Phone must reach Metro at ${uri.replace(/\/ph-avatar\/.*$/, "")}. Same Wi‑Fi as the Mac running npm start.`;

export const AvatarPreview = ({
  look,
  width,
  height,
  viewMode = "full",
  revealBody = false,
}: AvatarPreviewProps) => {
  const webRef = useRef<WebView>(null);
  const [nonce, setNonce] = useState(0);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const viewerUri = useMemo(() => avatarViewerUri(nonce), [nonce]);
  const payload = JSON.stringify({ ...look, viewMode, revealBody });

  const fail = (raw: string) => {
    const detail = raw.trim() || "Unknown preview error";
    setStatus("error");
    setErrorMessage(`${detail}\n${viewerUri ? metroHint(viewerUri) : "3D preview is unavailable in this Release build."}`);
  };

  const pushLook = () => {
    webRef.current?.injectJavaScript(
      `window.applyLook && window.applyLook(${payload}); true;`
    );
  };

  useEffect(() => {
    if (status === "ready") {
      pushLook();
    }
  }, [payload, status]);

  useEffect(() => {
    if (!viewerUri || status !== "loading") {
      return;
    }
    const timer = setTimeout(() => {
      fail("Timed out while loading the 3D model.");
    }, LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [nonce, status, viewerUri]);

  const retry = () => {
    setErrorMessage("");
    setStatus("loading");
    setNonce((current) => current + 1);
  };

  // Release IPA has no Metro :8081. Bundling viewer.html + 4MB GLB is left
  // for a later pass; show a still portrait so Release does not white-screen.
  if (!viewerUri) {
    return (
      <View style={[styles.wrap, { width, height, alignItems: "center", justifyContent: "center" }]}>
        <LookFace look={look} size={Math.min(width, height)} />
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { width, height }]}>
      <WebView
        key={nonce}
        ref={webRef}
        originWhitelist={["*"]}
        source={{ uri: viewerUri }}
        style={[styles.web, { width, height }]}
        scrollEnabled={false}
        bounces={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        androidLayerType="hardware"
        mixedContentMode="always"
        javaScriptEnabled
        onLoadEnd={() => {
          if (status === "ready") {
            pushLook();
          }
        }}
        onHttpError={(event) => {
          const { statusCode, description } = event.nativeEvent;
          fail(`HTTP ${statusCode}${description ? ` ${description}` : ""}`);
        }}
        onError={(event) => {
          fail(event.nativeEvent.description || "WebView failed to load");
        }}
        onMessage={(event) => {
          const data = event.nativeEvent.data || "";
          if (data === "ready") {
            setStatus("ready");
            pushLook();
            return;
          }
          if (data.startsWith("error:")) {
            fail(data.slice("error:".length));
          }
        }}
      />
      {status === "loading" ? (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator color={colors.white} />
          <Text style={styles.overlayTitle}>Loading 3D model…</Text>
        </View>
      ) : null}
      {status === "error" ? (
        <View style={styles.overlay}>
          <Text style={styles.overlayTitle}>Couldn’t load 3D preview</Text>
          <Text style={styles.overlayBody}>{errorMessage}</Text>
          <TouchableOpacity
            onPress={retry}
            style={styles.retry}
            activeOpacity={0.85}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
};

export const FittedAvatarPreview = ({
  look,
  aspect = 186 / 402,
  viewMode = "full",
  revealBody = false,
}: {
  look: AvatarLook;
  aspect?: number;
  viewMode?: "full" | "bust";
  revealBody?: boolean;
}) => {
  const [size, setSize] = useState({ width: 1, height: 1 });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width < 2 || height < 2) {
      return;
    }
    let nextHeight = height;
    let nextWidth = nextHeight * aspect;
    if (nextWidth > width) {
      nextWidth = width;
      nextHeight = nextWidth / aspect;
    }
    if (
      Math.abs(nextWidth - size.width) > 1 ||
      Math.abs(nextHeight - size.height) > 1
    ) {
      setSize({ width: nextWidth, height: nextHeight });
    }
  };

  return (
    <View style={styles.fit} onLayout={onLayout}>
      {size.width > 2 && size.height > 2 ? (
        <AvatarPreview
          look={look}
          width={size.width}
          height={size.height}
          viewMode={viewMode}
          revealBody={revealBody}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  web: {
    flex: 1,
    backgroundColor: "transparent",
  },
  fit: {
    flex: 1,
    width: "100%",
    minHeight: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(20, 16, 40, 0.72)",
    paddingHorizontal: 16,
    gap: 10,
  },
  overlayTitle: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 15,
    textAlign: "center",
  },
  overlayBody: {
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
  },
  retry: {
    marginTop: 4,
    minWidth: 112,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.grayLightest,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  retryText: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 14,
  },
});
