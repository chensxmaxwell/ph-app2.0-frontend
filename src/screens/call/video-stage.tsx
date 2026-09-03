import React, { ReactNode, useState } from "react";
import {
  Image,
  LayoutChangeEvent,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { AvatarPreview } from "../avatar/engine/AvatarPreview";
import type { CompanionFace } from "../avatar/face";
import { s } from "../avatar/scale";
import { CameraPreview } from "./camera-preview";

type VideoStageProps = {
  // This person's one face (`companionFace`): the crafted 3D look fills the
  // stage through the avatar engine, otherwise their portrait does.
  face: CompanionFace;
  speaking: boolean;
  // Status and captions, laid out beside the camera picture-in-picture.
  children?: ReactNode;
};

// The 3D avatar is a WKWebView the engine host floats over the whole app at
// the stage's measured rect, so nothing in this tree may sit inside that
// rect: the camera PiP lives in a row above the stage, not on top of it.
export const VideoStage = ({ face, speaking, children }: VideoStageProps) => {
  const window = useWindowDimensions();
  const [size, setSize] = useState(() => {
    const width = Math.max(1, window.width - s(32));
    return { width, height: Math.max(1, Math.round(width * 1.15)) };
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
          <AvatarPreview
            look={face.look}
            width={size.width}
            height={size.height}
            viewMode="bust"
          />
        ) : (
          <Image
            source={face.source}
            resizeMode="cover"
            style={StyleSheet.absoluteFillObject}
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
});
