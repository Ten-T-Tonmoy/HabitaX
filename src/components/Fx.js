import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  LayoutAnimation,
  Pressable,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

/* Shared motion + toast helpers (no extra libraries). Put in src/components/Fx.js */

export const ease = () =>
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

export function FadeSlide({ children, delay = 0, from = 16, style }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: 380,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View
      style={[
        {
          opacity: v,
          transform: [
            {
              translateY: v.interpolate({
                inputRange: [0, 1],
                outputRange: [from, 0],
              }),
            },
          ],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

// Springy entrance + press-in shrink.
export function PressScale({
  children,
  onPress,
  onLongPress,
  style,
  delay = 0,
  from = 26,
}) {
  const enter = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.spring(enter, {
      toValue: 1,
      delay,
      friction: 7,
      tension: 60,
      useNativeDriver: true,
    }).start();
  }, []);
  const to = (v) =>
    Animated.spring(press, {
      toValue: v,
      friction: 6,
      useNativeDriver: true,
    }).start();
  const body = (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!onPress && !onLongPress}
      onPressIn={() => to(0.97)}
      onPressOut={() => to(1)}
      style={{ flex: 1 }}
    >
      {children}
    </Pressable>
  );
  return (
    <Animated.View
      style={[
        {
          opacity: enter,
          transform: [
            {
              translateY: enter.interpolate({
                inputRange: [0, 1],
                outputRange: [from, 0],
              }),
            },
            {
              scale: Animated.multiply(
                enter.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.9, 1],
                }),
                press,
              ),
            },
          ],
        },
        style,
      ]}
    >
      {body}
    </Animated.View>
  );
}

// Number that counts up/down smoothly.
export function CountUp({ value = 0, prefix = "", style, duration = 800 }) {
  const v = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = v.addListener(({ value: x }) => setShown(x));
    Animated.timing(v, {
      toValue: Number(value) || 0,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => v.removeListener(id);
  }, [value]);
  const n = Number(shown.toFixed(2));
  const sign = n < 0 ? "-" : "";
  return (
    <Text style={style}>
      {sign}
      {prefix}
      {Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}
    </Text>
  );
}

export function AnimatedBar({
  pct,
  color = "#fff",
  track = "rgba(255,255,255,0.25)",
  height = 8,
  delay = 0,
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: Math.max(0, Math.min(1, pct || 0)),
      duration: 600,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct]);
  return (
    <View
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: track,
        overflow: "hidden",
      }}
    >
      <Animated.View
        style={{
          height,
          borderRadius: height / 2,
          backgroundColor: color,
          width: v.interpolate({
            inputRange: [0, 1],
            outputRange: ["0%", "100%"],
          }),
        }}
      />
    </View>
  );
}

// Sliding-indicator tabs. tabs: [{id,label,count?}]
export function FilterTabs({ value, onChange, tabs }) {
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const idx = Math.max(
    0,
    tabs.findIndex((t) => t.id === value),
  );
  const tabW = w / tabs.length;
  useEffect(() => {
    Animated.spring(x, {
      toValue: idx * tabW,
      friction: 8,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, [idx, tabW]);
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width - 8)}
      style={{
        flexDirection: "row",
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 4,
        elevation: 2,
        shadowColor: "#6366F1",
        shadowOpacity: 0.12,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
      }}
    >
      {w > 0 && (
        <Animated.View
          style={{
            position: "absolute",
            top: 4,
            left: 4,
            width: tabW,
            height: "100%",
            borderRadius: 12,
            backgroundColor: "#4F46E5",
            transform: [{ translateX: x }],
          }}
        />
      )}
      {tabs.map((t) => {
        const on = t.id === value;
        return (
          <Pressable
            key={t.id}
            onPress={() => {
              ease();
              onChange(t.id);
            }}
            style={{ flex: 1, alignItems: "center", paddingVertical: 10 }}
          >
            <Text
              style={{
                color: on ? "#fff" : "#64748B",
                fontWeight: "700",
                fontSize: 13,
              }}
            >
              {t.label}
              {t.count !== undefined && (
                <Text style={{ opacity: 0.75 }}> {t.count}</Text>
              )}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ───────── toast ───────── */

const TOAST_STYLES = {
  success: { bg: "#10B981", icon: "checkmark-circle" },
  info: { bg: "#6366F1", icon: "sparkles" },
  danger: { bg: "#F43F5E", icon: "trash" },
  warn: { bg: "#F59E0B", icon: "alert-circle" },
};

function ToastBar({ toast, top, onUndo }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.spring(v, {
        toValue: 1,
        friction: 7,
        tension: 90,
        useNativeDriver: true,
      }),
      Animated.delay(2300),
      Animated.timing(v, {
        toValue: 0,
        duration: 260,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);
  const st = TOAST_STYLES[toast.type] || TOAST_STYLES.info;
  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        top,
        zIndex: 50,
        opacity: v,
        transform: [
          {
            translateY: v.interpolate({
              inputRange: [0, 1],
              outputRange: [-40, 0],
            }),
          },
          {
            scale: v.interpolate({
              inputRange: [0, 1],
              outputRange: [0.92, 1],
            }),
          },
        ],
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderRadius: 18,
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: st.bg,
          shadowColor: st.bg,
          shadowOpacity: 0.45,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 8 },
          elevation: 10,
        }}
      >
        <Ionicons name={st.icon} size={20} color="#fff" />
        <Text
          style={{ marginLeft: 12, flex: 1, color: "#fff", fontWeight: "700" }}
          numberOfLines={2}
        >
          {toast.msg}
        </Text>
        {toast.undo && (
          <Pressable
            onPress={onUndo}
            style={{
              marginLeft: 8,
              flexDirection: "row",
              alignItems: "center",
              borderRadius: 10,
              backgroundColor: "rgba(255,255,255,0.25)",
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            <Ionicons name="arrow-undo" size={14} color="#fff" />
            <Text
              style={{
                marginLeft: 4,
                fontSize: 12,
                fontWeight: "800",
                color: "#fff",
              }}
            >
              UNDO
            </Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

// const { show, node } = useFxToast(insets.top + 8);  → render {node} inside the screen root.
export function useFxToast(top = 8) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const show = (msg, type = "success", undo = null) => {
    clearTimeout(timer.current);
    setToast({ id: Date.now() + Math.random(), msg, type, undo });
    timer.current = setTimeout(() => setToast(null), 3000);
  };
  const node = toast ? (
    <ToastBar
      key={toast.id}
      toast={toast}
      top={top}
      onUndo={() => {
        const u = toast.undo;
        setToast(null);
        u && u();
      }}
    />
  ) : null;
  return { show, node };
}
