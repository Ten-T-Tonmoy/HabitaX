import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
export default function NoteCard({ note, onPress }) {
  return <Pressable onPress={onPress} className="mb-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><View className="flex-row items-center justify-between"><View className="flex-row items-center"><View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-indigo-50"><Ionicons name="document-text-outline" size={19} color="#5267E8"/></View><View><Text className="text-base font-bold text-slate-800">{note.title||"Untitled note"}</Text><Text className="mt-1 text-[11px] text-slate-400">{note.theme||"grid"} theme</Text></View></View><Ionicons name="chevron-forward" size={18} color="#94A3B8"/></View><Text numberOfLines={2} className="mt-3 text-sm leading-5 text-slate-500">{note.body||"Tap to write your note…"}</Text></Pressable>;
}
