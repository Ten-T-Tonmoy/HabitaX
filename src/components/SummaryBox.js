import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
export default function SummaryBox({ label, value, tone = "#5267E8", icon = "wallet-outline" }) {
  return <View className="min-h-[104px] flex-1 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm" style={{ borderBottomWidth: 3, borderBottomColor: tone }}>
    <View className="mb-2 h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: `${tone}18` }}><Ionicons name={icon} size={15} color={tone}/></View>
    <Text numberOfLines={1} className="text-[10px] font-semibold text-slate-400">{label}</Text><Text adjustsFontSizeToFit numberOfLines={1} className="mt-1 text-sm font-extrabold text-slate-800">{value}</Text>
  </View>;
}
