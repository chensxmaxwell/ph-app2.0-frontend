import fs from "fs";
import path from "path";
import React from "react";
import { Text } from "react-native";
import renderer, { act, ReactTestRenderer } from "react-test-renderer";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import {
  CrashGuardBanner,
  CrashGuardBoundary,
  ErrorUtilsLike,
  clearGuardedError,
  describeError,
  installReleaseCrashGuard,
  lastGuardedError,
} from "../src/services/crash-guard";

type Handler = (error: unknown, isFatal?: boolean) => void;

const fakeErrorUtils = (initial: Handler) => {
  let handler: Handler = initial;
  const utils: ErrorUtilsLike = {
    getGlobalHandler: () => handler,
    setGlobalHandler: (next) => {
      handler = next;
    },
  };
  return { utils, current: () => handler };
};

const trees: ReactTestRenderer[] = [];
const render = (element: React.ReactElement) => {
  let tree: ReactTestRenderer;
  act(() => {
    tree = renderer.create(element);
  });
  trees.push(tree!);
  return tree!;
};

const texts = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(Text)
    .map((node) => node.props.children)
    .flat()
    .filter((child): child is string => typeof child === "string");

beforeEach(() => {
  clearGuardedError();
});

afterEach(() => {
  act(() => {
    trees.splice(0).forEach((tree) => tree.unmount());
  });
  jest.restoreAllMocks();
});

describe("installReleaseCrashGuard", () => {
  it("downgrades a fatal JS error to a non-fatal report instead of RCTFatal", () => {
    const stock = jest.fn<Handler>();
    const { utils, current } = fakeErrorUtils(stock);

    expect(installReleaseCrashGuard({ isDev: false, errorUtils: utils })).toBe(
      true
    );
    const boom = new ReferenceError("Property 'client' doesn't exist");
    current()(boom, true);

    expect(stock).toHaveBeenCalledTimes(1);
    expect(stock).toHaveBeenCalledWith(boom, false);
    expect(stock).not.toHaveBeenCalledWith(boom, true);
    expect(lastGuardedError()).toMatchObject({
      fatal: true,
      message: "ReferenceError: Property 'client' doesn't exist",
    });
  });

  it("does not let a throwing stock handler take the process down", () => {
    const stock = jest.fn<Handler>(() => {
      throw new Error("reporting failed");
    });
    const { utils, current } = fakeErrorUtils(stock);
    installReleaseCrashGuard({ isDev: false, errorUtils: utils });

    expect(() => current()("plain string error", true)).not.toThrow();
    expect(lastGuardedError()?.message).toBe("plain string error");
  });

  it("installs once per ErrorUtils and leaves Dev on the RedBox path", () => {
    const stock = jest.fn<Handler>();
    const { utils, current } = fakeErrorUtils(stock);

    expect(installReleaseCrashGuard({ isDev: true, errorUtils: utils })).toBe(
      false
    );
    expect(current()).toBe(stock);

    expect(installReleaseCrashGuard({ isDev: false, errorUtils: utils })).toBe(
      true
    );
    const guarded = current();
    expect(installReleaseCrashGuard({ isDev: false, errorUtils: utils })).toBe(
      false
    );
    expect(current()).toBe(guarded);
  });

  it("attaches to React Native's real global ErrorUtils in a Release build", () => {
    const real = (globalThis as unknown as { ErrorUtils?: ErrorUtilsLike })
      .ErrorUtils;
    expect(real).toBeDefined();
    const previous = real!.getGlobalHandler();
    const stock = jest.fn<Handler>();
    real!.setGlobalHandler(stock);
    try {
      expect(installReleaseCrashGuard({ isDev: false })).toBe(true);
      real!.getGlobalHandler()!(new Error("device only"), true);
      expect(stock).toHaveBeenCalledWith(expect.any(Error), false);
    } finally {
      real!.setGlobalHandler(previous as Handler);
    }
  });
});

describe("describeError", () => {
  it("keeps the error name only when it adds information", () => {
    expect(describeError(new Error("plain"))).toBe("plain");
    expect(describeError(new TypeError("bad"))).toBe("TypeError: bad");
    expect(describeError({ code: 7 })).toBe('{"code":7}');
    expect(describeError(undefined)).toBe("undefined");
  });
});

describe("CrashGuardBoundary", () => {
  it("renders a fallback for a render-phase error and remounts on reset", () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    let shouldThrow = true;
    const Flaky = () => {
      if (shouldThrow) {
        throw new Error("Element type is invalid");
      }
      return <Text>recovered</Text>;
    };

    const tree = render(
      <CrashGuardBoundary>
        <Flaky />
      </CrashGuardBoundary>
    );

    expect(
      tree.root.findByProps({ testID: "crash-guard-fallback" })
    ).toBeTruthy();
    expect(texts(tree)).toContain("Element type is invalid");
    expect(lastGuardedError()?.message).toBe("Element type is invalid");

    shouldThrow = false;
    act(() => {
      tree.root.findByProps({ testID: "crash-guard-reset" }).props.onPress();
    });

    expect(texts(tree)).toContain("recovered");
    expect(lastGuardedError()).toBeNull();
  });
});

describe("CrashGuardBanner", () => {
  it("shows the guarded error message and can be dismissed", () => {
    const stock = jest.fn<Handler>();
    const { utils, current } = fakeErrorUtils(stock);
    installReleaseCrashGuard({ isDev: false, errorUtils: utils });
    const tree = render(<CrashGuardBanner />);
    expect(tree.root.findAllByType(Text)).toHaveLength(0);

    act(() => current()(new TypeError("undefined is not a function"), true));
    expect(texts(tree)).toContain("TypeError: undefined is not a function");

    act(() => {
      tree.root.findByProps({ testID: "crash-guard-dismiss" }).props.onPress();
    });
    expect(tree.root.findAllByType(Text)).toHaveLength(0);
  });
});

describe("app wiring", () => {
  const entrySource = fs.readFileSync(
    path.join(__dirname, "../index.js"),
    "utf8"
  );
  const appSource = fs.readFileSync(path.join(__dirname, "../App.tsx"), "utf8");

  it("installs the guard before the root component registers", () => {
    expect(entrySource.indexOf("installReleaseCrashGuard()")).toBeGreaterThan(
      -1
    );
    expect(entrySource.indexOf("installReleaseCrashGuard()")).toBeLessThan(
      entrySource.indexOf("AppRegistry.registerComponent")
    );
  });

  it("wraps the navigator and avatar host in the boundary and mounts the banner", () => {
    const boundaryOpen = appSource.indexOf("<CrashGuardBoundary>");
    const boundaryClose = appSource.indexOf("</CrashGuardBoundary>");
    expect(boundaryOpen).toBeGreaterThan(-1);
    expect(appSource.indexOf("<NavigationContainer>")).toBeGreaterThan(
      boundaryOpen
    );
    expect(appSource.indexOf("<AvatarEngineHost />")).toBeGreaterThan(
      boundaryOpen
    );
    expect(appSource.indexOf("<AvatarEngineHost />")).toBeLessThan(
      boundaryClose
    );
    expect(appSource).toContain("<CrashGuardBanner />");
  });
});
