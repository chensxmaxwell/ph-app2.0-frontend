import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { WebView } from "react-native-webview";
import { colors } from "@common/styles/colors";
import { AvatarLook } from "./viewer-html";
import { LookFace } from "../look-face";
import {
  AvatarEngineStatus,
  AvatarViewMode,
  LOAD_TIMEOUT_MS,
  avatarViewerUri,
  metroHint,
} from "./AvatarEngineHost";

type InlineAvatarViewerProps = {
  look: AvatarLook;
  viewMode?: AvatarViewMode;
  revealBody?: boolean;
  // Size of the vector face shown while the viewer loads (or when there is
  // no viewer URL at all).
  placeholderSize: number;
};

/**
 * The 3D viewer rendered in place, inside whatever box it is given.
 *
 * `AvatarPreview` publishes a rect and lets `AvatarEngineHost` float the one
 * app-wide WebView over the RN root view at that rect. That cannot reach a
 * call: Message and Love calls are `transparentModal` screens, which UIKit
 * presents above the whole RN root view, so a floated WebView is under the
 * call's backdrop. The stage owns this WebView instead; it lives in the
 * stage's clipped, rounded box and attaches nothing to the floating engine.
 * The page has no audio or media, so it never touches AVAudioSession.
 */
export const InlineAvatarViewer = ({
  look,
  viewMode = "bust",
  revealBody = false,
  placeholderSize,
}: InlineAvatarViewerProps) => {
  const webRef = useRef<WebView>(null);
  const [status, setStatus] = useState<AvatarEngineStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [generation, setGeneration] = useState(0);
  const viewerUri = avatarViewerUri(generation);
  const source = useMemo(
    () => (viewerUri ? { uri: viewerUri } : { uri: "" }),
    [viewerUri]
  );
  const payload = JSON.stringify({ ...look, viewMode, revealBody });
  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  const pushLook = () => {
    webRef.current?.injectJavaScript(
      "window.applyLook && window.applyLook(" + payloadRef.current + "); true;"
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
      setStatus("error");
      setErrorMessage(
        "Timed out while loading preview.\n" + metroHint(viewerUri)
      );
    }, LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [generation, status, viewerUri]);

  const fail = (raw: string) => {
    const detail = raw.trim() || "Unknown preview error";
    const hint = viewerUri
      ? metroHint(viewerUri)
      : "3D preview is unavailable in this Release build.";
    setStatus("error");
    setErrorMessage(detail + "\n" + hint);
  };

  const retry = () => {
    setErrorMessage("");
    setStatus("loading");
    setGeneration((current) => current + 1);
  };

  const placeholder = <LookFace look={look} size={placeholderSize} />;

  if (!viewerUri) {
    return <View style={styles.centered}>{placeholder}</View>;
  }

  return (
    <View style={styles.root}>
      <WebView
        key={generation}
        ref={webRef}
        originWhitelist={["*"]}
        source={source}
        allowingReadAccessToURL={
          viewerUri.startsWith("file:")
            ? viewerUri.replace(/\/[^/]*$/, "/")
            : undefined
        }
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        style={[styles.web, status === "ready" ? null : styles.hidden]}
        scrollEnabled={false}
        bounces={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        androidLayerType="hardware"
        mixedContentMode="always"
        javaScriptEnabled
        mediaPlaybackRequiresUserAction
        mediaCapturePermissionGrantType="deny"
        onHttpError={(event) => {
          const { statusCode, description } = event.nativeEvent;
          fail("HTTP " + statusCode + (description ? " " + description : ""));
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
          if (data.indexOf("error:") === 0) {
            fail(data.slice(6));
          }
        }}
      />
      {status === "loading" ? (
        <View style={styles.centered} pointerEvents="none">
          {placeholder}
        </View>
      ) : null}
      {status === "error" ? (
        <View style={styles.overlay}>
          <Text style={styles.overlayTitle}>Couldn’t load 3D preview</Text>
          <Text style={styles.overlayBody}>{errorMessage}</Text>
          <TouchableOpacity
            testID="call-stage-retry"
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

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
  web: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
  hidden: {
    opacity: 0,
  },
  centered: {
    ...StyleSheet.absoluteFillObject,
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
