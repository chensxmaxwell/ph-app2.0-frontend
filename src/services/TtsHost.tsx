import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { configureTtsEngine, TtsSpeakInput } from "./tts";

const TTS_HTML = `<!DOCTYPE html>
<html>
  <body>
    <script>
      function speak(text) {
        window.speechSynthesis.cancel();
        var utterance = new SpeechSynthesisUtterance(text || "");
        utterance.onend = function () {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage("ended");
          }
        };
        window.speechSynthesis.speak(utterance);
      }
      function stop() {
        window.speechSynthesis.cancel();
      }
    </script>
  </body>
</html>`;

export const TtsHost = () => {
  const webRef = useRef<WebView>(null);
  const pending = useRef<(() => void) | null>(null);

  useEffect(() => {
    const speak = (input: TtsSpeakInput) =>
      new Promise<void>((resolve) => {
        pending.current?.();
        pending.current = resolve;
        const text = JSON.stringify(input.text);
        webRef.current?.injectJavaScript(
          `speak(${text}); true;`
        );
        setTimeout(() => {
          if (pending.current === resolve) {
            pending.current = null;
            resolve();
          }
        }, Math.min(12000, 800 + input.text.length * 60));
      });

    configureTtsEngine({
      speak,
      stop: async () => {
        webRef.current?.injectJavaScript("stop(); true;");
        pending.current?.();
        pending.current = null;
      },
    });

    return () => {
      configureTtsEngine({
        speak: async () => undefined,
        stop: async () => undefined,
      });
    };
  }, []);

  return (
    <View pointerEvents="none" style={styles.host}>
      <WebView
        ref={webRef}
        originWhitelist={["*"]}
        source={{ html: TTS_HTML }}
        javaScriptEnabled
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        onMessage={() => {
          pending.current?.();
          pending.current = null;
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
  },
});
