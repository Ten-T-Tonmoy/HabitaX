import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
export default function ChecklistItem({ item, onToggle, onEdit, onDelete }) {
  return <View className="flex-row items-center border-b border-slate-100 py-2"><Pressable onPress={onToggle} className="mr-3"><Ionicons name={item.done?"checkmark-circle":"ellipse-outline"} size={23} color={item.done?"#16A37A":"#94A3B8"}/></Pressable><Pressable onPress={onToggle} className="flex-1"><Text className={item.done?"text-slate-400 line-through":"text-slate-700"}>{item.text}</Text></Pressable><Pressable onPress={onEdit} className="px-2"><Ionicons name="pencil-outline" size={17} color="#5267E8"/></Pressable><Pressable onPress={onDelete} className="px-2"><Ionicons name="close-circle-outline" size={18} color="#94A3B8"/></Pressable></View>;
}
