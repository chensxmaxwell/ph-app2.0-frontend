import React, { useEffect, useMemo, useRef, useState } from "react";
import { NativeModules, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { AvatarLook } from "./viewer-html";
import { bundledAvatarViewerUrl } from "../../../native/ph-native";

export const avatarViewerUri = (generation = 0) => {
  const bundled = bundledAvatarViewerUrl();
  if (bundled) {
    return bundled;
  }
  const scriptURL = NativeModules.SourceCode?.scriptURL || "";
  const match = String(scriptURL).match(/^(https?):\/\/([^/:]+)(?::(\d+))?/);
  if (!match) {
    return null;
  }
  const protocol = match[1];
  const host = match[2];
  const metroPort = match[3] || "8081";
  const retry = generation > 0 ? `&r=${generation}` : "";
  return `${protocol}://${host}:${metroPort}/ph-avatar/viewer.html?v=bozo30${retry}`;
};

export type AvatarViewMode = "full" | "bust";

export type AvatarSlotRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AvatarEngineStatus = "loading" | "ready" | "error";

export type AvatarSlotRecord = {
  rect: AvatarSlotRect;
  look: AvatarLook;
  viewMode: AvatarViewMode;
  revealBody: boolean;
};

type EngineSnapshot = {
  slot: AvatarSlotRecord | null;
  status: AvatarEngineStatus;
  errorMessage: string;
  generation: number;
  viewerUri: string | null;
};

type EngineStore = {
  slots: Map<number, AvatarSlotRecord>;
  order: number[];
  status: AvatarEngineStatus;
  errorMessage: string;
  generation: number;
  listeners: Set<() => void>;
};

const store: EngineStore = {
  slots: new Map(),
  order: [],
  status: "loading",
  errorMessage: "",
  generation: 0,
  listeners: new Set(),
};

let nextSlotId = 1;

export const allocAvatarSlotId = () => {
  const id = nextSlotId;
  nextSlotId += 1;
  return id;
};

const topSlot = (): AvatarSlotRecord | null => {
  for (let i = store.order.length - 1; i >= 0; i -= 1) {
    const found = store.slots.get(store.order[i]);
    if (found) {
      return found;
    }
  }
  return null;
};

const snapshot = (): EngineSnapshot => ({
  slot: topSlot(),
  status: store.status,
  errorMessage: store.errorMessage,
  generation: store.generation,
  viewerUri: avatarViewerUri(store.generation),
});

const notify = () => {
  store.listeners.forEach((listener) => listener());
};

const sameRect = (a: AvatarSlotRect, b: AvatarSlotRect) =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

const sameLook = (a: AvatarLook, b: AvatarLook) =>
  a.appearanceIndex === b.appearanceIndex &&
  a.hairStyle === b.hairStyle &&
  a.hairColor === b.hairColor &&
  a.skinTone === b.skinTone &&
  a.eyeColor === b.eyeColor &&
  a.upperArms === b.upperArms &&
  a.chest === b.chest &&
  a.forearms === b.forearms &&
  a.backAndHips === b.backAndHips &&
  a.faceWidth === b.faceWidth &&
  a.jaw === b.jaw &&
  a.chin === b.chin &&
  a.eyeSize === b.eyeSize &&
  a.age === b.age;

const sameRecord = (a: AvatarSlotRecord, b: AvatarSlotRecord) =>
  a.viewMode === b.viewMode &&
  a.revealBody === b.revealBody &&
  sameRect(a.rect, b.rect) &&
  sameLook(a.look, b.look);

export const attachAvatarSlot = (id: number, record: AvatarSlotRecord) => {
  const prev = store.slots.get(id);
  const isNew = !store.order.includes(id);
  if (isNew) {
    store.order.push(id);
  }
  store.slots.set(id, record);
  if (!isNew && prev && sameRecord(prev, record)) {
    return;
  }
  notify();
};

export const updateAvatarSlotLook = (
  id: number,
  look: AvatarLook,
  viewMode: AvatarViewMode,
  revealBody: boolean
) => {
  const prev = store.slots.get(id);
  if (!prev) {
    return;
  }
  if (
    prev.viewMode === viewMode &&
    prev.revealBody === revealBody &&
    sameLook(prev.look, look)
  ) {
    return;
  }
  store.slots.set(id, { ...prev, look, viewMode, revealBody });
  notify();
};

export const detachAvatarSlot = (id: number) => {
  if (!store.slots.has(id)) {
    return;
  }
  store.slots.delete(id);
  const index = store.order.indexOf(id);
  if (index >= 0) {
    store.order.splice(index, 1);
  }
  if (!topSlot()) {
    store.status = "loading";
    store.errorMessage = "";
  }
  notify();
};

export const retryAvatarEngine = () => {
  store.errorMessage = "";
  store.status = "loading";
  store.generation += 1;
  notify();
};

const setEngineStatus = (status: AvatarEngineStatus, errorMessage = "") => {
  if (store.status === status && store.errorMessage === errorMessage) {
    return;
  }
  store.status = status;
  store.errorMessage = errorMessage;
  notify();
};

export const useAvatarEngine = () => {
  const [state, setState] = useState(snapshot);
  useEffect(() => {
    const listener = () => setState(snapshot());
    store.listeners.add(listener);
    listener();
    return () => {
      store.listeners.delete(listener);
    };
  }, []);
  return { ...state, retry: retryAvatarEngine };
};

const LOAD_TIMEOUT_MS = 15000;
const metroHint = (uri: string) =>
  `Phone must reach Metro at ${uri.replace(/\/ph-avatar\/.*$/, "")}. Same Wi‑Fi as the Mac running npm start.`;
export const AvatarEngineHost = () => {
  const webRef = useRef<WebView>(null);
  const engine = useAvatarEngine();
  const slot = engine.slot;
  const status = engine.status;
  const generation = engine.generation;
  const viewerUri = engine.viewerUri;
  const payload = slot
    ? JSON.stringify({
        ...slot.look,
        viewMode: slot.viewMode,
        revealBody: slot.revealBody,
      })
    : null;
  const payloadRef = useRef<string | null>(payload);
  payloadRef.current = payload;
  const source = useMemo(
    () => (viewerUri ? { uri: viewerUri } : { uri: "" }),
    [viewerUri]
  );
  const pushLook = () => {
    const next = payloadRef.current;
    if (!next) {
      return;
    }
    const fn = "applyLook";
    webRef.current?.injectJavaScript(
      "window." + fn + " && window." + fn + "(" + next + "); true;"
    );
  };

  useEffect(() => {
    if (status === "ready") {
      pushLook();
    }
  }, [payload, status]);

  useEffect(() => {
    if (!viewerUri || status !== "loading" || !slot) {
      return;
    }
    const timer = setTimeout(() => {
      setEngineStatus(
        "error",
        "Timed out while loading preview.\n" + metroHint(viewerUri)
      );
    }, LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [generation, status, viewerUri, slot]);
  const fail = (raw: string) => {
    const detail = raw.trim() || "Unknown preview error";
    const hint = viewerUri
      ? metroHint(viewerUri)
      : "3D preview is unavailable in this Release build.";
    setEngineStatus("error", detail + "\n" + hint);
  };

  if (!viewerUri || !slot) {
    return null;
  }

  const show = status === "ready";
  const { width, height, x: left, y: top } = slot.rect;

  return (
    <View style={styles.root} pointerEvents="box-none">
      <View
        pointerEvents="none"
        collapsable={false}
        style={[
          styles.frame,
          {
            left,
            top,
            width,
            height,
            opacity: show ? 1 : 0,
          },
        ]}
      >
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
          style={[styles.web, { width, height }]}
          scrollEnabled={false}
          bounces={false}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          androidLayerType="hardware"
          mixedContentMode="always"
          javaScriptEnabled
          mediaPlaybackRequiresUserAction
          mediaCapturePermissionGrantType="deny"
          onLoadEnd={() => {
            if (store.status === "ready") {
              pushLook();
            }
          }}
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
              setEngineStatus("ready");
              pushLook();
              return;
            }
            if (data.indexOf("error:") === 0) {
              fail(data.slice(6));
            }
          }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    elevation: 20,
  },
  frame: {
    position: "absolute",
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  web: {
    flex: 1,
    backgroundColor: "transparent",
  },
});
