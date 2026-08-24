declare module "react-native-waveview" {
  import { Component } from "react";
  import { ViewStyle } from "react-native";

  export interface WaveViewProps {
    style?: ViewStyle;
    waveColor?: string;
    waveSpeed?: number;
    waveAmplitude?: number;
    waveFrequency?: number;
    wavePhaseShift?: number;
    H?: number;
    waveLength?: number;
    wavePoints?: number;
    wavePointOffset?: number;
    waveVerticalPosition?: number;
    waveHorizontalPosition?: number;
    waveMode?: "fill" | "stroke";
    waveParams?: Array<{ A: number; T: number; fill: string }>;
    animated?: boolean;
  }

  export default class WaveView extends Component<WaveViewProps> {}
}
