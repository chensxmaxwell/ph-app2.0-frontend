import React, { ReactNode, useEffect, useState } from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

/**
 * Release builds of React Native turn any uncaught JS error into
 * ExceptionsManager(isFatal) -> RCTFatal -> @throw NSException -> abort.
 * On a TestFlight phone that looks like a silent force-quit and leaves
 * nothing readable behind. This module keeps the process alive, reports the
 * error as non-fatal to the stock handler, and surfaces the message in-app
 * so the tester can read what actually failed.
 */

export type GuardedError = {
  message: string;
  fatal: boolean;
  at: number;
  componentStack?: string;
};

type GlobalErrorHandler = (error: unknown, isFatal?: boolean) => void;

export type ErrorUtilsLike = {
  getGlobalHandler: () => GlobalErrorHandler | null | undefined;
  setGlobalHandler: (handler: GlobalErrorHandler) => void;
};

type GuardListener = (error: GuardedError | null) => void;

const listeners = new Set<GuardListener>();
const guardedUtils = new WeakSet<ErrorUtilsLike>();
let lastError: GuardedError | null = null;

const publish = (next: GuardedError | null) => {
  lastError = next;
  listeners.forEach((listener) => listener(next));
};

export const describeError = (error: unknown): string => {
  if (error instanceof Error) {
    const name = error.name && error.name !== "Error" ? `${error.name}: ` : "";
    return `${name}${error.message || "Unknown error"}`;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error) ?? String(error);
  } catch {
    return String(error);
  }
};

export const lastGuardedError = () => lastError;

export const clearGuardedError = () => publish(null);

export const subscribeGuardedErrors = (listener: GuardListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const defaultErrorUtils = (): ErrorUtilsLike | undefined =>
  (globalThis as unknown as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;

const defaultIsDev = () => typeof __DEV__ !== "undefined" && __DEV__;

/**
 * Install once per process, Release only. Dev keeps the RedBox/LogBox flow.
 * Returns true when the guard was installed by this call.
 */
export const installReleaseCrashGuard = (
  options: { isDev?: boolean; errorUtils?: ErrorUtilsLike } = {}
) => {
  const isDev = options.isDev ?? defaultIsDev();
  const errorUtils = options.errorUtils ?? defaultErrorUtils();
  if (isDev || !errorUtils || guardedUtils.has(errorUtils)) {
    return false;
  }
  const previous = errorUtils.getGlobalHandler?.();
  errorUtils.setGlobalHandler((error, isFatal) => {
    publish({
      message: describeError(error),
      fatal: isFatal === true,
      at: Date.now(),
    });
    try {
      // Non-fatal keeps the stock reporting (console + native soft report)
      // without the RCTFatal abort path.
      previous?.(error, false);
    } catch {
      // Reporting must never be the thing that takes the process down.
    }
  });
  guardedUtils.add(errorUtils);
  return true;
};

type BoundaryProps = {
  children: ReactNode;
  resetLabel?: string;
};

type BoundaryState = {
  error: GuardedError | null;
};

/**
 * Render-phase errors bypass ErrorUtils: without a boundary React unmounts
 * the whole tree and Release then aborts. Catch them, show what failed, and
 * let the tester remount the navigator instead of relaunching the app.
 */
export class CrashGuardBoundary extends React.Component<
  BoundaryProps,
  BoundaryState
> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return {
      error: { message: describeError(error), fatal: true, at: Date.now() },
    };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string }) {
    publish({
      message: describeError(error),
      fatal: true,
      at: Date.now(),
      componentStack: info?.componentStack,
    });
  }

  reset = () => {
    clearGuardedError();
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }
    return (
      <View style={styles.fallback} testID="crash-guard-fallback">
        <Text style={styles.fallbackTitle}>Something went wrong</Text>
        <Text style={styles.fallbackBody} numberOfLines={6}>
          {error.message}
        </Text>
        <TouchableOpacity
          onPress={this.reset}
          style={styles.fallbackButton}
          testID="crash-guard-reset"
        >
          <Text style={styles.fallbackButtonText}>
            {this.props.resetLabel ?? "Back to Home"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }
}

/**
 * Small dismissible strip for errors the guard swallowed outside render
 * (event handlers, timers, native callbacks). Mount once near the root.
 */
export const CrashGuardBanner = () => {
  const [error, setError] = useState<GuardedError | null>(lastGuardedError);

  useEffect(() => subscribeGuardedErrors(setError), []);

  if (!error) {
    return null;
  }

  return (
    <SafeAreaView style={styles.bannerHost} pointerEvents="box-none">
      <View style={styles.banner} testID="crash-guard-banner">
        <Text style={styles.bannerText} numberOfLines={3}>
          {error.message}
        </Text>
        <TouchableOpacity
          onPress={clearGuardedError}
          hitSlop={12}
          testID="crash-guard-dismiss"
        >
          <Text style={styles.bannerDismiss}>Dismiss</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    backgroundColor: "#2B2358",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  fallbackTitle: {
    color: "#fff",
    fontFamily: "Quicksand-Bold",
    fontSize: 20,
    textAlign: "center",
  },
  fallbackBody: {
    color: "rgba(243, 243, 243, 0.7)",
    fontFamily: "Quicksand-Medium",
    fontSize: 13,
    textAlign: "center",
  },
  fallbackButton: {
    marginTop: 8,
    minWidth: 200,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(243, 243, 243, 0.3)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  fallbackButtonText: {
    color: "#fff",
    fontFamily: "Quicksand-Bold",
    fontSize: 16,
  },
  bannerHost: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    elevation: 100,
  },
  banner: {
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 14,
    backgroundColor: "rgba(120, 40, 60, 0.95)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  bannerText: {
    flex: 1,
    color: "#fff",
    fontFamily: "Quicksand-Medium",
    fontSize: 12,
  },
  bannerDismiss: {
    color: "#fff",
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
  },
});
