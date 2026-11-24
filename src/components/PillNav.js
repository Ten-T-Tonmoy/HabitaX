import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
export default function PillNav({ value, onChange, counts, onAdd }) {
  const tabs = [
    { id: "all", label: `all (${counts.all})` },
    { id: "onprogress", label: `onprogress (${counts.onprogress})` },
    { id: "done", label: "done" },
  ];
  return (
    <View className="flex-row rounded-2xl border border-slate-100 bg-white p-1.5 shadow-sm">
      {tabs.map((tab) => (
        <Pressable
          key={tab.id}
          onPress={() => onChange(tab.id)}
          className={`flex-1 items-center justify-center rounded-xl px-1 py-3 ${value === tab.id ? "bg-indigo-50" : ""}`}
        >
          <Text
            className={`text-[11px] font-extrabold ${value === tab.id ? "text-indigo-600" : "text-slate-400"}`}
          >
            {tab.label}
          </Text>
        </Pressable>
      ))}
      <Pressable
        onPress={onAdd}
        className="ml-1 w-12 items-center justify-center rounded-xl bg-indigo-600"
      >
        <Ionicons name="add" size={25} color="white" />
      </Pressable>
    </View>
  );
}
