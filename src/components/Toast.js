import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Animated, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState(null);
  const progress = useRef(new Animated.Value(0)).current;
  const timer = useRef(null);
  const show = (text, type = "success") => {
    if (timer.current) clearTimeout(timer.current);
    setMessage({ text, type });
    progress.setValue(0);
    Animated.spring(progress, { toValue: 1, useNativeDriver: true, damping: 17, stiffness: 170 }).start();
    timer.current = setTimeout(() => Animated.timing(progress, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setMessage(null)), 2500);
  };
  useEffect(() => () => timer.current && clearTimeout(timer.current), []);
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [-28, 0] });
  return <ToastContext.Provider value={show}>
    {children}
    {message && <Animated.View pointerEvents="none" style={{ position: "absolute", top: insets.top + 8, left: 18, right: 18, zIndex: 999, opacity: progress, transform: [{ translateY }] }}>
      <View className="flex-row items-center rounded-2xl bg-slate-900 px-4 py-3 shadow-2xl">
        <View className={`mr-3 h-8 w-8 items-center justify-center rounded-full ${message.type === "error" ? "bg-rose-500/20" : "bg-emerald-400/20"}`}>
          <Ionicons name={message.type === "error" ? "alert-circle" : "checkmark-circle"} size={19} color={message.type === "error" ? "#FDA4AF" : "#6EE7B7"} />
        </View>
        <Text className="flex-1 text-sm font-semibold text-white">{message.text}</Text>
      </View>
    </Animated.View>}
  </ToastContext.Provider>;
}
