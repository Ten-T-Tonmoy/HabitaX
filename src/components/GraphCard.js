import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BarChart, LineChart } from "react-native-gifted-charts";
export default function GraphCard({ title, data = [], type = "bar" }) {
  return <View className="mb-4 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm"><View className="mb-4 flex-row items-center"><View className="mr-2 h-8 w-8 items-center justify-center rounded-xl bg-indigo-50"><Ionicons name={type==="line"?"pulse-outline":"bar-chart-outline"} size={17} color="#5267E8"/></View><Text className="flex-1 text-base font-extrabold text-slate-800">{title}</Text></View>{data.length ? (type==="line" ? <LineChart data={data} height={145} color="#5267E8" thickness={3} hideRules dataPointsColor="#5267E8" areaChart startFillColor="#5267E8" endFillColor="#FFFFFF" startOpacity={0.16} endOpacity={0.01}/> : <BarChart data={data} height={145} barWidth={22} spacing={18} frontColor="#8492F2" hideRules/> ) : <View className="items-center py-7"><Ionicons name="bar-chart-outline" size={28} color="#CBD5E1"/><Text className="mt-2 text-sm text-slate-400">Your activity will appear here.</Text></View>}</View>;
}
