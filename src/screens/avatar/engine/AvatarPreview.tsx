import React, { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { colors } from "@common/styles/colors";
import { AvatarLook } from "./viewer-html";
import { LookFace } from "../look-face";
import {
  allocAvatarSlotId,
  attachAvatarSlot,
  AvatarViewMode,
  detachAvatarSlot,
  updateAvatarSlotLook,
  useAvatarEngine,
} from "./AvatarEngineHost";

export { avatarViewerUri } from "./AvatarEngineHost";

type AvatarPreviewProps = {
  look: AvatarLook;
  width: number;
  height: number;
  viewMode?: AvatarViewMode;
  revealBody?: boolean;
};

export const AvatarPreview = ({
  look,
  width,
  height,
  viewMode = "full",
  revealBody = false,
}: AvatarPreviewProps) => {
  const viewRef = useRef<View>(null);
  const slotIdRef = useRef<number | null>(null);
  if (slotIdRef.current == null) {
    slotIdRef.current = allocAvatarSlotId();
  }
  const slotId = slotIdRef.current;
  const propsRef = useRef({ look, viewMode, revealBody });
  propsRef.current = { look, viewMode, revealBody };
  const isFocused = useIsFocused();
  const activeRef = useRef(isFocused);
  activeRef.current = isFocused;
  const { status, errorMessage, retry, viewerUri } = useAvatarEngine();

  const publish = () => {
    if (!activeRef.current) {
      return;
    }
    const current = propsRef.current;
    viewRef.current?.measureInWindow((x, y, measuredWidth, measuredHeight) => {
      if (
        !activeRef.current ||
        ![x, y, measuredWidth, measuredHeight].every(Number.isFinite) ||
        measuredWidth < 2 ||
        measuredHeight < 2
      ) {
        return;
      }
      attachAvatarSlot(slotId, {
        rect: {
          x: Math.round(x),
          y: Math.round(y),
          width: Math.round(measuredWidth),
          height: Math.round(measuredHeight),
        },
        look: current.look,
        viewMode: current.viewMode,
        revealBody: current.revealBody,
      });
    });
  };

  useEffect(() => {
    if (!isFocused) {
      detachAvatarSlot(slotId);
      return;
    }
    updateAvatarSlotLook(slotId, look, viewMode, revealBody);
    publish();
  }, [isFocused, look, viewMode, revealBody, width, height, slotId]);

  useEffect(() => {
    const handle = Dimensions.addEventListener("change", publish);
    return () => handle.remove();
  }, [slotId]);

  useEffect(() => {
    return () => {
      activeRef.current = false;
      detachAvatarSlot(slotId);
    };
  }, [slotId]);

  if (!viewerUri) {
    return (
      <View
        style={[
          styles.wrap,
          { width, height, alignItems: "center", justifyContent: "center" },
        ]}
      >
        <LookFace look={look} size={Math.min(width, height)} />
      </View>
    );
  }

  return (
    <View
      ref={viewRef}
      collapsable={false}
      style={[
        styles.wrap,
        { width, height, alignItems: "center", justifyContent: "center" },
      ]}
      onLayout={publish}
    >
      {status !== "ready" && status !== "error" ? (
        <LookFace look={look} size={Math.min(width, height)} />
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
  viewMode?: AvatarViewMode;
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
