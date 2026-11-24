import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
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
import { getData, saveData } from "../storage/storage";
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

/* ───────────── helpers ───────────── */

const pad = (n) => String(n).padStart(2, "0");
const fmt = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => fmt(new Date());
const yesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return fmt(d);
};
const monthKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

const EXPENSE = "#F43F5E";
const DEPOSIT = "#10B981";

const EXP_CATS = [
  { n: "Food", e: "🍔" },
  { n: "Transport", e: "🚌" },
  { n: "Shopping", e: "🛍️" },
  { n: "Bills", e: "💡" },
  { n: "Health", e: "💊" },
  { n: "Fun", e: "🎮" },
  { n: "Education", e: "📚" },
  { n: "Other", e: "🏷️" },
];
const DEP_CATS = [
  { n: "Salary", e: "💼" },
  { n: "Freelance", e: "💻" },
  { n: "Gift", e: "🎁" },
  { n: "Savings", e: "🏦" },
  { n: "Other", e: "🏷️" },
];
const catEmoji = (cat, type) => {
  const all = [...EXP_CATS, ...DEP_CATS];
  const hit = all.find((c) => c.n.toLowerCase() === (cat || "").toLowerCase());
  return hit ? hit.e : type === "deposit" ? "💰" : "🧾";
};

const dayLabel = (key) => {
  if (key === today()) return "Today";
  if (key === yesterday()) return "Yesterday";
  const d = new Date(`${key}T00:00:00`);
  if (Number.isNaN(d.getTime())) return key || "No date";
  return d.toLocaleDateString("en", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
};

const money = (n) =>
  `৳${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

/* ───────────── small components ───────────── */

function MonthLabel({ text, dir }) {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    v.setValue(0);
    Animated.timing(v, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [text]);
  return (
    <Animated.Text
      style={{
        fontWeight: "800",
        fontSize: 16,
        color: "#1E293B",
        opacity: v,
        transform: [
          {
            translateX: v.interpolate({
              inputRange: [0, 1],
              outputRange: [dir * 26, 0],
            }),
          },
        ],
      }}
    >
      {text}
    </Animated.Text>
  );
}

function TxRow({ item, index, onPress, onLongPress, onDelete }) {
  const isDep = item.type === "deposit";
  const color = isDep ? DEPOSIT : EXPENSE;
  return (
    <PressScale
      delay={Math.min(index, 12) * 45}
      from={16}
      onPress={onPress}
      onLongPress={onLongPress}
      style={{ marginBottom: 8 }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "#fff",
          borderRadius: 20,
          padding: 12,
          borderWidth: 1,
          borderColor: "#F1F5F9",
          shadowColor: color,
          shadowOpacity: 0.1,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
          elevation: 2,
        }}
      >
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 16,
            backgroundColor: `${color}22`,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 22 }}>
            {catEmoji(item.category, item.type)}
          </Text>
        </View>
        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <Text
            numberOfLines={1}
            style={{ fontWeight: "700", color: "#1E293B", fontSize: 15 }}
          >
            {item.title || item.category || (isDep ? "Deposit" : "Expense")}
          </Text>
          <Text
            numberOfLines={1}
            style={{ color: "#94A3B8", fontSize: 12, marginTop: 2 }}
          >
            {item.category || (isDep ? "Deposit" : "Expense")}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontWeight: "800", fontSize: 16, color }}>
            {isDep ? "+" : "-"}
            {money(item.amount)}
          </Text>
          <Pressable onPress={onDelete} hitSlop={10} style={{ marginTop: 4 }}>
            <Ionicons name="trash-outline" size={15} color="#CBD5E1" />
          </Pressable>
        </View>
      </View>
    </PressScale>
  );
}

function Chip({ label, active, color, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        marginRight: 8,
        marginBottom: 8,
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 9,
        backgroundColor: active ? color : "#F1F5F9",
      }}
    >
      <Text
        style={{
          fontWeight: "700",
          fontSize: 13,
          color: active ? "#fff" : "#475569",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/* ───────────── screen ───────────── */

export default function ExpensesScreen() {
  const insets = useSafeAreaInsets();
  const { show, node: toastNode } = useFxToast(insets.top + 8);

  const [items, setItems] = useState([]);
  const [month, setMonth] = useState(new Date());
  const [dir, setDir] = useState(1);
  const [filter, setFilter] = useState("all");
  const [modal, setModal] = useState(false);
  const [type, setType] = useState("expense");
  const [editing, setEditing] = useState(null);
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(today());

  const itemsRef = useRef([]);
  itemsRef.current = items;

  useEffect(() => {
    getData("transactions", []).then((data) =>
      setItems(Array.isArray(data) ? data : []),
    );
  }, []);

  const visible = useMemo(
    () => items.filter((x) => x.date?.slice(0, 7) === monthKey(month)),
    [items, month],
  );
  const spent = visible
    .filter((x) => x.type === "expense")
    .reduce((s, x) => s + Number(x.amount || 0), 0);
  const deposited = visible
    .filter((x) => x.type === "deposit")
    .reduce((s, x) => s + Number(x.amount || 0), 0);
  const balance = items.reduce(
    (s, x) => s + (x.type === "deposit" ? 1 : -1) * Number(x.amount || 0),
    0,
  );
  const ratio = deposited > 0 ? spent / deposited : spent > 0 ? 1 : 0;

  const tabs = [
    { id: "all", label: "All", count: visible.length },
    {
      id: "expense",
      label: "Expenses",
      count: visible.filter((x) => x.type === "expense").length,
    },
    {
      id: "deposit",
      label: "Deposits",
      count: visible.filter((x) => x.type === "deposit").length,
    },
  ];

  const groups = useMemo(() => {
    const list = visible
      .filter((x) => filter === "all" || x.type === filter)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const map = new Map();
    list.forEach((x) => {
      const k = x.date || "";
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(x);
    });
    return [...map.entries()].map(([key, rows]) => ({
      key,
      rows,
      net: rows.reduce(
        (s, x) => s + (x.type === "deposit" ? 1 : -1) * Number(x.amount || 0),
        0,
      ),
    }));
  }, [visible, filter]);

  const persist = async (next) => {
    setItems(next);
    await saveData("transactions", next);
  };

  const openForm = (nextType, item = null) => {
    setType(item?.type || nextType);
    setEditing(item);
    setAmount(item ? String(item.amount) : "");
    setTitle(item?.title || "");
    setCategory(item?.category || "");
    setDate(item?.date || today());
    setModal(true);
  };

  const submit = async () => {
    if (!Number(amount) || Number(amount) <= 0)
      return Alert.alert("Check amount", "Enter an amount greater than zero.");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number.isNaN(new Date(`${date}T00:00:00`).getTime())
    )
      return Alert.alert("Check date", "Use the format YYYY-MM-DD.");
    const record = {
      id: editing?.id || String(Date.now()),
      type,
      amount: Number(amount),
      title: title.trim(),
      category: category.trim(),
      date,
    };
    ease();
    await persist(
      editing
        ? items.map((x) => (x.id === editing.id ? record : x))
        : [record, ...items],
    );
    setModal(false);
    // jump to the month of the saved record so it's visible right away
    const [y, m] = date.split("-").map(Number);
    if (monthKey(month) !== `${y}-${pad(m)}`) setMonth(new Date(y, m - 1, 1));
    show(
      editing
        ? "Transaction updated ✨"
        : type === "expense"
          ? "Expense saved 💸"
          : "Deposit saved 💰",
      editing ? "info" : "success",
    );
  };

  const deleteItem = (item) => {
    const cur = itemsRef.current;
    const at = cur.findIndex((x) => x.id === item.id);
    ease();
    persist(cur.filter((x) => x.id !== item.id));
    show("Transaction deleted", "danger", () => {
      const latest = [...itemsRef.current];
      latest.splice(Math.min(at, latest.length), 0, item);
      ease();
      persist(latest);
      show("Transaction restored", "info");
    });
  };

  const shiftMonth = (n) => {
    setDir(n);
    ease();
    setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  };

  const cats = type === "expense" ? EXP_CATS : DEP_CATS;
  const accent = type === "expense" ? EXPENSE : DEPOSIT;
  let rowIndex = 0;

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
        >
          {/* header */}
          <FadeSlide from={-12}>
            <View className="mb-4 flex-row items-center justify-between">
              <View>
                <Text className="text-xs font-bold uppercase tracking-[2px] text-indigo-500">
                  POCKETFLOW · FINANCE
                </Text>
                <Text className="mt-1 text-2xl font-extrabold text-slate-800">
                  Your money
                </Text>
              </View>
              <View className="h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100">
                <Ionicons name="wallet" size={23} color="#5267E8" />
              </View>
            </View>
          </FadeSlide>

          {/* hero */}
          <FadeSlide delay={60}>
            <View
              style={{
                borderRadius: 28,
                padding: 20,
                backgroundColor: "#4F46E5",
                overflow: "hidden",
                shadowColor: "#4F46E5",
                shadowOpacity: 0.45,
                shadowRadius: 18,
                shadowOffset: { width: 0, height: 12 },
                elevation: 10,
              }}
            >
              <View
                style={{
                  position: "absolute",
                  right: -40,
                  top: -50,
                  width: 160,
                  height: 160,
                  borderRadius: 80,
                  backgroundColor: "rgba(255,255,255,0.10)",
                }}
              />
              <View
                style={{
                  position: "absolute",
                  left: -30,
                  bottom: -60,
                  width: 140,
                  height: 140,
                  borderRadius: 70,
                  backgroundColor: "rgba(236,72,153,0.28)",
                }}
              />

              <Text
                style={{
                  color: "#C7D2FE",
                  fontSize: 12,
                  fontWeight: "700",
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                }}
              >
                Total balance
              </Text>
              <CountUp
                value={balance}
                prefix="৳"
                style={{
                  color: "#fff",
                  fontSize: 38,
                  fontWeight: "800",
                  marginTop: 2,
                }}
              />

              <View style={{ flexDirection: "row", marginTop: 16, gap: 10 }}>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: "rgba(255,255,255,0.16)",
                    borderRadius: 18,
                    padding: 12,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        backgroundColor: "#FB7185",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="arrow-up" size={13} color="#fff" />
                    </View>
                    <Text
                      style={{
                        color: "#E0E7FF",
                        fontSize: 11,
                        marginLeft: 6,
                        fontWeight: "600",
                      }}
                    >
                      Month spent
                    </Text>
                  </View>
                  <CountUp
                    value={spent}
                    prefix="৳"
                    style={{
                      color: "#fff",
                      fontSize: 18,
                      fontWeight: "800",
                      marginTop: 6,
                    }}
                  />
                </View>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: "rgba(255,255,255,0.16)",
                    borderRadius: 18,
                    padding: 12,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        backgroundColor: "#34D399",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="arrow-down" size={13} color="#fff" />
                    </View>
                    <Text
                      style={{
                        color: "#E0E7FF",
                        fontSize: 11,
                        marginLeft: 6,
                        fontWeight: "600",
                      }}
                    >
                      Deposited
                    </Text>
                  </View>
                  <CountUp
                    value={deposited}
                    prefix="৳"
                    style={{
                      color: "#fff",
                      fontSize: 18,
                      fontWeight: "800",
                      marginTop: 6,
                    }}
                  />
                </View>
              </View>

              <View style={{ marginTop: 14 }}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <Text
                    style={{
                      color: "#C7D2FE",
                      fontSize: 11,
                      fontWeight: "600",
                    }}
                  >
                    Spent vs deposited this month
                  </Text>
                  <Text
                    style={{
                      color: ratio > 1 ? "#FDA4AF" : "#FDE047",
                      fontSize: 11,
                      fontWeight: "800",
                    }}
                  >
                    {Math.round(ratio * 100)}%
                  </Text>
                </View>
                <AnimatedBar
                  pct={Math.min(1, ratio)}
                  color={ratio > 1 ? "#FB7185" : "#FDE047"}
                />
              </View>
            </View>
          </FadeSlide>

          {/* month switcher */}
          <FadeSlide delay={110}>
            <View
              className="my-4 flex-row items-center justify-between rounded-2xl bg-white p-3"
              style={{
                elevation: 2,
                shadowColor: "#6366F1",
                shadowOpacity: 0.1,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 3 },
              }}
            >
              <Pressable
                onPress={() => shiftMonth(-1)}
                className="h-9 w-9 items-center justify-center rounded-xl bg-indigo-50"
              >
                <Ionicons name="chevron-back" size={19} color="#5267E8" />
              </Pressable>
              <MonthLabel
                dir={dir}
                text={month.toLocaleDateString("en", {
                  month: "long",
                  year: "numeric",
                })}
              />
              <Pressable
                onPress={() => shiftMonth(1)}
                className="h-9 w-9 items-center justify-center rounded-xl bg-indigo-50"
              >
                <Ionicons name="chevron-forward" size={19} color="#5267E8" />
              </Pressable>
            </View>
          </FadeSlide>

          {/* add buttons */}
          <FadeSlide delay={160}>
            <View className="mb-5 flex-row gap-3">
              <Pressable
                onPress={() => openForm("expense")}
                className="flex-1 flex-row items-center justify-center rounded-2xl p-4"
                style={{
                  backgroundColor: EXPENSE,
                  shadowColor: EXPENSE,
                  shadowOpacity: 0.4,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 6,
                }}
              >
                <Ionicons
                  name="remove-circle-outline"
                  size={19}
                  color="white"
                />
                <Text className="ml-2 font-bold text-white">Add Expense</Text>
              </Pressable>
              <Pressable
                onPress={() => openForm("deposit")}
                className="flex-1 flex-row items-center justify-center rounded-2xl p-4"
                style={{
                  backgroundColor: DEPOSIT,
                  shadowColor: DEPOSIT,
                  shadowOpacity: 0.4,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 6,
                }}
              >
                <Ionicons name="add-circle-outline" size={19} color="white" />
                <Text className="ml-2 font-bold text-white">Add Deposit</Text>
              </Pressable>
            </View>
          </FadeSlide>

          {/* activity */}
          <Text className="mb-3 text-lg font-extrabold text-slate-800">
            Recent activity
          </Text>
          <View className="mb-4">
            <FilterTabs value={filter} onChange={setFilter} tabs={tabs} />
          </View>

          {groups.length ? (
            groups.map((g) => (
              <View key={g.key} className="mb-2">
                <View className="mb-2 mt-1 flex-row items-center justify-between px-1">
                  <Text className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    {dayLabel(g.key)}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "800",
                      color: g.net >= 0 ? DEPOSIT : EXPENSE,
                    }}
                  >
                    {g.net >= 0 ? "+" : "-"}
                    {money(Math.abs(g.net))}
                  </Text>
                </View>
                {g.rows.map((item) => (
                  <TxRow
                    key={item.id}
                    item={item}
                    index={rowIndex++}
                    onPress={() => openForm(item.type, item)}
                    onLongPress={() => deleteItem(item)}
                    onDelete={() => deleteItem(item)}
                  />
                ))}
              </View>
            ))
          ) : (
            <FadeSlide>
              <View className="items-center rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-10">
                <Text style={{ fontSize: 42 }}>
                  {filter === "deposit" ? "🏦" : "🧾"}
                </Text>
                <Text className="mt-3 font-bold text-slate-700">
                  Nothing here yet
                </Text>
                <Text className="mt-1 text-center text-sm text-slate-400">
                  Add an expense or deposit to start tracking this month.
                </Text>
              </View>
            </FadeSlide>
          )}

          {!!groups.length && (
            <Text className="mb-3 mt-4 text-center text-xs text-slate-400">
              Tap to edit · Hold to delete (with undo)
            </Text>
          )}
        </ScrollView>

        {/* form sheet */}
        <Modal
          visible={modal}
          transparent
          animationType="slide"
          onRequestClose={() => setModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1 }}
          >
            <Pressable
              style={{
                flex: 1,
                justifyContent: "flex-end",
                backgroundColor: "rgba(0,0,0,0.45)",
              }}
              onPress={() => setModal(false)}
            >
              <Pressable
                onPress={() => {}}
                style={{
                  borderTopLeftRadius: 32,
                  borderTopRightRadius: 32,
                  backgroundColor: "#fff",
                  padding: 20,
                  paddingBottom: Math.max(insets.bottom, 20),
                }}
              >
                <View className="mb-4 h-1.5 w-12 self-center rounded-full bg-slate-200" />

                <View className="mb-4 flex-row items-center justify-between">
                  <Text className="text-xl font-extrabold text-slate-800">
                    {editing ? "Edit" : "New"} transaction
                  </Text>
                  <Pressable
                    onPress={() => setModal(false)}
                    className="h-9 w-9 items-center justify-center rounded-full bg-slate-100"
                  >
                    <Ionicons name="close" size={20} color="#64748B" />
                  </Pressable>
                </View>

                {/* type toggle */}
                <View className="mb-4 flex-row rounded-2xl bg-slate-100 p-1">
                  {["expense", "deposit"].map((t) => {
                    const on = type === t;
                    return (
                      <Pressable
                        key={t}
                        onPress={() => {
                          ease();
                          setType(t);
                          setCategory("");
                        }}
                        style={{
                          flex: 1,
                          alignItems: "center",
                          paddingVertical: 11,
                          borderRadius: 14,
                          backgroundColor: on
                            ? t === "expense"
                              ? EXPENSE
                              : DEPOSIT
                            : "transparent",
                        }}
                      >
                        <Text
                          style={{
                            fontWeight: "800",
                            color: on ? "#fff" : "#64748B",
                            textTransform: "capitalize",
                          }}
                        >
                          {t}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View className="mb-2 flex-row items-center rounded-2xl bg-slate-50 px-4">
                  <Text
                    style={{ fontSize: 24, fontWeight: "800", color: accent }}
                  >
                    ৳
                  </Text>
                  <TextInput
                    value={amount}
                    onChangeText={setAmount}
                    autoFocus
                    placeholder="0"
                    placeholderTextColor="#CBD5E1"
                    keyboardType="decimal-pad"
                    style={{
                      flex: 1,
                      marginLeft: 8,
                      paddingVertical: 16,
                      fontSize: 26,
                      fontWeight: "800",
                      color: "#1E293B",
                    }}
                  />
                </View>
                <View className="mb-3 flex-row">
                  {[100, 500, 1000].map((n) => (
                    <Chip
                      key={n}
                      label={`+${n}`}
                      color={accent}
                      onPress={() =>
                        setAmount(String((Number(amount) || 0) + n))
                      }
                    />
                  ))}
                </View>

                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="What for / how?"
                  placeholderTextColor="#94A3B8"
                  className="mb-3 rounded-2xl bg-slate-50 px-4 py-3.5 text-slate-800"
                />

                <View className="flex-row flex-wrap">
                  {cats.map((c) => (
                    <Chip
                      key={c.n}
                      label={`${c.e} ${c.n}`}
                      color={accent}
                      active={category.toLowerCase() === c.n.toLowerCase()}
                      onPress={() => setCategory(c.n)}
                    />
                  ))}
                </View>
                <TextInput
                  value={category}
                  onChangeText={setCategory}
                  placeholder="Category (pick above or type your own)"
                  placeholderTextColor="#94A3B8"
                  className="mb-3 rounded-2xl bg-slate-50 px-4 py-3.5 text-slate-800"
                />

                <View className="mb-4 flex-row items-center" style={{ gap: 8 }}>
                  <TextInput
                    value={date}
                    onChangeText={setDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94A3B8"
                    className="flex-1 rounded-2xl bg-slate-50 px-4 py-3.5 text-slate-800"
                  />
                  <Chip
                    label="Today"
                    color={accent}
                    active={date === today()}
                    onPress={() => setDate(today())}
                  />
                  <Chip
                    label="Yesterday"
                    color={accent}
                    active={date === yesterday()}
                    onPress={() => setDate(yesterday())}
                  />
                </View>

                <View className="flex-row gap-3">
                  <Pressable
                    onPress={() => setModal(false)}
                    className="flex-1 rounded-2xl bg-slate-100 p-4"
                  >
                    <Text className="text-center font-bold text-slate-600">
                      Cancel
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={submit}
                    className="flex-1 rounded-2xl p-4"
                    style={{
                      backgroundColor: accent,
                      shadowColor: accent,
                      shadowOpacity: 0.4,
                      shadowRadius: 10,
                      shadowOffset: { width: 0, height: 5 },
                      elevation: 5,
                    }}
                  >
                    <Text className="text-center font-bold text-white">
                      Save transaction
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
