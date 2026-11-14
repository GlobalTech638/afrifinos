import { Platform } from "react-native";

export const colors = {
  ink: "#17172F",
  navy: "#25234F",
  navyDeep: "#19183D",
  blue: "#625CF6",
  teal: "#31C7B1",
  canvas: "#F7F6FC",
  card: "#FFFFFF",
  muted: "#85849D",
  line: "#ECEAF5",
  danger: "#E45D78",
  warning: "#D79A36",
  success: "#179D83",
  white: "#FFFFFF",
  lavender: "#EFEDFF",
  lavenderStrong: "#DCD8FF",
  mint: "#E5F8F3",
  peach: "#FFF2E7",
  pink: "#FCECF2",
};

export const radii = { sm: 14, md: 22, lg: 28 };

export const shadow = Platform.select({
  ios: { shadowColor: "#29245C", shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  android: { elevation: 3 },
  default: {},
});
