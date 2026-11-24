import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AnimatedScreen from "../components/AnimatedScreen";
import { getData, saveData } from "../storage/storage";

/* ───────────── helpers & palette ───────────── */

const dateKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const ease = () =>
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

// vibrant card colors (replaces TODO_COLORS for this screen)
const PALETTE = [
  "#6366F1", // indigo
  "#EC4899", // pink
  "#F59E0B", // amber
  "#10B981", // emerald
  "#06B6D4", // cyan
  "#8B5CF6", // violet
  "#F43F5E", // rose
  "#3B82F6", // blue
];

const TOAST_STYLES = {
  success: { bg: "#10B981", icon: "checkmark-circle" },
  info: { bg: "#6366F1", icon: "sparkles" },
  danger: { bg: "#F43F5E", icon: "trash" },
  warn: { bg: "#F59E0B", icon: "alert-circle" },
};

/* ───────────── animated building blocks ───────────── */

// Text with an animated "line drawn through it" when done (works across wrapped lines).
function StrikeText({
  text,
  done,
  style,
  lineColor = "#fff",
  numberOfLines,
  doneOpacity = 0.55,
}) {
  const [lines, setLines] = useState([]);
  const p = useRef(new Animated.Value(done ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(p, {
      toValue: done ? 1 : 0,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [done]);
  return (
    <View>
      <Animated.Text
        style={[
          style,
          {
            opacity: p.interpolate({
              inputRange: [0, 1],
              outputRange: [1, doneOpacity],
            }),
          },
        ]}
        numberOfLines={numberOfLines}
        onTextLayout={(e) => {
          const next = e.nativeEvent.lines.map((l) => ({
            x: l.x,
            y: l.y,
            w: l.width,
            h: l.height,
          }));
          setLines((prev) =>
            JSON.stringify(prev) === JSON.stringify(next) ? prev : next,
          );
        }}
      >
        {text}
      </Animated.Text>
      {lines.map((l, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={{
            position: "absolute",
            left: l.x,
            top: l.y + l.h / 2,
            height: 2,
            borderRadius: 1,
            backgroundColor: lineColor,
            width: p.interpolate({ inputRange: [0, 1], outputRange: [0, l.w] }),
          }}
        />
      ))}
    </View>
  );
}

// Round checkbox with a springy pop when toggled.
function CheckCircle({
  done,
  onPress,
  size = 26,
  fill = "#fff",
  ring = "rgba(255,255,255,0.8)",
  tick = "#111",
}) {
  const s = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    s.setValue(0.6);
    Animated.spring(s, {
      toValue: 1,
      friction: 3,
      tension: 140,
      useNativeDriver: true,
    }).start();
  }, [done]);
  return (
    <Pressable onPress={onPress} hitSlop={10}>
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: done ? fill : ring,
          backgroundColor: done ? fill : "transparent",
          alignItems: "center",
          justifyContent: "center",
          transform: [{ scale: s }],
        }}
      >
        {done && <Ionicons name="checkmark" size={size * 0.65} color={tick} />}
      </Animated.View>
    </Pressable>
  );
}

function PressScale({ children, onPress, onLongPress, style, delay = 0 }) {
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
  return (
    <Animated.View
      style={[
        {
          opacity: enter,
          transform: [
            {
              translateY: enter.interpolate({
                inputRange: [0, 1],
                outputRange: [26, 0],
              }),
            },
            {
              scale: Animated.multiply(
                enter.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.88, 1],
                }),
                press,
              ),
            },
          ],
        },
        style,
      ]}
    >
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={() => to(0.96)}
        onPressOut={() => to(1)}
        style={{ flex: 1 }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

function FadeSlide({ children, delay = 0, from = 16, style }) {
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

function AnimatedBar({
  pct,
  color = "#fff",
  track = "rgba(255,255,255,0.25)",
  height = 8,
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: pct,
      duration: 550,
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

// Sliding-indicator filter tabs
function FilterTabs({ value, onChange, tabs }) {
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
      className="flex-1 flex-row rounded-2xl bg-white p-1"
      style={{
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
            className="flex-1 items-center py-2.5"
          >
            <Text
              style={{
                color: on ? "#fff" : "#64748B",
                fontWeight: "700",
                fontSize: 13,
              }}
            >
              {t.label} <Text style={{ opacity: 0.75 }}>{t.count}</Text>
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// In-screen toast: slides down, colored by type, optional Undo.
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
        className="flex-row items-center rounded-2xl px-4 py-3"
        style={{
          backgroundColor: st.bg,
          shadowColor: st.bg,
          shadowOpacity: 0.45,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 8 },
          elevation: 10,
        }}
      >
        <Ionicons name={st.icon} size={20} color="#fff" />
        <Text className="ml-3 flex-1 font-bold text-white" numberOfLines={2}>
          {toast.msg}
        </Text>
        {toast.undo && (
          <Pressable
            onPress={onUndo}
            className="ml-2 flex-row items-center rounded-lg bg-white/25 px-3 py-1.5"
          >
            <Ionicons name="arrow-undo" size={14} color="#fff" />
            <Text className="ml-1 text-xs font-extrabold text-white">UNDO</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

/* ───────────── task card ───────────── */

function TaskCard({ task, color, index, onPress, onDone, onMinimize, onDrop }) {
  const done = task.status === "done";
  const dim = useRef(new Animated.Value(done ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(dim, {
      toValue: done ? 1 : 0,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [done]);
  const bg = dim.interpolate({
    inputRange: [0, 1],
    outputRange: [color, "#94A3B8"],
  });
  return (
    <PressScale
      delay={Math.min(index, 10) * 70}
      onPress={onPress}
      style={{ flex: 1 }}
    >
      <Animated.View
        style={{
          flex: 1,
          minHeight: 138,
          borderRadius: 24,
          padding: 14,
          backgroundColor: bg,
          shadowColor: color,
          shadowOpacity: done ? 0.1 : 0.4,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 7 },
          elevation: done ? 1 : 6,
        }}
      >
        <View className="mb-3 flex-row items-center justify-between">
          <CheckCircle done={done} onPress={onDone} tick={color} />
          <View className="flex-row items-center" style={{ gap: 12 }}>
            <Pressable onPress={onMinimize} hitSlop={8}>
              <Ionicons
                name={task.minimized ? "chevron-down" : "chevron-up"}
                size={18}
                color="rgba(255,255,255,0.9)"
              />
            </Pressable>
            <Pressable onPress={onDrop} hitSlop={8}>
              <Ionicons
                name="trash-outline"
                size={17}
                color="rgba(255,255,255,0.9)"
              />
            </Pressable>
          </View>
        </View>

        <StrikeText
          text={task.title}
          done={done}
          numberOfLines={3}
          style={{
            color: "#fff",
            fontWeight: "800",
            fontSize: 16,
            lineHeight: 21,
          }}
        />

        {!task.minimized && !!task.description && (
          <Text
            numberOfLines={4}
            style={{
              color: "rgba(255,255,255,0.85)",
              marginTop: 6,
              fontSize: 12.5,
              lineHeight: 17,
            }}
          >
            {task.description}
          </Text>
        )}

        <View className="mt-auto flex-row items-center pt-3">
          <View
            style={{
              backgroundColor: "rgba(255,255,255,0.22)",
              borderRadius: 10,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
              {done ? `✓ ${task.completedAt || ""}` : task.createdAt}
            </Text>
          </View>
        </View>
      </Animated.View>
    </PressScale>
  );
}

/* ───────────── main screen ───────────── */

export default function TasksScreen() {
  const insets = useSafeAreaInsets();
  const [tasks, setTasks] = useState([]);
  const [daily, setDaily] = useState({ items: [], lastResetDate: "" });
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState(true);
  const [modal, setModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [editId, setEditId] = useState(null);
  const [toast, setToast] = useState(null);

  const tasksRef = useRef([]);
  const dailyRef = useRef({ items: [], lastResetDate: "" });
  tasksRef.current = tasks;
  dailyRef.current = daily;
  const toastTimer = useRef(null);
  const chev = useRef(new Animated.Value(1)).current;

  const showToast = (msg, type = "success", undo = null) => {
    clearTimeout(toastTimer.current);
    setToast({ id: Date.now() + Math.random(), msg, type, undo });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  useEffect(() => {
    (async () => {
      const [savedTasks, savedDaily] = await Promise.all([
        getData("tasks", []),
        getData("dailyTasks", { items: [], lastResetDate: "" }),
      ]);
      setTasks(savedTasks);
      const safe =
        savedDaily && Array.isArray(savedDaily.items)
          ? savedDaily
          : { items: [], lastResetDate: "" };
      if (safe.lastResetDate !== dateKey()) {
        safe.items = safe.items.map((item) => ({ ...item, done: false }));
        safe.lastResetDate = dateKey();
        await saveData("dailyTasks", safe);
      }
      setDaily(safe);
    })();
  }, []);

  const persistTasks = (next) => {
    setTasks(next);
    saveData("tasks", next);
  };
  const persistDaily = (next) => {
    setDaily(next);
    saveData("dailyTasks", next);
  };

  const doneCount = tasks.filter((t) => t.status === "done").length;
  const tabs = [
    { id: "all", label: "All", count: tasks.length },
    { id: "onprogress", label: "Active", count: tasks.length - doneCount },
    { id: "done", label: "Done", count: doneCount },
  ];

  const shown = useMemo(() => {
    const list = tasks.filter((t) => filter === "all" || t.status === filter);
    // finished todos sink to the bottom in "All"
    return [...list].sort(
      (a, b) => Number(a.status === "done") - Number(b.status === "done"),
    );
  }, [tasks, filter]);

  const openTask = (task) => {
    setEditId(task?.id || null);
    setTitle(task?.title || "");
    setDescription(task?.description || "");
    setModal(true);
  };

  const submitTask = () => {
    if (!title.trim())
      return Alert.alert("Add a title", "A todo needs a title.");
    const old = tasks.find((t) => t.id === editId);
    ease();
    const next = old
      ? tasks.map((t) =>
          t.id === editId ? { ...t, title: title.trim(), description } : t,
        )
      : [
          {
            id: String(Date.now()),
            title: title.trim(),
            description,
            status: "onprogress",
            minimized: false,
            createdAt: dateKey(),
          },
          ...tasks,
        ];
    persistTasks(next);
    setModal(false);
    showToast(
      old ? "Todo updated ✨" : "New todo added 🚀",
      old ? "info" : "success",
    );
  };

  const toggleDone = (task) => {
    const finishing = task.status !== "done";
    ease();
    persistTasks(
      tasks.map((t) =>
        t.id === task.id
          ? {
              ...t,
              status: finishing ? "done" : "onprogress",
              completedAt: finishing ? dateKey() : null,
            }
          : t,
      ),
    );
    if (finishing) showToast("Nice! Todo completed 🎉", "success");
  };

  const dropTask = (task) =>
    Alert.alert("Drop this todo?", "You can undo right after.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Drop",
        style: "destructive",
        onPress: () => {
          const cur = tasksRef.current;
          const at = cur.findIndex((t) => t.id === task.id);
          ease();
          persistTasks(cur.filter((t) => t.id !== task.id));
          showToast("Todo dropped", "danger", () => {
            const latest = [...tasksRef.current];
            latest.splice(Math.min(at, latest.length), 0, task);
            ease();
            persistTasks(latest);
            showToast("Todo restored", "info");
          });
        },
      },
    ]);

  const updateDaily = (index, patch) =>
    persistDaily({
      ...daily,
      items: daily.items.map((x, i) => (i === index ? { ...x, ...patch } : x)),
    });

  const toggleDaily = (index) => {
    const item = daily.items[index];
    const willBeDone = !item.done;
    updateDaily(index, { done: willBeDone });
    const doneAfter = daily.items.filter((x, i) =>
      i === index ? willBeDone : x.done,
    ).length;
    if (willBeDone && doneAfter === daily.items.length)
      showToast("All daily todos done! 🔥", "success");
  };

  const deleteDaily = (index) => {
    const cur = dailyRef.current;
    const item = cur.items[index];
    ease();
    persistDaily({ ...cur, items: cur.items.filter((_, i) => i !== index) });
    showToast("Checklist item removed", "danger", () => {
      const d = dailyRef.current;
      const items = [...d.items];
      items.splice(Math.min(index, items.length), 0, item);
      ease();
      persistDaily({ ...d, items });
      showToast("Item restored", "info");
    });
  };

  const editDaily = (index) => {
    setTitle(daily.items[index].text);
    setEditId(`daily-edit:${index}`);
    setModal(true);
  };
  const addDaily = () => {
    setTitle("");
    setEditId("daily");
    setModal(true);
  };

  const toggleExpanded = () => {
    ease();
    Animated.timing(chev, {
      toValue: expanded ? 0 : 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
    setExpanded(!expanded);
  };

  const completed = daily.items.filter((x) => x.done).length;
  const dailyPct = daily.items.length ? completed / daily.items.length : 0;
  const isDailyModal =
    editId === "daily" || String(editId).startsWith("daily-edit:");

  const saveModal = () => {
    if (editId === "daily") {
      if (title.trim()) {
        ease();
        persistDaily({
          ...daily,
          items: [
            ...daily.items,
            { id: String(Date.now()), text: title.trim(), done: false },
          ],
        });
        showToast("Checklist item added ✅", "success");
      }
      setModal(false);
    } else if (String(editId).startsWith("daily-edit:")) {
      const index = Number(String(editId).split(":")[1]);
      if (title.trim()) {
        updateDaily(index, { text: title.trim() });
        showToast("Item renamed", "info");
      }
      setModal(false);
    } else submitTask();
  };

  return (
    <AnimatedScreen>
      <View
        className="flex-1 bg-[#F4F5FF] px-4"
        style={{ paddingTop: insets.top + 12 }}
      >
        {toast && (
          <ToastBar
            key={toast.id}
            toast={toast}
            top={insets.top + 8}
            onUndo={() => {
              const u = toast.undo;
              setToast(null);
              u && u();
            }}
          />
        )}

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        >
          {/* header */}
          <FadeSlide from={-12}>
            <View className="mb-4 flex-row items-center justify-between">
              <View>
                <Text className="text-xs font-bold uppercase tracking-[2px] text-indigo-500">
                  MAKE IT HAPPEN
                </Text>
                <Text className="mt-1 text-2xl font-extrabold text-slate-800">
                  My tasks
                </Text>
              </View>
              <Pressable
                onPress={() => openTask(null)}
                className="flex-row items-center rounded-2xl bg-indigo-600 px-4 py-3"
                style={{
                  shadowColor: "#4F46E5",
                  shadowOpacity: 0.4,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 7,
                }}
              >
                <Ionicons name="add" size={18} color="#fff" />
                <Text className="ml-1 font-bold text-white">New</Text>
              </Pressable>
            </View>
          </FadeSlide>

          {/* hero progress */}
          <FadeSlide delay={60}>
            <View
              className="mb-4 rounded-3xl p-5"
              style={{
                backgroundColor: "#4F46E5",
                shadowColor: "#4F46E5",
                shadowOpacity: 0.4,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 10 },
                elevation: 8,
              }}
            >
              <View className="flex-row items-end justify-between">
                <View>
                  <Text className="text-xs font-bold uppercase tracking-[1.5px] text-indigo-200">
                    Today
                  </Text>
                  <Text className="mt-1 text-4xl font-extrabold text-white">
                    {Math.round(dailyPct * 100)}%
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="font-bold text-white">
                    {completed}/{daily.items.length} daily
                  </Text>
                  <Text className="mt-0.5 text-xs text-indigo-200">
                    {tasks.length - doneCount} active · {doneCount} done
                  </Text>
                </View>
              </View>
              <View className="mt-4">
                <AnimatedBar pct={dailyPct} color="#FDE047" />
              </View>
            </View>
          </FadeSlide>

          {/* daily todos */}
          <FadeSlide delay={120}>
            <View
              className="mb-5 rounded-3xl border border-slate-100 bg-white p-4"
              style={{
                elevation: 2,
                shadowColor: "#6366F1",
                shadowOpacity: 0.1,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 4 },
              }}
            >
              <Pressable
                onPress={toggleExpanded}
                className="flex-row items-center justify-between"
              >
                <View className="flex-row items-center">
                  <View className="mr-3 h-10 w-10 items-center justify-center rounded-2xl bg-amber-100">
                    <Ionicons name="flame" size={20} color="#F59E0B" />
                  </View>
                  <View>
                    <Text className="text-lg font-bold text-slate-800">
                      Daily Todos
                    </Text>
                    <Text className="text-xs text-slate-500">
                      Resets every day · tap to{" "}
                      {expanded ? "collapse" : "expand"}
                    </Text>
                  </View>
                </View>
                <Animated.View
                  style={{
                    transform: [
                      {
                        rotate: chev.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["-90deg", "0deg"],
                        }),
                      },
                    ],
                  }}
                >
                  <Ionicons name="chevron-down" size={22} color="#4F46E5" />
                </Animated.View>
              </Pressable>

              {expanded && (
                <View className="mt-3 border-t border-slate-100 pt-2">
                  {daily.items.map((item, index) => (
                    <View
                      key={item.id || index}
                      className="mb-1.5 flex-row items-center rounded-2xl px-2 py-2.5"
                      style={{
                        backgroundColor: item.done ? "#ECFDF5" : "#F8FAFC",
                      }}
                    >
                      <CheckCircle
                        done={item.done}
                        onPress={() => toggleDaily(index)}
                        size={24}
                        fill="#10B981"
                        ring="#CBD5E1"
                        tick="#fff"
                      />
                      <View className="mx-3 flex-1">
                        <StrikeText
                          text={item.text}
                          done={item.done}
                          lineColor="#10B981"
                          style={{
                            color: "#1E293B",
                            fontSize: 15,
                            fontWeight: "600",
                          }}
                          doneOpacity={0.5}
                        />
                      </View>
                      <Pressable
                        onPress={() => editDaily(index)}
                        hitSlop={8}
                        className="px-1.5"
                      >
                        <Ionicons
                          name="create-outline"
                          size={18}
                          color="#94A3B8"
                        />
                      </Pressable>
                      <Pressable
                        onPress={() => deleteDaily(index)}
                        hitSlop={8}
                        className="px-1.5"
                      >
                        <Ionicons name="close" size={18} color="#F43F5E" />
                      </Pressable>
                    </View>
                  ))}

                  {!daily.items.length && (
                    <Text className="py-3 text-center text-sm text-slate-400">
                      No daily habits yet — add your first one.
                    </Text>
                  )}

                  <Pressable
                    onPress={addDaily}
                    className="mt-2 flex-row items-center justify-center rounded-2xl bg-indigo-50 p-3"
                  >
                    <Ionicons name="add" size={18} color="#4F46E5" />
                    <Text className="ml-1 font-semibold text-indigo-600">
                      Add checklist item
                    </Text>
                  </Pressable>

                  {daily.items.length > 0 &&
                    completed === daily.items.length && (
                      <Text className="mt-3 text-center font-bold text-emerald-600">
                        🎉 All done today!
                      </Text>
                    )}
                </View>
              )}
            </View>
          </FadeSlide>

          {/* regular todos */}
          <View className="mb-3 flex-row items-center">
            <Text className="mr-3 text-lg font-bold text-slate-800">
              Regular Todos
            </Text>
          </View>
          <View className="mb-4 flex-row">
            <FilterTabs value={filter} onChange={setFilter} tabs={tabs} />
          </View>

          <View className="flex-row flex-wrap justify-between">
            {shown.map((task, index) => (
              <View key={task.id} className="mb-3 w-[48.5%]">
                <TaskCard
                  task={task}
                  index={index}
                  color={
                    PALETTE[
                      tasks.findIndex((t) => t.id === task.id) % PALETTE.length
                    ]
                  }
                  onPress={() => openTask(task)}
                  onDone={() => toggleDone(task)}
                  onMinimize={() => {
                    ease();
                    persistTasks(
                      tasks.map((t) =>
                        t.id === task.id
                          ? { ...t, minimized: !t.minimized }
                          : t,
                      ),
                    );
                  }}
                  onDrop={() => dropTask(task)}
                />
              </View>
            ))}
          </View>

          {!shown.length && (
            <FadeSlide>
              <View className="items-center py-12">
                <Text style={{ fontSize: 44 }}>
                  {filter === "done" ? "🏁" : "🌈"}
                </Text>
                <Text className="mt-3 font-bold text-slate-600">
                  {filter === "done" ? "Nothing finished yet" : "No todos here"}
                </Text>
                <Text className="mt-1 text-slate-400">Tap New to add one.</Text>
              </View>
            </FadeSlide>
          )}
        </ScrollView>

        {/* add / edit sheet */}
        <Modal
          visible={modal}
          transparent
          animationType="slide"
          onRequestClose={() => setModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            className="flex-1"
          >
            <Pressable
              className="flex-1 justify-end bg-black/45"
              onPress={() => setModal(false)}
            >
              <Pressable
                onPress={() => {}}
                className="rounded-t-[32px] bg-white p-5"
                style={{ paddingBottom: Math.max(insets.bottom, 20) }}
              >
                <View className="mb-4 h-1.5 w-12 self-center rounded-full bg-slate-200" />
                <Text className="mb-4 text-xl font-extrabold text-slate-800">
                  {editId === "daily"
                    ? "New daily item"
                    : String(editId).startsWith("daily-edit:")
                      ? "Rename daily item"
                      : editId
                        ? "Edit todo"
                        : "New todo"}
                </Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  autoFocus
                  placeholder={
                    editId === "daily" ? "Checklist item" : "Todo title"
                  }
                  placeholderTextColor="#94A3B8"
                  onSubmitEditing={isDailyModal ? saveModal : undefined}
                  className="mb-3 rounded-2xl bg-slate-100 px-4 py-3.5 text-base text-slate-800"
                />
                {!isDailyModal && (
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Description"
                    placeholderTextColor="#94A3B8"
                    multiline
                    textAlignVertical="top"
                    className="mb-3 min-h-24 rounded-2xl bg-slate-100 px-4 py-3.5 text-slate-800"
                  />
                )}
                <View className="flex-row gap-3">
                  <Pressable
                    onPress={() => setModal(false)}
                    className="flex-1 rounded-2xl bg-slate-100 p-4"
                  >
                    <Text className="text-center font-semibold text-slate-600">
                      Cancel
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={saveModal}
                    className="flex-1 rounded-2xl bg-indigo-600 p-4"
                    style={{
                      shadowColor: "#4F46E5",
                      shadowOpacity: 0.35,
                      shadowRadius: 10,
                      shadowOffset: { width: 0, height: 5 },
                      elevation: 5,
                    }}
                  >
                    <Text className="text-center font-bold text-white">
                      Save
                    </Text>
                  </Pressable>
                </View>
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </AnimatedScreen>
  );
}
