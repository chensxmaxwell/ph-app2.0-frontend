import React, { ReactNode, useState } from "react";
import {
  Image,
  LayoutChangeEvent,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { InlineAvatarViewer } from "../avatar/engine/InlineAvatarViewer";
import type { CompanionFace } from "../avatar/face";
import { s } from "../avatar/scale";
import { CameraPreview } from "./camera-preview";

type VideoStageProps = {
  // This person's one face (`companionFace`): the crafted 3D look fills the
  // stage through an in-place viewer, otherwise their portrait does.
  face: CompanionFace;
  speaking: boolean;
  // Status and captions, laid out beside the camera picture-in-picture.
  children?: ReactNode;
};

// The companion fills a rounded stage; the camera PiP and the captions sit in
// a row above it. The 3D look is drawn by `InlineAvatarViewer`, a WebView
// that lives inside the stage box: the app-wide floated engine WebView is
// under a transparentModal (the call screens) and would never be seen here.
export const VideoStage = ({ face, speaking, children }: VideoStageProps) => {
  const window = useWindowDimensions();
  const [size, setSize] = useState(() => {
    const width = Math.max(1, window.width - s(32));
    return { width, height: Math.max(1, Math.round(width * 0.9)) };
  });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width < 2 || height < 2) {
      return;
    }
    if (
      Math.abs(width - size.width) > 1 ||
      Math.abs(height - size.height) > 1
    ) {
      setSize({ width: Math.round(width), height: Math.round(height) });
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.topRow}>
        <View style={styles.side}>{children}</View>
        <CameraPreview />
      </View>
      <View
        testID="call-stage-face"
        onLayout={onLayout}
        style={[styles.stage, speaking && styles.stageSpeaking]}
      >
        {face.look ? (
          <InlineAvatarViewer
            look={face.look}
            viewMode="bust"
            placeholderSize={Math.round(Math.min(size.width, size.height) * 0.6)}
          />
        ) : (
          <Image
            source={face.source}
            resizeMode="cover"
            style={styles.portrait}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: s(16),
    gap: s(12),
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: s(12),
  },
  side: {
    flex: 1,
    justifyContent: "center",
    minHeight: s(128),
  },
  stage: {
    flex: 1,
    minHeight: s(200),
    borderRadius: s(24),
    overflow: "hidden",
    backgroundColor: "rgba(20, 16, 40, 0.45)",
    borderWidth: 2,
    borderColor: "rgba(203, 183, 232, 0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  stageSpeaking: {
    borderColor: "#cbb7e8",
  },
  // RN's Image keeps a require()d asset's own width/height unless the style
  // sets them; absoluteFill alone drew Amanda's 786×676 photo from the
  // stage's top-left corner (TestFlight 1.2 (14)). Percent sizes fill the
  // stage so `cover` centres the face.
  portrait: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
});
