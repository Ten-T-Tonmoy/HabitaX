import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
export default function TaskItem({ task, color, onDone, onMinimize, onDrop, onPress }) {
  return <View className="min-h-36 rounded-3xl border border-white/70 p-3 shadow-sm" style={{ backgroundColor:color }}>
    <Pressable onPress={onPress} className="flex-1"><View className="mb-2 flex-row items-start justify-between"><Text numberOfLines={2} className="flex-1 text-base font-extrabold text-slate-800">{task.title}</Text><Ionicons name="ellipsis-horizontal-circle" size={18} color="#64748B"/></View>{!task.minimized&&<Text numberOfLines={4} className="text-sm leading-5 text-slate-600">{task.description||"No description yet"}</Text>}</Pressable>
    <View className="mt-3 flex-row items-center justify-between border-t border-black/10 pt-2"><Pressable onPress={onDone} className="flex-row items-center"><Ionicons name={task.status==="done"?"checkmark-circle":"ellipse-outline"} size={15} color="#334155"/><Text className="ml-1 text-[10px] font-bold text-slate-700">{task.status==="done"?"Undo":"Done"}</Text></Pressable><Pressable onPress={onMinimize} className="flex-row items-center"><Ionicons name={task.minimized?"expand-outline":"contract-outline"} size={14} color="#475569"/><Text className="ml-1 text-[10px] font-semibold text-slate-700">{task.minimized?"Expand":"Minimize"}</Text></Pressable><Pressable onPress={onDrop} className="flex-row items-center"><Ionicons name="trash-outline" size={14} color="#BE123C"/><Text className="ml-1 text-[10px] font-bold text-rose-700">Drop</Text></Pressable></View>
  </View>;
}
