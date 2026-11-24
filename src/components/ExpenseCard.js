import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
export default function ExpenseCard({ item, onPress, onDelete }) {
  const income = item.type === "deposit";
  return <Pressable onPress={onPress} onLongPress={onDelete} className="mb-3 flex-row items-center rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
    <View className={`mr-3 h-11 w-11 items-center justify-center rounded-2xl ${income ? "bg-emerald-50" : "bg-rose-50"}`}><Ionicons name={income ? "arrow-down" : "arrow-up"} size={20} color={income ? "#159B76" : "#E35D6A"}/></View>
    <View className="flex-1"><Text className="font-bold text-slate-800">{item.title || (income ? "Deposit" : "Expense")}</Text><Text className="mt-1 text-xs text-slate-400">{item.category || "Uncategorized"} · {item.date}</Text></View>
    <Text className={`font-extrabold ${income ? "text-emerald-600" : "text-rose-500"}`}>{income ? "+" : "−"}৳{Number(item.amount || 0).toLocaleString()}</Text>
  </Pressable>;
}
