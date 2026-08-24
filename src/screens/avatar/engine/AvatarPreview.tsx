import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  NativeModules,
  StyleSheet,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { AvatarLook } from "./viewer-html";

const avatarViewerUri = () => {
  const scriptURL = NativeModules.SourceCode?.scriptURL || "";
  const match = String(scriptURL).match(/^(https?):\/\/([^/:]+)(?::(\d+))?/);
  const protocol = match?.[1] || "http";
  const host = match?.[2] || "localhost";
  const metroPort = match?.[3] || "8081";
  return `${protocol}://${host}:${metroPort}/ph-avatar/viewer.html?v=bozo9`;
};

type AvatarPreviewProps = {
  look: AvatarLook;
  width: number;
  height: number;
  viewMode?: "full" | "bust";
};

export const AvatarPreview = ({
  look,
  width,
  height,
  viewMode = "full",
}: AvatarPreviewProps) => {
  const webRef = useRef<WebView>(null);
  const viewerUri = useMemo(() => avatarViewerUri(), []);
  const payload = JSON.stringify({ ...look, viewMode });

  const pushLook = () => {
    webRef.current?.injectJavaScript(
      `window.applyLook && window.applyLook(${payload}); true;`
    );
  };

  useEffect(() => {
    pushLook();
  }, [payload]);

  return (
    <View style={[styles.wrap, { width, height }]}>
      <WebView
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
        onLoadEnd={pushLook}
        onHttpError={(event) => {
          console.log("Avatar HTTP error", event.nativeEvent);
        }}
        onError={(event) => {
          console.log("Avatar WebView error", event.nativeEvent);
        }}
        onMessage={(event) => {
          const data = event.nativeEvent.data || "";
          if (data === "ready" || data.startsWith("error:")) {
            console.log("Avatar WebView", data);
            if (data === "ready") {
              pushLook();
            }
          }
        }}
      />
    </View>
  );
};

export const FittedAvatarPreview = ({
  look,
  aspect = 186 / 402,
  viewMode = "full",
}: {
  look: AvatarLook;
  aspect?: number;
  viewMode?: "full" | "bust";
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
});
