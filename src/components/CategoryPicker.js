import React, { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export const EXPENSE_CATEGORIES = ["Food & groceries", "Transport", "Shopping", "Bills & utilities", "Health", "Education", "Entertainment", "Home", "Travel", "Other"];
export default function CategoryPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  return <>
    <Pressable onPress={() => setOpen(true)} className="mb-3 flex-row items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
      <View><Text className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Category · optional</Text><Text className="font-semibold text-slate-700">{value || "Choose a category"}</Text></View>
      <Ionicons name="chevron-down" size={19} color="#64748B" />
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <Pressable onPress={() => setOpen(false)} className="flex-1 justify-end bg-black/40"><Pressable onPress={() => {}} className="max-h-[75%] rounded-t-[30px] bg-white p-5">
        <View className="mb-4 flex-row items-center justify-between"><Text className="text-xl font-extrabold text-slate-800">Choose category</Text><Pressable onPress={() => setOpen(false)}><Ionicons name="close-circle" size={26} color="#94A3B8" /></Pressable></View>
        <ScrollView>{EXPENSE_CATEGORIES.map((item, index) => <Pressable key={item} onPress={() => { onChange(item); setOpen(false); }} className="mb-2 flex-row items-center justify-between rounded-xl bg-slate-50 px-4 py-3.5"><Text className="font-medium text-slate-700">{item}</Text>{value === item ? <Ionicons name="checkmark-circle" size={20} color="#5267E8" /> : <View className="h-5 w-5 rounded-full border border-slate-300" />}</Pressable>)}</ScrollView>
        <Pressable onPress={() => { onChange(""); setOpen(false); }} className="mt-2 rounded-xl p-3"><Text className="text-center font-semibold text-slate-500">Clear category</Text></Pressable>
      </Pressable></Pressable>
    </Modal>
  </>;
}
