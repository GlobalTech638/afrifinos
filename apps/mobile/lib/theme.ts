import { Platform } from "react-native";

export const colors = {
  ink: "#10233F",
  navy: "#142D4E",
  navyDeep: "#0B1B31",
  blue: "#2F6FED",
  teal: "#13A58B",
  canvas: "#F4F7FB",
  card: "#FFFFFF",
  muted: "#718096",
  line: "#E5EAF1",
  danger: "#C24141",
  warning: "#B7791F",
  success: "#13856E",
  white: "#FFFFFF",
};

export const radii = { sm: 12, md: 18, lg: 24 };

export const shadow = Platform.select({
  ios: { shadowColor: "#10233F", shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  android: { elevation: 2 },
  default: {},
});
