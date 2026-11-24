import React from "react";
import { Pressable, Text, View } from "react-native";
export const NOTE_THEMES = [
  { id: "grid", label: "Grid", bg: "#F2F6FF", accent: "#5267E8", font: "sans-serif" },
  { id: "notebook", label: "Notebook", bg: "#FFF9E9", accent: "#B7791F", font: "serif" },
  { id: "midnight", label: "Midnight", bg: "#20283C", accent: "#9EAFFF", font: "monospace" },
  { id: "mint", label: "Mint", bg: "#E9F8F1", accent: "#218A69", font: "sans-serif-medium" },
  { id: "rose", label: "Rose", bg: "#FFF0F3", accent: "#C04F70", font: "serif" },
  { id: "lavender", label: "Lavender", bg: "#F2EDFF", accent: "#7656C9", font: "sans-serif-condensed" }
];
export default function ThemePicker({ value, onChange }) {
  return <View className="flex-row flex-wrap">{NOTE_THEMES.map(theme => <Pressable key={theme.id} onPress={() => onChange(theme.id)} className="mb-2 mr-2 rounded-xl px-3 py-2" style={{ backgroundColor: theme.bg, borderWidth: value === theme.id ? 2 : 1, borderColor: theme.accent }}><Text style={{ color: theme.accent }} className="text-xs font-bold">{theme.label}</Text></Pressable>)}</View>;
}
