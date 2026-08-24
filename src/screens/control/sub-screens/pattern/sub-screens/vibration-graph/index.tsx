import { FULL_WINDOW_WIDTH } from "@common/constant";
import { colors } from "@common/styles/colors";
import React, { useEffect, useRef, useMemo, useCallback } from "react";
import { View } from "react-native";
import Canvas, { CanvasRenderingContext2D } from "react-native-canvas";
import { useHomeScreen } from "../../../../../../hooks/HomeScreenContext";

export type PatternType = number[];

type VibrationGraphProps = {
  height?: number;
  pattern: PatternType;
  start: boolean;
};

const GRAPH_UPDATE_THROTTLE = 1000;

export const VibrationGraph: React.FC<VibrationGraphProps> = ({
  pattern,
  start,
  height,
}) => {
  const patternRef = useRef<number[]>(pattern);
  const canvasRef = useRef<Canvas | null>(null);
  const graph3StartPositionRef = useRef(FULL_WINDOW_WIDTH);
  const lastUpdateTimeRef = useRef<number>(0);
  const speedRef = useRef(25);
  const animationFrameIdRef = useRef<number | null>(null);
  const memoizedPattern = useMemo(() => pattern, [pattern]);

  const { setCurrentMode, motor_selection_table, setMotorInput } =
    useHomeScreen();

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (!ctx) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      // Set canvas dimensions
      canvas.width = FULL_WINDOW_WIDTH;
      canvas.height = height || 200;

      // Define padding
      const padding = 20;

      // Scale factor to fit the pattern values to the canvas height, accounting for padding
      const scaleFactor = (canvas.height - 2 * padding) / 100;
      const verticalOffset = canvas.height - padding;

      const a = FULL_WINDOW_WIDTH / memoizedPattern.length;
      const radius = a / 4;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw pattern
      ctx.beginPath();
      ctx.strokeStyle = colors.accentLightPink;
      ctx.lineWidth = 5;
      ctx.moveTo(0, verticalOffset - memoizedPattern[0] * scaleFactor);

      for (let i = 0; i < memoizedPattern.length - 1; i++) {
        // Draw the current element twice
        ctx.arcTo(
          i * a,
          verticalOffset - memoizedPattern[i] * scaleFactor,
          i * a + a / 4,
          verticalOffset - memoizedPattern[i] * scaleFactor,
          radius
        );
        ctx.arcTo(
          i * a + a / 4,
          verticalOffset - memoizedPattern[i] * scaleFactor,
          i * a + a / 2,
          verticalOffset - memoizedPattern[i + 1] * scaleFactor,
          radius
        );

        // Draw the next element twice
        ctx.arcTo(
          i * a + a / 2,
          verticalOffset - memoizedPattern[i + 1] * scaleFactor,
          i * a + (3 * a) / 4,
          verticalOffset - memoizedPattern[i + 1] * scaleFactor,
          radius
        );
        ctx.arcTo(
          i * a + (3 * a) / 4,
          verticalOffset - memoizedPattern[i + 1] * scaleFactor,
          i * a + a,
          verticalOffset - memoizedPattern[i + 1] * scaleFactor,
          radius
        );
      }
      ctx.stroke();
      ctx.closePath();
    },
    [memoizedPattern, height]
  );

  const animate = useCallback(
    (timestamp: number) => {
      const ctx = canvasRef.current?.getContext(
        "2d"
      ) as CanvasRenderingContext2D;
      if (!ctx) return;

      if (timestamp - lastUpdateTimeRef.current > 500) {
        lastUpdateTimeRef.current = timestamp;
        let top = patternRef.current[0];
        patternRef.current.push(top);
        patternRef.current.shift();

        const motorInput = [1, top, top, top];
        setMotorInput(motorInput); // accurate control

        graph3StartPositionRef.current -= speedRef.current;

        // Reset the position if it goes off the canvas
        if (graph3StartPositionRef.current < -FULL_WINDOW_WIDTH) {
          graph3StartPositionRef.current = FULL_WINDOW_WIDTH;
        }

        draw(ctx);
      }

      if (start) animationFrameIdRef.current = requestAnimationFrame(animate);
    },
    [draw, start]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
      draw(ctx);
    }

    if (start) {
      animationFrameIdRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [draw, animate, start]);

  return (
    <View>
      <Canvas ref={canvasRef} />
    </View>
  );
};
