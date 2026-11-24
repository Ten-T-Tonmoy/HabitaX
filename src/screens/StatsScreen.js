import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PieChart } from "react-native-gifted-charts";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import * as Notifications from "expo-notifications";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { getData, saveData, DATA_KEYS } from "../storage/storage";
import AnimatedScreen from "../components/AnimatedScreen";
import {
  AnimatedBar,
  CountUp,
  FadeSlide,
  FilterTabs,
  PressScale,
  ease,
  useFxToast,
} from "../components/Fx";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/* ───────────── helpers ───────────── */

const pad = (n) => String(n).padStart(2, "0");
const formatDate = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const formatDateTime = (d) =>
  `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const defaultReminderTime = () =>
  formatDateTime(new Date(Date.now() + 60 * 60 * 1000));
const lastDays = (count) =>
  Array.from({ length: count }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - count + 1 + i);
    return formatDate(d);
  });

const timeUntil = (iso) => {
  const mins = Math.round((new Date(iso) - new Date()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `in ${mins} min`;
  if (mins < 60 * 24) return `in ${Math.round(mins / 60)} h`;
  return `in ${Math.round(mins / (60 * 24))} d`;
};

const quickTimes = () => {
  const inHour = new Date(Date.now() + 60 * 60 * 1000);
  const tonight = new Date();
  tonight.setHours(20, 0, 0, 0);
  if (tonight <= new Date()) tonight.setDate(tonight.getDate() + 1);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return [
    { label: "In 1 hour", value: formatDateTime(inHour) },
    { label: "Tonight 8 PM", value: formatDateTime(tonight) },
    { label: "Tomorrow 9 AM", value: formatDateTime(tomorrow) },
  ];
};

const PIE_COLORS = [
  "#6366F1",
  "#EC4899",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
  "#06B6D4",
  "#F97316",
  "#64748B",
];

const card = {
  backgroundColor: "#fff",
  borderRadius: 28,
  padding: 16,
  marginBottom: 16,
  borderWidth: 1,
  borderColor: "#F1F5F9",
  shadowColor: "#6366F1",
  shadowOpacity: 0.1,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 5 },
  elevation: 3,
};

/* ───────────── components ───────────── */

function ChartCard({
  title,
  subtitle,
  icon,
  iconColor = "#5267E8",
  iconBg = "#EEF2FF",
  right,
  children,
  delay = 0,
}) {
  return (
    <FadeSlide delay={delay}>
      <View style={card}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 14,
              backgroundColor: iconBg,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
            }}
          >
            <Ionicons name={icon} size={20} color={iconColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: "800", color: "#1E293B" }}>
              {title}
            </Text>
            {!!subtitle && (
              <Text style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>
                {subtitle}
              </Text>
            )}
          </View>
          {right}
        </View>
        {children}
      </View>
    </FadeSlide>
  );
}

function Bar({ value, max, height, color, hi, label, showValue, index }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: max ? value / max : 0,
      duration: 650,
      delay: index * 50,
      easing: Easing.out(Easing.back(1.1)),
      useNativeDriver: false,
    }).start();
  }, [value, max]);
  const isTop = value > 0 && value === max;
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
      {showValue && value > 0 && (
        <Text
          style={{
            fontSize: 10,
            fontWeight: "700",
            color: isTop ? hi : "#94A3B8",
            marginBottom: 3,
          }}
        >
          {Number(value).toLocaleString(undefined, {
            maximumFractionDigits: 0,
          })}
        </Text>
      )}
      <Animated.View
        style={{
          width: "70%",
          maxWidth: 30,
          minHeight: 4,
          borderRadius: 9,
          backgroundColor: value > 0 ? (isTop ? hi : color) : "#E2E8F0",
          height: v.interpolate({
            inputRange: [0, 1],
            outputRange: [4, height],
          }),
        }}
      />
      <Text style={{ fontSize: 10, color: "#94A3B8", marginTop: 6 }}>
        {label}
      </Text>
    </View>
  );
}

function BarChart({
  data,
  color = "#818CF8",
  hi = "#4F46E5",
  height = 120,
  empty = "No data yet",
}) {
  const max = Math.max(0, ...data.map((d) => d.value));
  if (!data.length || max === 0)
    return (
      <View style={{ alignItems: "center", paddingVertical: 22 }}>
        <Ionicons name="bar-chart-outline" size={30} color="#CBD5E1" />
        <Text style={{ color: "#94A3B8", fontSize: 12, marginTop: 6 }}>
          {empty}
        </Text>
      </View>
    );
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        height: height + 40,
      }}
    >
      {data.map((d, i) => (
        <Bar
          key={`${d.label}-${i}`}
          index={i}
          value={d.value}
          max={max}
          height={height}
          color={color}
          hi={hi}
          label={d.label}
          showValue={data.length <= 8}
        />
      ))}
    </View>
  );
}

function Tile({ icon, color, label, value, prefix, delay }) {
  return (
    <PressScale delay={delay} style={{ width: "48.5%", marginBottom: 12 }}>
      <View
        style={{
          flex: 1,
          borderRadius: 24,
          padding: 16,
          backgroundColor: color,
          shadowColor: color,
          shadowOpacity: 0.4,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 7 },
          elevation: 6,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            position: "absolute",
            right: -18,
            top: -18,
            width: 70,
            height: 70,
            borderRadius: 35,
            backgroundColor: "rgba(255,255,255,0.18)",
          }}
        />
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 12,
            backgroundColor: "rgba(255,255,255,0.25)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={icon} size={18} color="#fff" />
        </View>
        <CountUp
          value={value}
          prefix={prefix}
          style={{
            color: "#fff",
            fontSize: 26,
            fontWeight: "800",
            marginTop: 12,
          }}
        />
        <Text
          style={{
            color: "rgba(255,255,255,0.85)",
            fontSize: 12,
            fontWeight: "600",
            marginTop: 2,
          }}
        >
          {label}
        </Text>
      </View>
    </PressScale>
  );
}

/* ───────────── screen ───────────── */

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const { show, node: toastNode } = useFxToast(insets.top + 8);

  const [transactions, setTransactions] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState(defaultReminderTime);
  const [activityDays, setActivityDays] = useState(7);
  const [taskView, setTaskView] = useState("done");

  const reload = useCallback(async () => {
    const [t, k, n, r] = await Promise.all([
      getData("transactions", []),
      getData("tasks", []),
      getData("notes", []),
      getData("reminders", []),
    ]);
    setTransactions(Array.isArray(t) ? t : []);
    setTasks(Array.isArray(k) ? k : []);
    setNotes(Array.isArray(n) ? n : []);
    setReminders(Array.isArray(r) ? r : []);
  }, []);

  // refresh every time this tab comes into view, so charts never go stale
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const monthTotals = useMemo(() => {
    const map = {};
    transactions
      .filter((x) => x.type === "expense")
      .forEach((x) => {
        const key = (x.date || "").slice(0, 7);
        if (key) map[key] = (map[key] || 0) + Number(x.amount || 0);
      });
    return Object.keys(map)
      .sort()
      .slice(-6)
      .map((key) => ({ value: map[key], label: key.slice(5) }));
  }, [transactions]);

  const categoryTotals = useMemo(() => {
    const map = {};
    transactions
      .filter((x) => x.type === "expense")
      .forEach((x) => {
        const key = x.category || "Uncategorized";
        map[key] = (map[key] || 0) + Number(x.amount || 0);
      });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], index) => ({
        name,
        value,
        color: PIE_COLORS[index % PIE_COLORS.length],
      }));
  }, [transactions]);

  const totalExpenses = categoryTotals.reduce((s, i) => s + i.value, 0);
  const pieData = categoryTotals.map((i) => ({
    value: i.value,
    color: i.color,
    text: i.name,
  }));

  const days = lastDays(7);
  const activityDates = lastDays(activityDays);
  const doneData = days.map((day) => ({
    value: tasks.filter((t) => t.status === "done" && t.completedAt === day)
      .length,
    label: day.slice(8),
  }));
  const openData = days.map((day) => ({
    value: tasks.filter(
      (t) => t.status !== "done" && (t.createdAt || "") <= day,
    ).length,
    label: day.slice(8),
  }));

  // each day's created tasks + completed tasks + created notes, normalised to the busiest day
  const raw = activityDates.map(
    (day) =>
      tasks.filter((t) => t.createdAt === day).length +
      tasks.filter((t) => t.completedAt === day).length +
      notes.filter((n) => (n.createdAt || "").slice(0, 10) === day).length,
  );
  const max = Math.max(1, ...raw);
  const activity = raw.map((value, index) => ({
    value: Math.round((value / max) * 100),
    label: activityDates[index].slice(8),
  }));

  const doneTotal = tasks.filter((t) => t.status === "done").length;
  const openTotal = tasks.length - doneTotal;
  const upcoming = reminders
    .filter((r) => new Date(r.date) > new Date())
    .sort((a, b) => a.date.localeCompare(b.date));

  /* ───── reminders ───── */

  const addReminder = async () => {
    if (!title.trim()) return Alert.alert("Add a reminder title");
    const date = new Date(when.replace(" ", "T") + ":00");
    if (Number.isNaN(date.getTime()) || date <= new Date())
      return Alert.alert("Choose a future date", "Use YYYY-MM-DD HH:MM.");
    const permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted)
      return Alert.alert(
        "Notifications disabled",
        "Enable notifications in system settings.",
      );
    const id = await Notifications.scheduleNotificationAsync({
      content: { title: title.trim(), body: "PocketFlow reminder" },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
    });
    const next = [
      ...reminders,
      { id, title: title.trim(), date: date.toISOString() },
    ];
    ease();
    setReminders(next);
    await saveData("reminders", next);
    setTitle("");
    setWhen(defaultReminderTime());
    show("Reminder scheduled ⏰", "success");
  };

  const removeReminder = async (r) => {
    try {
      await Notifications.cancelScheduledNotificationAsync(r.id);
    } catch (e) {}
    const next = reminders.filter((x) => x.id !== r.id);
    ease();
    setReminders(next);
    await saveData("reminders", next);
    show("Reminder removed", "danger");
  };

  /* ───── backup / restore ───── */

  const backup = async () => {
    try {
      const data = {};
      for (const key of DATA_KEYS)
        data[key] = await getData(
          key,
          key === "dailyTasks" ? { items: [], lastResetDate: "" } : [],
        );
      const uri =
        FileSystem.cacheDirectory + `pocketflow-backup-${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(uri, JSON.stringify(data, null, 2));
      if (await Sharing.isAvailableAsync())
        await Sharing.shareAsync(uri, {
          mimeType: "application/json",
          dialogTitle: "PocketFlow backup",
        });
      else Alert.alert("Backup created", uri);
      show("Backup is ready to share 📦", "success");
    } catch (e) {
      Alert.alert("Backup failed", String(e));
    }
  };

  const restore = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const content = await FileSystem.readAsStringAsync(result.assets[0].uri);
      const data = JSON.parse(content);
      for (const key of DATA_KEYS)
        if (Object.prototype.hasOwnProperty.call(data, key))
          await saveData(key, data[key]);
      await reload();
      show("Your backup was restored ✅", "success");
    } catch (e) {
      Alert.alert("Restore failed", "Choose a valid PocketFlow JSON backup.");
    }
  };

  return (
    <AnimatedScreen>
      <View
        className="flex-1 bg-[#F4F5FF] px-4"
        style={{ paddingTop: insets.top + 12 }}
      >
        {toastNode}

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 112 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* header */}
          <FadeSlide from={-12}>
            <View className="mb-4 flex-row items-center justify-between">
              <View>
                <Text className="text-xs font-bold uppercase tracking-[2px] text-indigo-500">
                  YOUR OVERVIEW
                </Text>
                <Text className="mt-1 text-2xl font-extrabold text-slate-800">
                  Stats & insights
                </Text>
              </View>
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100">
                <Ionicons name="analytics" size={23} color="#5267E8" />
              </View>
            </View>
          </FadeSlide>

          {/* bento tiles */}
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "space-between",
            }}
          >
            <Tile
              icon="checkmark-done"
              color="#10B981"
              label="Tasks completed"
              value={doneTotal}
              delay={0}
            />
            <Tile
              icon="hourglass"
              color="#F59E0B"
              label="Tasks open"
              value={openTotal}
              delay={70}
            />
            <Tile
              icon="document-text"
              color="#EC4899"
              label="Notes written"
              value={notes.length}
              delay={140}
            />
            <Tile
              icon="card"
              color="#6366F1"
              label="Total spent"
              value={totalExpenses}
              prefix="৳"
              delay={210}
            />
          </View>

          {/* reminders */}
          <ChartCard
            title="Upcoming reminders"
            subtitle="Stay ahead of your day"
            icon="notifications"
            iconColor="#D69A28"
            iconBg="#FEF3C7"
            delay={80}
            right={
              !!upcoming.length && (
                <View
                  style={{
                    backgroundColor: "#FEF3C7",
                    borderRadius: 12,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                  }}
                >
                  <Text
                    style={{
                      color: "#B45309",
                      fontWeight: "800",
                      fontSize: 12,
                    }}
                  >
                    {upcoming.length}
                  </Text>
                </View>
              )
            }
          >
            {upcoming.length ? (
              upcoming.map((r) => (
                <View
                  key={r.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "#F8FAFC",
                    borderRadius: 18,
                    padding: 12,
                    marginBottom: 10,
                  }}
                >
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 13,
                      backgroundColor: "#E0E7FF",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    <Ionicons name="alarm-outline" size={19} color="#5267E8" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      numberOfLines={1}
                      style={{ fontWeight: "700", color: "#334155" }}
                    >
                      {r.title}
                    </Text>
                    <Text
                      style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}
                    >
                      {new Date(r.date).toLocaleString()} ·{" "}
                      <Text style={{ color: "#6366F1", fontWeight: "700" }}>
                        {timeUntil(r.date)}
                      </Text>
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => removeReminder(r)}
                    hitSlop={10}
                    style={{ padding: 4 }}
                  >
                    <Ionicons name="close-circle" size={20} color="#FDA4AF" />
                  </Pressable>
                </View>
              ))
            ) : (
              <Text
                style={{ color: "#94A3B8", fontSize: 13, marginBottom: 12 }}
              >
                No upcoming reminders yet.
              </Text>
            )}

            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Reminder title"
              placeholderTextColor="#94A3B8"
              style={{
                backgroundColor: "#F8FAFC",
                borderRadius: 16,
                paddingHorizontal: 16,
                paddingVertical: 13,
                color: "#334155",
                marginBottom: 8,
              }}
            />
            <TextInput
              value={when}
              onChangeText={setWhen}
              placeholder="YYYY-MM-DD HH:MM"
              placeholderTextColor="#94A3B8"
              style={{
                backgroundColor: "#F8FAFC",
                borderRadius: 16,
                paddingHorizontal: 16,
                paddingVertical: 13,
                color: "#334155",
                marginBottom: 8,
              }}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0, marginBottom: 12 }}
            >
              {quickTimes().map((q) => (
                <Pressable
                  key={q.label}
                  onPress={() => setWhen(q.value)}
                  style={{
                    marginRight: 8,
                    borderRadius: 999,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    backgroundColor: when === q.value ? "#4F46E5" : "#EEF2FF",
                  }}
                >
                  <Text
                    style={{
                      fontWeight: "700",
                      fontSize: 12,
                      color: when === q.value ? "#fff" : "#4F46E5",
                    }}
                  >
                    {q.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              onPress={addReminder}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#4F46E5",
                borderRadius: 16,
                padding: 14,
                shadowColor: "#4F46E5",
                shadowOpacity: 0.35,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 5 },
                elevation: 5,
              }}
            >
              <Ionicons name="add" size={19} color="white" />
              <Text style={{ marginLeft: 4, fontWeight: "800", color: "#fff" }}>
                Add reminder
              </Text>
            </Pressable>
          </ChartCard>

          {/* expense breakdown */}
          <ChartCard
            title="Expense breakdown"
            subtitle="Spending by category · all records"
            icon="pie-chart"
            delay={120}
          >
            {pieData.length ? (
              <>
                <View style={{ alignItems: "center", paddingVertical: 6 }}>
                  <PieChart
                    data={pieData}
                    donut
                    isAnimated
                    animationDuration={800}
                    radius={100}
                    innerRadius={66}
                    innerCircleColor="#FFFFFF"
                    showText={false}
                    centerLabelComponent={() => (
                      <View style={{ alignItems: "center" }}>
                        <Text style={{ fontSize: 11, color: "#94A3B8" }}>
                          Total spent
                        </Text>
                        <Text
                          style={{
                            marginTop: 2,
                            fontSize: 18,
                            fontWeight: "800",
                            color: "#1E293B",
                          }}
                        >
                          ৳{totalExpenses.toLocaleString()}
                        </Text>
                      </View>
                    )}
                  />
                </View>
                <View style={{ marginTop: 10 }}>
                  {categoryTotals.map((item, i) => {
                    const pct = totalExpenses ? item.value / totalExpenses : 0;
                    return (
                      <View key={item.name} style={{ marginBottom: 14 }}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            marginBottom: 6,
                          }}
                        >
                          <View
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 5,
                              backgroundColor: item.color,
                              marginRight: 8,
                            }}
                          />
                          <Text
                            style={{
                              flex: 1,
                              fontSize: 13,
                              fontWeight: "600",
                              color: "#475569",
                            }}
                          >
                            {item.name}
                          </Text>
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: "800",
                              color: "#1E293B",
                            }}
                          >
                            ৳{item.value.toLocaleString()}
                          </Text>
                          <Text
                            style={{
                              width: 40,
                              textAlign: "right",
                              fontSize: 12,
                              color: "#94A3B8",
                            }}
                          >
                            {Math.round(pct * 100)}%
                          </Text>
                        </View>
                        <AnimatedBar
                          pct={pct}
                          color={item.color}
                          track="#F1F5F9"
                          height={6}
                          delay={i * 60}
                        />
                      </View>
                    );
                  })}
                </View>
              </>
            ) : (
              <View style={{ alignItems: "center", paddingVertical: 24 }}>
                <Ionicons name="pie-chart-outline" size={34} color="#CBD5E1" />
                <Text
                  style={{
                    marginTop: 8,
                    fontSize: 13,
                    color: "#94A3B8",
                    textAlign: "center",
                  }}
                >
                  Add expenses with categories to see your breakdown.
                </Text>
              </View>
            )}
          </ChartCard>

          {/* monthly expenses */}
          <ChartCard
            title="Monthly expenses (৳)"
            subtitle="Last 6 months"
            icon="bar-chart"
            delay={160}
          >
            <BarChart
              data={monthTotals}
              color="#A5B4FC"
              hi="#4F46E5"
              empty="No expenses recorded yet"
            />
          </ChartCard>

          {/* tasks this week */}
          <ChartCard
            title="Tasks this week"
            subtitle={
              taskView === "done"
                ? "Completed per day"
                : "Still unfinished per day"
            }
            icon="checkmark-done-circle"
            iconColor="#059669"
            iconBg="#D1FAE5"
            delay={200}
          >
            <View style={{ marginBottom: 14 }}>
              <FilterTabs
                value={taskView}
                onChange={setTaskView}
                tabs={[
                  { id: "done", label: "Completed" },
                  { id: "open", label: "Unfinished" },
                ]}
              />
            </View>
            <BarChart
              key={taskView}
              data={taskView === "done" ? doneData : openData}
              color={taskView === "done" ? "#6EE7B7" : "#FCD34D"}
              hi={taskView === "done" ? "#059669" : "#D97706"}
              empty={
                taskView === "done"
                  ? "No tasks completed this week"
                  : "Nothing unfinished — nice!"
              }
            />
          </ChartCard>

          {/* activity */}
          <ChartCard
            title="Activeness"
            subtitle={`Daily activity score · ${activityDays} days`}
            icon="flash"
            iconColor="#DB2777"
            iconBg="#FCE7F3"
            delay={240}
          >
            <View style={{ marginBottom: 14 }}>
              <FilterTabs
                value={String(activityDays)}
                onChange={(v) => setActivityDays(Number(v))}
                tabs={[
                  { id: "7", label: "7 days" },
                  { id: "14", label: "14 days" },
                ]}
              />
            </View>
            <BarChart
              key={activityDays}
              data={activity}
              color="#F9A8D4"
              hi="#DB2777"
              empty="No activity in this window"
            />
          </ChartCard>

          {/* backup */}
          <FadeSlide delay={280}>
            <View style={{ ...card, marginBottom: 32 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 14,
                    backgroundColor: "#EEF2FF",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 12,
                  }}
                >
                  <Ionicons name="shield-checkmark" size={20} color="#5267E8" />
                </View>
                <Text
                  style={{
                    flex: 1,
                    fontWeight: "800",
                    color: "#1E293B",
                    fontSize: 15,
                  }}
                >
                  Your data stays on this device
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 12,
                  lineHeight: 19,
                  color: "#94A3B8",
                  marginBottom: 14,
                }}
              >
                Create a backup before changing devices or reinstalling
                PocketFlow.
              </Text>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Pressable
                  onPress={backup}
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#4F46E5",
                    borderRadius: 16,
                    padding: 14,
                  }}
                >
                  <Ionicons
                    name="cloud-upload-outline"
                    size={18}
                    color="white"
                  />
                  <Text
                    style={{ marginLeft: 8, fontWeight: "800", color: "#fff" }}
                  >
                    Backup
                  </Text>
                </Pressable>
                <Pressable
                  onPress={restore}
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#EEF2FF",
                    borderRadius: 16,
                    padding: 14,
                  }}
                >
                  <Ionicons
                    name="cloud-download-outline"
                    size={18}
                    color="#5267E8"
                  />
                  <Text
                    style={{
                      marginLeft: 8,
                      fontWeight: "800",
                      color: "#4F46E5",
                    }}
                  >
                    Restore
                  </Text>
                </Pressable>
              </View>
            </View>
          </FadeSlide>
        </ScrollView>
      </View>
    </AnimatedScreen>
  );
}
