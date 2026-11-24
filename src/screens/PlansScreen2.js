import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Image,
  LayoutAnimation,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AnimatedScreen from "../components/AnimatedScreen";
import { useToast } from "../components/Toast";
import * as ImagePicker from "expo-image-picker";
import { getData, saveData } from "../storage/storage";
import ThemePicker, { NOTE_THEMES } from "../components/ThemePicker";

/* ───────────── helpers ───────────── */

const localDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const TAGS = [
  { id: "idea", label: "💡 Idea" },
  { id: "work", label: "💼 Work" },
  { id: "goal", label: "🎯 Goal" },
  { id: "personal", label: "🌿 Personal" },
  { id: "urgent", label: "🔥 Urgent" },
];

const FILTERS = [
  { id: "all", label: "All", icon: "grid-outline" },
  { id: "pinned", label: "Pinned", icon: "pin-outline" },
  { id: "lists", label: "Checklists", icon: "checkbox-outline" },
  { id: "images", label: "Images", icon: "image-outline" },
];

const getTheme = (id) => NOTE_THEMES.find((x) => x.id === id) || NOTE_THEMES[0];
const isDarkTheme = (id) => id === "midnight";
const ease = () =>
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

const isWide = (n) =>
  !!n.pinned || (n.images?.length || 0) >= 2 || (n.checklist?.length || 0) >= 4;

const estimateHeight = (n) =>
  110 +
  Math.min((n.body || "").length, 140) * 0.55 +
  Math.min(n.checklist?.length || 0, 3) * 22 +
  (n.checklist?.length ? 18 : 0) +
  (n.images?.length ? 84 : 0);

/* ───────────── small animated pieces ───────────── */

function FadeSlide({ children, delay = 0, from = 18, style }) {
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

function Pop({ children, delay = 0, style, onPress, onLongPress }) {
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
  const to = (val) =>
    Animated.spring(press, {
      toValue: val,
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
              scale: Animated.multiply(
                enter.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.85, 1],
                }),
                press,
              ),
            },
            {
              translateY: enter.interpolate({
                inputRange: [0, 1],
                outputRange: [24, 0],
              }),
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

function ProgressBar({ done, total, color, dark }) {
  const v = useRef(new Animated.Value(0)).current;
  const pct = total ? done / total : 0;
  useEffect(() => {
    Animated.timing(v, {
      toValue: pct,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct]);
  return (
    <View
      style={{
        height: 6,
        borderRadius: 3,
        overflow: "hidden",
        backgroundColor: dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.08)",
      }}
    >
      <Animated.View
        style={{
          height: 6,
          borderRadius: 3,
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

function Chip({ label, active, onPress, color, icon }) {
  return (
    <Pressable
      onPress={onPress}
      className="mr-2 flex-row items-center rounded-full px-3 py-2"
      style={{
        backgroundColor: active ? color : "rgba(255,255,255,0.85)",
        borderWidth: 1,
        borderColor: active ? color : "rgba(0,0,0,0.06)",
      }}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={14}
          color={active ? "#fff" : "#64748b"}
          style={{ marginRight: 5 }}
        />
      ) : null}
      <Text
        style={{
          color: active ? "#fff" : "#475569",
          fontWeight: "600",
          fontSize: 12,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/* ───────────── bento card ───────────── */

function BentoCard({ note, width, index, onPress, onLongPress }) {
  const t = getTheme(note.theme);
  const dark = isDarkTheme(note.theme);
  const wide = isWide(note);
  const textMain = dark ? "#fff" : "#1e293b";
  const textSoft = dark ? "rgba(255,255,255,0.75)" : "#475569";
  const list = note.checklist || [];
  const done = list.filter((c) => c.done).length;
  const imgs = note.images || [];
  const tags = (note.tags || [])
    .map((id) => TAGS.find((x) => x.id === id))
    .filter(Boolean);

  return (
    <Pop
      delay={Math.min(index, 10) * 70}
      onPress={onPress}
      onLongPress={onLongPress}
      style={{
        width,
        marginBottom: 12,
        borderRadius: 24,
        backgroundColor: t.bg,
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.05)",
        shadowColor: t.accent,
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4,
      }}
    >
      <View style={{ padding: 14 }}>
        <View className="flex-row items-start justify-between">
          <Text
            numberOfLines={2}
            style={{
              flex: 1,
              color: t.accent,
              fontWeight: "800",
              fontSize: wide ? 19 : 16,
              fontFamily: t.font,
            }}
          >
            {note.title || "Untitled"}
          </Text>
          <View className="ml-2 flex-row items-center">
            {!!note.secret && (
              <Ionicons
                name="lock-closed"
                size={13}
                color={t.accent}
                style={{ marginRight: 4 }}
              />
            )}
            {!!note.pinned && (
              <Ionicons name="pin" size={15} color={t.accent} />
            )}
          </View>
        </View>

        {!!note.body && (
          <Text
            numberOfLines={wide ? 3 : 4}
            style={{
              color: textSoft,
              marginTop: 6,
              fontSize: 13,
              lineHeight: 18,
            }}
          >
            {note.body}
          </Text>
        )}

        {list.length > 0 && (
          <View style={{ marginTop: 10 }}>
            {list.slice(0, wide ? 4 : 3).map((c) => (
              <Text
                key={c.id}
                numberOfLines={1}
                style={{
                  color: textSoft,
                  fontSize: 12,
                  marginBottom: 3,
                  textDecorationLine: c.done ? "line-through" : "none",
                  opacity: c.done ? 0.55 : 1,
                }}
              >
                {c.done ? "☑" : "□"} {c.text}
              </Text>
            ))}
            <View style={{ marginTop: 4 }}>
              <ProgressBar
                done={done}
                total={list.length}
                color={t.accent}
                dark={dark}
              />
              <Text style={{ color: textSoft, fontSize: 10, marginTop: 3 }}>
                {done}/{list.length} done
              </Text>
            </View>
          </View>
        )}

        {imgs.length > 0 && (
          <View className="mt-3 flex-row" style={{ gap: 6 }}>
            {imgs.slice(0, wide ? 3 : 1).map((uri, i) => (
              <Image
                key={`${uri}-${i}`}
                source={{ uri }}
                style={{ flex: 1, height: wide ? 90 : 78, borderRadius: 14 }}
              />
            ))}
            {imgs.length > (wide ? 3 : 1) && (
              <View
                style={{
                  width: 40,
                  height: wide ? 90 : 78,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(0,0,0,0.12)",
                }}
              >
                <Text
                  style={{ color: textMain, fontWeight: "700", fontSize: 12 }}
                >
                  +{imgs.length - (wide ? 3 : 1)}
                </Text>
              </View>
            )}
          </View>
        )}

        <View className="mt-3 flex-row flex-wrap items-center">
          {tags.slice(0, 2).map((tag) => (
            <View
              key={tag.id}
              style={{
                backgroundColor: "rgba(255,255,255,0.55)",
                borderRadius: 10,
                paddingHorizontal: 7,
                paddingVertical: 2,
                marginRight: 5,
                marginBottom: 3,
              }}
            >
              <Text
                style={{ fontSize: 10, color: "#334155", fontWeight: "600" }}
              >
                {tag.label}
              </Text>
            </View>
          ))}
          <Text style={{ color: textSoft, fontSize: 10, marginLeft: "auto" }}>
            {note.createdAt}
          </Text>
        </View>
      </View>
    </Pop>
  );
}

/* ───────────── main screen ───────────── */

export default function PlansScreen() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { width: screenW } = useWindowDimensions();

  const [notes, setNotes] = useState([]);
  const [active, setActive] = useState(null);
  const [initial, setInitial] = useState("");
  const [secretVisible, setSecretVisible] = useState(false);
  const [viewer, setViewer] = useState(null);
  const [imageColumns, setImageColumns] = useState(3);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [focusId, setFocusId] = useState(null);

  useEffect(() => {
    getData("notes", []).then(setNotes);
  }, []);

  const persist = (next) => {
    setNotes(next);
    saveData("notes", next);
  };

  const blank = () => ({
    id: String(Date.now()),
    title: "",
    body: "",
    theme: "grid",
    checklist: [],
    images: [],
    secret: "",
    tags: [],
    pinned: false,
    createdAt: localDate(),
  });

  const open = (note) => {
    const next = note ? { tags: [], pinned: false, ...note } : blank();
    setActive(next);
    setInitial(note ? JSON.stringify(next) : "");
    setSecretVisible(false);
    setFocusId(null);
  };

  const update = (patch) => setActive((cur) => ({ ...cur, ...patch }));
  const updateAnimated = (patch) => {
    ease();
    update(patch);
  };

  const dirty = active && JSON.stringify(active) !== initial;

  const save = () => {
    const toSave = { ...active, title: active.title.trim() || "Untitled" };
    persist(
      notes.some((n) => n.id === toSave.id)
        ? notes.map((n) => (n.id === toSave.id ? toSave : n))
        : [toSave, ...notes],
    );
    ease();
    setActive(null);
    toast("Note saved");
  };

  const close = () => {
    if (!dirty) {
      ease();
      return setActive(null);
    }
    Alert.alert("Unsaved changes", "Save this note before leaving?", [
      { text: "Keep editing", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => {
          ease();
          setActive(null);
        },
      },
      { text: "Save", onPress: save },
    ]);
  };

  const removeNote = (id) =>
    Alert.alert("Delete note?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          ease();
          persist(notes.filter((n) => n.id !== id));
          setActive(null);
          toast("Note deleted");
        },
      },
    ]);

  const duplicate = () => {
    const copy = {
      ...active,
      id: String(Date.now()),
      title: `${active.title || "Untitled"} (copy)`,
      pinned: false,
      createdAt: localDate(),
    };
    persist([copy, ...notes]);
    setActive(null);
    toast("Note duplicated");
  };

  const quickPin = (note) => {
    ease();
    persist(
      notes.map((n) => (n.id === note.id ? { ...n, pinned: !n.pinned } : n)),
    );
    toast(note.pinned ? "Unpinned" : "Pinned");
  };

  const addChecklist = () => {
    const id = String(Date.now());
    setFocusId(id);
    updateAnimated({
      checklist: [...(active.checklist || []), { id, text: "", done: false }],
    });
  };

  const addImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted)
      return Alert.alert(
        "Permission needed",
        "Allow photo access to add note images.",
      );
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (!result.canceled)
      updateAnimated({
        images: [...(active.images || []), result.assets[0].uri],
      });
  };

  const removeImage = (index) =>
    Alert.alert("Remove image?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () =>
          updateAnimated({
            images: active.images.filter((_, i) => i !== index),
          }),
      },
    ]);

  const toggleTag = (id) => {
    const tags = active.tags || [];
    updateAnimated({
      tags: tags.includes(id) ? tags.filter((t) => t !== id) : [...tags, id],
    });
  };

  /* ───── derived list data ───── */

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes
      .filter((n) => {
        if (filter === "pinned" && !n.pinned) return false;
        if (filter === "lists" && !n.checklist?.length) return false;
        if (filter === "images" && !n.images?.length) return false;
        if (!q) return true;
        return (
          (n.title || "").toLowerCase().includes(q) ||
          (n.body || "").toLowerCase().includes(q) ||
          (n.tags || []).some((t) => t.includes(q))
        );
      })
      .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
  }, [notes, query, filter]);

  // Bento: narrow notes flow into 2 balanced columns; "wide" notes span the full row.
  const blocks = useMemo(() => {
    const out = [];
    let left = [],
      right = [],
      lh = 0,
      rh = 0;
    const flush = () => {
      if (left.length || right.length) out.push({ type: "cols", left, right });
      left = [];
      right = [];
      lh = 0;
      rh = 0;
    };
    visible.forEach((n) => {
      if (isWide(n)) {
        flush();
        out.push({ type: "wide", note: n });
      } else if (lh <= rh) {
        left.push(n);
        lh += estimateHeight(n);
      } else {
        right.push(n);
        rh += estimateHeight(n);
      }
    });
    flush();
    return out;
  }, [visible]);

  const gap = 12;
  const pad = 16;
  const fullW = screenW - pad * 2;
  const colW = (fullW - gap) / 2;
  const indexOf = (n) => visible.findIndex((x) => x.id === n.id);

  /* ───────────── LIST VIEW ───────────── */

  if (!active) {
    return (
      <AnimatedScreen>
        <View
          className="flex-1 bg-[#F5F7FB]"
          style={{ paddingTop: insets.top + 12, paddingHorizontal: pad }}
        >
          <FadeSlide from={-12}>
            <View className="mb-3 flex-row items-center justify-between">
              <View>
                <Text className="text-xs font-bold uppercase tracking-[2px] text-indigo-500">
                  IDEAS & PROJECTS
                </Text>
                <Text className="mt-1 text-2xl font-extrabold text-slate-800">
                  Plans & notes
                </Text>
                <Text className="text-xs text-slate-400">
                  {notes.length} {notes.length === 1 ? "note" : "notes"} ·{" "}
                  {notes.filter((n) => n.pinned).length} pinned
                </Text>
              </View>
              <Pressable
                onPress={() => open(null)}
                className="flex-row items-center rounded-2xl bg-indigo-600 px-4 py-3"
                style={{
                  shadowColor: "#4f46e5",
                  shadowOpacity: 0.35,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 5 },
                  elevation: 6,
                }}
              >
                <Ionicons name="add" size={18} color="white" />
                <Text className="ml-1 font-bold text-white">New note</Text>
              </Pressable>
            </View>

            <View
              className="mb-3 flex-row items-center rounded-2xl bg-white px-3"
              style={{ elevation: 1 }}
            >
              <Ionicons name="search" size={16} color="#94a3b8" />
              <TextInput
                value={query}
                onChangeText={(v) => {
                  ease();
                  setQuery(v);
                }}
                placeholder="Search notes, tags…"
                placeholderTextColor="#94a3b8"
                className="flex-1 px-2 py-3 text-slate-700"
              />
              {!!query && (
                <Pressable onPress={() => setQuery("")}>
                  <Ionicons name="close-circle" size={18} color="#cbd5e1" />
                </Pressable>
              )}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0, marginBottom: 12 }}
            >
              {FILTERS.map((f) => (
                <Chip
                  key={f.id}
                  label={f.label}
                  icon={f.icon}
                  color="#4f46e5"
                  active={filter === f.id}
                  onPress={() => {
                    ease();
                    setFilter(f.id);
                  }}
                />
              ))}
            </ScrollView>
          </FadeSlide>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          >
            {blocks.map((b, bi) =>
              b.type === "wide" ? (
                <BentoCard
                  key={b.note.id}
                  note={b.note}
                  width={fullW}
                  index={indexOf(b.note)}
                  onPress={() => open(b.note)}
                  onLongPress={() => quickPin(b.note)}
                />
              ) : (
                <View key={`cols-${bi}`} className="flex-row" style={{ gap }}>
                  {[b.left, b.right].map((col, ci) => (
                    <View key={ci} style={{ width: colW }}>
                      {col.map((n) => (
                        <BentoCard
                          key={n.id}
                          note={n}
                          width={colW}
                          index={indexOf(n)}
                          onPress={() => open(n)}
                          onLongPress={() => quickPin(n)}
                        />
                      ))}
                    </View>
                  ))}
                </View>
              ),
            )}

            {!visible.length && (
              <FadeSlide>
                <View className="items-center py-16">
                  <Text style={{ fontSize: 44 }}>
                    {notes.length ? "🔍" : "📝"}
                  </Text>
                  <Text className="mt-3 text-base font-bold text-slate-600">
                    {notes.length ? "Nothing matches" : "No notes yet"}
                  </Text>
                  <Text className="mt-1 text-center text-slate-400">
                    {notes.length
                      ? "Try another search or filter."
                      : "Your notes and project plans live here."}
                  </Text>
                </View>
              </FadeSlide>
            )}
            {!!visible.length && (
              <Text className="mt-2 text-center text-xs text-slate-400">
                Long-press a note to pin it
              </Text>
            )}
          </ScrollView>
        </View>
      </AnimatedScreen>
    );
  }

  /* ───────────── EDITOR VIEW ───────────── */

  const theme = getTheme(active.theme);
  const dark = isDarkTheme(active.theme);
  const checklist = active.checklist || [];
  const doneCount = checklist.filter((c) => c.done).length;
  const words = (active.body || "").trim()
    ? active.body.trim().split(/\s+/).length
    : 0;
  const isExisting = notes.some((n) => n.id === active.id);
  const glass = dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.78)";
  const inkSoft = dark ? "#fff" : "#263247";

  return (
    <AnimatedScreen>
      <View
        className="flex-1 px-4"
        style={{ backgroundColor: theme.bg, paddingTop: insets.top + 12 }}
      >
        <FadeSlide from={-10}>
          <View className="mb-3 flex-row items-center justify-between">
            <Pressable onPress={close} className="flex-row items-center">
              <Ionicons name="chevron-back" size={18} color={theme.accent} />
              <Text style={{ color: theme.accent }} className="font-semibold">
                Notes
              </Text>
            </Pressable>
            <View className="flex-row items-center">
              <Pressable
                onPress={() => updateAnimated({ pinned: !active.pinned })}
                className="px-2"
              >
                <Ionicons
                  name={active.pinned ? "pin" : "pin-outline"}
                  size={20}
                  color={theme.accent}
                />
              </Pressable>
              {isExisting && (
                <>
                  <Pressable onPress={duplicate} className="px-2">
                    <Ionicons
                      name="copy-outline"
                      size={20}
                      color={theme.accent}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => removeNote(active.id)}
                    className="px-2"
                  >
                    <Ionicons name="trash-outline" size={20} color="#e11d48" />
                  </Pressable>
                </>
              )}
              <Pressable
                onPress={save}
                className="ml-2 rounded-xl px-4 py-2"
                style={{
                  backgroundColor: theme.accent,
                  opacity: dirty || !isExisting ? 1 : 0.55,
                }}
              >
                <Text className="font-bold text-white">Save</Text>
              </Pressable>
            </View>
          </View>
        </FadeSlide>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        >
          <FadeSlide delay={60}>
            <TextInput
              value={active.title}
              onChangeText={(title) => update({ title })}
              placeholder="Note title"
              placeholderTextColor={theme.accent}
              className="mb-2 text-3xl font-extrabold"
              style={{ color: theme.accent, fontFamily: theme.font }}
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0, marginBottom: 10 }}
            >
              {TAGS.map((tg) => (
                <Chip
                  key={tg.id}
                  label={tg.label}
                  color={theme.accent}
                  active={(active.tags || []).includes(tg.id)}
                  onPress={() => toggleTag(tg.id)}
                />
              ))}
            </ScrollView>

            <ThemePicker
              value={active.theme}
              onChange={(th) => updateAnimated({ theme: th })}
            />
          </FadeSlide>

          <FadeSlide delay={120}>
            <TextInput
              value={active.body}
              onChangeText={(body) => update({ body })}
              placeholder="Write your thoughts…"
              placeholderTextColor={dark ? "rgba(255,255,255,0.5)" : "#94a3b8"}
              multiline
              textAlignVertical="top"
              className="mt-3 min-h-48 rounded-3xl p-4 text-base"
              style={{ backgroundColor: glass, color: inkSoft, lineHeight: 22 }}
            />
            <Text
              style={{
                color: theme.accent,
                opacity: 0.7,
                fontSize: 11,
                marginTop: 6,
                marginLeft: 6,
              }}
            >
              {words} {words === 1 ? "word" : "words"} ·{" "}
              {(active.body || "").length} chars · created {active.createdAt}
            </Text>
          </FadeSlide>

          <FadeSlide delay={180}>
            <View className="my-4 flex-row" style={{ gap: 8 }}>
              <Pressable
                onPress={addChecklist}
                className="flex-1 flex-row items-center justify-center rounded-2xl p-3"
                style={{ backgroundColor: glass }}
              >
                <Ionicons
                  name="checkbox-outline"
                  size={16}
                  color={theme.accent}
                />
                <Text
                  className="ml-2 font-semibold"
                  style={{ color: theme.accent }}
                >
                  Checklist
                </Text>
              </Pressable>
              <Pressable
                onPress={addImage}
                className="flex-1 flex-row items-center justify-center rounded-2xl p-3"
                style={{ backgroundColor: glass }}
              >
                <Ionicons name="image-outline" size={16} color={theme.accent} />
                <Text
                  className="ml-2 font-semibold"
                  style={{ color: theme.accent }}
                >
                  Image
                </Text>
              </Pressable>
            </View>
          </FadeSlide>

          {checklist.length > 0 && (
            <View
              className="mb-3 rounded-3xl p-3"
              style={{ backgroundColor: glass }}
            >
              <View className="mb-2 flex-row items-center justify-between px-1">
                <Text className="font-bold" style={{ color: theme.accent }}>
                  Checklist
                </Text>
                <Text style={{ color: theme.accent, fontSize: 12 }}>
                  {doneCount}/{checklist.length}
                </Text>
              </View>
              <View className="mb-3 px-1">
                <ProgressBar
                  done={doneCount}
                  total={checklist.length}
                  color={theme.accent}
                  dark={dark}
                />
              </View>
              {checklist.map((item, index) => (
                <FadeSlide key={item.id} from={8}>
                  <View
                    className="mb-2 flex-row items-center rounded-xl p-2"
                    style={{
                      backgroundColor: dark
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(255,255,255,0.9)",
                    }}
                  >
                    <Pressable
                      onPress={() =>
                        updateAnimated({
                          checklist: checklist.map((x, i) =>
                            i === index ? { ...x, done: !x.done } : x,
                          ),
                        })
                      }
                      className="px-2"
                    >
                      <Ionicons
                        name={item.done ? "checkbox" : "square-outline"}
                        size={22}
                        color={item.done ? theme.accent : "#94a3b8"}
                      />
                    </Pressable>
                    <TextInput
                      value={item.text}
                      autoFocus={item.id === focusId}
                      placeholder="New step"
                      placeholderTextColor="#94a3b8"
                      onChangeText={(text) =>
                        update({
                          checklist: checklist.map((x, i) =>
                            i === index ? { ...x, text } : x,
                          ),
                        })
                      }
                      onSubmitEditing={addChecklist}
                      blurOnSubmit={false}
                      className="flex-1"
                      style={{
                        color: dark ? "#fff" : "#334155",
                        textDecorationLine: item.done ? "line-through" : "none",
                        opacity: item.done ? 0.5 : 1,
                      }}
                    />
                    <Pressable
                      onPress={() =>
                        updateAnimated({
                          checklist: checklist.filter((_, i) => i !== index),
                        })
                      }
                      className="px-2"
                    >
                      <Ionicons name="close" size={18} color="#f43f5e" />
                    </Pressable>
                  </View>
                </FadeSlide>
              ))}
            </View>
          )}

          {!!active.images?.length && (
            <View className="mb-3">
              <View className="mb-2 flex-row items-center justify-between">
                <View className="flex-row" style={{ gap: 6 }}>
                  {[2, 3, 4].map((count) => (
                    <Pressable
                      key={count}
                      onPress={() => {
                        ease();
                        setImageColumns(count);
                      }}
                      className="rounded-lg px-3 py-2"
                      style={{
                        backgroundColor:
                          imageColumns === count ? theme.accent : glass,
                      }}
                    >
                      <Text
                        style={{
                          color:
                            imageColumns === count
                              ? "#fff"
                              : dark
                                ? "#fff"
                                : "#475569",
                          fontSize: 12,
                        }}
                      >
                        {count} cols
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text
                  style={{ color: theme.accent, fontSize: 11, opacity: 0.7 }}
                >
                  Long-press to remove
                </Text>
              </View>
              <View className="flex-row flex-wrap">
                {active.images.map((uri, index) => (
                  <FadeSlide
                    key={`${uri}-${index}`}
                    delay={index * 50}
                    style={{
                      width: `${100 / imageColumns - 2}%`,
                      marginRight: "2%",
                      marginBottom: 8,
                    }}
                  >
                    <Pressable
                      onPress={() => setViewer(uri)}
                      onLongPress={() => removeImage(index)}
                    >
                      <Image
                        source={{ uri }}
                        className="h-28 w-full rounded-2xl"
                      />
                    </Pressable>
                  </FadeSlide>
                ))}
              </View>
            </View>
          )}

          <View
            className="mb-10 rounded-3xl p-4"
            style={{ backgroundColor: glass }}
          >
            <View className="mb-2 flex-row items-center">
              <Ionicons name="lock-closed" size={14} color={theme.accent} />
              <Text className="ml-2 font-bold" style={{ color: theme.accent }}>
                Secret text
              </Text>
            </View>
            {secretVisible ? (
              <TextInput
                value={active.secret}
                onChangeText={(secret) => update({ secret })}
                multiline
                placeholder="Write something private…"
                placeholderTextColor="#94a3b8"
                className="min-h-20"
                style={{ color: dark ? "#fff" : "#334155" }}
              />
            ) : (
              <Pressable
                onPress={() => {
                  ease();
                  setSecretVisible(true);
                }}
              >
                <Text className="font-semibold" style={{ color: theme.accent }}>
                  Reveal secret text
                </Text>
              </Pressable>
            )}
            <Text
              className="mt-2 text-xs"
              style={{ color: theme.accent, opacity: 0.6 }}
            >
              Hidden every time this note is opened.
            </Text>
          </View>
        </ScrollView>

        <Modal
          visible={!!viewer}
          transparent
          animationType="fade"
          onRequestClose={() => setViewer(null)}
        >
          <Pressable
            onPress={() => setViewer(null)}
            className="flex-1 items-center justify-center bg-black"
          >
            <Text className="absolute right-6 top-14 z-10 text-3xl text-white">
              ×
            </Text>
            {viewer && (
              <Image
                source={{ uri: viewer }}
                resizeMode="contain"
                className="h-[80%] w-full"
              />
            )}
          </Pressable>
        </Modal>
      </View>
    </AnimatedScreen>
  );
}
