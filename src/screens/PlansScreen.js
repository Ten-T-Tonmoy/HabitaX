import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Defs, Pattern, Rect, Circle, Line, Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import AnimatedScreen from "../components/AnimatedScreen";
import { getData, saveData } from "../storage/storage";
import ThemePicker, { NOTE_THEMES } from "../components/ThemePicker";
import {
  AnimatedBar,
  CountUp,
  FadeSlide,
  FilterTabs,
  PressScale,
  ease,
  useFxToast,
} from "../components/Fx";

/* ───────────────────────── helpers ───────────────────────── */

const localDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

let _uid = 0;
const nid = () =>
  `${Date.now().toString(36)}${(_uid++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

const TAGS = [
  { id: "idea", label: "💡 Idea" },
  { id: "work", label: "💼 Work" },
  { id: "goal", label: "🎯 Goal" },
  { id: "personal", label: "🌿 Personal" },
  { id: "urgent", label: "🔥 Urgent" },
];

const PATTERNS = [
  { id: "none", label: "Plain" },
  { id: "dots", label: "Dots" },
  { id: "grid", label: "Grid" },
  { id: "lines", label: "Lines" },
];

const getTheme = (id) => NOTE_THEMES.find((x) => x.id === id) || NOTE_THEMES[0];

const hexToRgb = (h) => {
  if (typeof h !== "string" || h[0] !== "#") return null;
  let s = h.slice(1);
  if (s.length === 3)
    s = s
      .split("")
      .map((c) => c + c)
      .join("");
  if (s.length < 6) return null;
  const n = parseInt(s.slice(0, 6), 16);
  if (Number.isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
// picks a readable text color for any theme color
const readableOn = (hex, light = "#FFFFFF", dark = "#1E293B") => {
  const rgb = hexToRgb(hex);
  if (!rgb) return light;
  const l = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  return l > 0.62 ? dark : light;
};

const TEXT_TYPES = ["text", "h1", "h2"];

// merges consecutive single "check" blocks (older format) into one "checklist" block
const groupChecks = (blocks) => {
  const out = [];
  (blocks || []).forEach((b) => {
    if (b.type === "check") {
      const item = { id: b.id || nid(), text: b.text || "", done: !!b.done };
      const last = out[out.length - 1];
      if (last && last.type === "checklist") last.items.push(item);
      else out.push({ id: nid(), type: "checklist", items: [item] });
    } else out.push(b);
  });
  return out;
};

// Old notes (body / checklist / images / secret) → block model
const normalize = (note) => {
  const { body, checklist, images, secret, ...rest } = note;
  if (Array.isArray(note.blocks))
    return {
      tags: [],
      pinned: false,
      pattern: "none",
      ...rest,
      blocks: groupChecks(note.blocks),
    };
  const blocks = [];
  if (body?.trim()) blocks.push({ id: nid(), type: "text", text: body });
  if (checklist?.length)
    blocks.push({
      id: nid(),
      type: "checklist",
      items: checklist.map((c) => ({
        id: c.id || nid(),
        text: c.text || "",
        done: !!c.done,
      })),
    });
  if (images?.length)
    blocks.push({
      id: nid(),
      type: "images",
      items: images.map((uri) => ({ id: nid(), uri })),
    });
  if (secret?.trim()) blocks.push({ id: nid(), type: "secret", text: secret });
  return { tags: [], pinned: false, pattern: "none", ...rest, blocks };
};

const blocksOf = (n) => n.blocks || [];
const checksOf = (n) =>
  blocksOf(n)
    .filter((b) => b.type === "checklist")
    .flatMap((b) => (b.items || []).filter((c) => c.text?.trim()));
const imagesOf = (n) =>
  blocksOf(n)
    .filter((b) => b.type === "images")
    .flatMap((b) => b.items || []);
const previewOf = (n) =>
  blocksOf(n)
    .filter((b) => TEXT_TYPES.includes(b.type) && b.text?.trim())
    .map((b) => b.text.trim())
    .join("\n");

const isBlockEmpty = (b) =>
  b.type === "images"
    ? !(b.items || []).length
    : b.type === "checklist"
      ? !(b.items || []).some((i) => i.text?.trim())
      : !b.text?.trim();
const cleanBlocks = (blocks) =>
  blocks
    .map((b) =>
      b.type === "checklist"
        ? { ...b, items: (b.items || []).filter((i) => i.text?.trim()) }
        : b,
    )
    .filter((b) => !isBlockEmpty(b));
const isNoteEmpty = (n) =>
  !n.title?.trim() && cleanBlocks(blocksOf(n)).length === 0;

const blankNote = () => ({
  id: String(Date.now()),
  title: "",
  theme: NOTE_THEMES[0]?.id || "grid",
  pattern: "dots",
  pinned: false,
  tags: [],
  createdAt: localDate(),
  blocks: [{ id: nid(), type: "text", text: "" }],
});

/* ───────────────────────── pattern background ───────────────────────── */

let _pid = 0;
function PatternBG({ kind, color, opacity = 0.22, size = 22 }) {
  const id = useRef(`pat${_pid++}`).current;
  if (!kind || kind === "none") return null;
  return (
    <Svg
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
    >
      <Defs>
        <Pattern
          id={id}
          width={size}
          height={size}
          patternUnits="userSpaceOnUse"
        >
          {kind === "dots" && (
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={1.7}
              fill={color}
              opacity={Math.min(1, opacity * 1.6)}
            />
          )}
          {kind === "grid" && (
            <Path
              d={`M ${size} 0 L 0 0 0 ${size}`}
              fill="none"
              stroke={color}
              strokeWidth={1}
              opacity={opacity}
            />
          )}
          {kind === "lines" && (
            <Line
              x1={0}
              y1={size - 0.5}
              x2={size}
              y2={size - 0.5}
              stroke={color}
              strokeWidth={1}
              opacity={opacity}
            />
          )}
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

/* ───────────────────────── auto image grid ───────────────────────── */

const GAP = 6;
const PAGE_GAP = 14;
// columns for k images (max 4x4 per grid; more images → extra grids)
const colsFor = (k) =>
  k <= 8 ? [1, 2, 3, 2, 3, 3, 4, 4][k - 1] : k === 9 ? 3 : 4;

function computeLayout(n, width) {
  if (!n || !width) return { slots: [], height: 0 };
  const pages = Math.ceil(n / 16);
  const base = Math.floor(n / pages);
  const extra = n % pages;
  const slots = [];
  let y = 0;
  for (let p = 0; p < pages; p++) {
    const k = base + (p < extra ? 1 : 0);
    const cols = colsFor(k);
    const fullW = (width - GAP * (cols - 1)) / cols;
    const h = cols === 1 ? Math.round(width * 0.6) : fullW;
    const rows = Math.ceil(k / cols);
    for (let r = 0; r < rows; r++) {
      const m = Math.min(cols, k - r * cols); // last row stretches to fill the width
      const w = (width - GAP * (m - 1)) / m;
      for (let c = 0; c < m; c++)
        slots.push({ x: c * (w + GAP), y: y + r * (h + GAP), w, h });
    }
    y += rows * h + (rows - 1) * GAP + (p < pages - 1 ? PAGE_GAP : 0);
  }
  return { slots, height: y };
}

function GridCell({
  item,
  slot,
  pos,
  selected,
  dragging,
  accent,
  onPress,
  onLongPress,
  onPressOut,
  onTrash,
}) {
  const lift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(lift, {
      toValue: dragging ? 2 : selected ? 1 : 0,
      friction: 6,
      useNativeDriver: true,
    }).start();
  }, [selected, dragging]);
  if (!slot) return null;
  return (
    <Animated.View
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: slot.w,
        height: slot.h,
        zIndex: dragging ? 30 : selected ? 20 : 1,
        elevation: dragging ? 14 : selected ? 8 : 2,
        shadowColor: "#000",
        shadowOpacity: dragging ? 0.35 : 0.15,
        shadowRadius: dragging ? 14 : 6,
        shadowOffset: { width: 0, height: dragging ? 10 : 3 },
        transform: [
          { translateX: pos.x },
          { translateY: pos.y },
          {
            scale: lift.interpolate({
              inputRange: [0, 1, 2],
              outputRange: [1, 1.04, 1.1],
            }),
          },
        ],
      }}
    >
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        onPressOut={onPressOut}
        delayLongPress={260}
        style={{ flex: 1 }}
      >
        <Image
          source={{ uri: item.uri }}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 16,
            borderWidth: selected || dragging ? 2.5 : 0,
            borderColor: accent,
            backgroundColor: "rgba(0,0,0,0.06)",
          }}
        />
      </Pressable>
      {selected && !dragging && (
        <Pressable
          onPress={onTrash}
          hitSlop={10}
          style={{
            position: "absolute",
            top: -9,
            right: -9,
            width: 30,
            height: 30,
            borderRadius: 15,
            backgroundColor: "#F43F5E",
            alignItems: "center",
            justifyContent: "center",
            elevation: 10,
            zIndex: 40,
          }}
        >
          <Ionicons name="trash" size={15} color="#fff" />
        </Pressable>
      )}
    </Animated.View>
  );
}

// tap = view · hold = select (delete badge) · hold + drag = reorder
function DragGrid({
  items,
  width,
  accent,
  onReorder,
  onOpen,
  onDelete,
  onDragState,
}) {
  const n = items.length;
  const [order, setOrder] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const cur = order || items.map((i) => i.id);
  const layout = useMemo(() => computeLayout(n, width), [n, width]);
  const byId = useMemo(
    () => Object.fromEntries(items.map((i) => [i.id, i])),
    [items],
  );

  const posMap = useRef({});
  const getPos = (id, i) => {
    if (!posMap.current[id]) {
      const s = layout.slots[i] || { x: 0, y: 0 };
      posMap.current[id] = new Animated.ValueXY({ x: s.x, y: s.y });
    }
    return posMap.current[id];
  };

  // latest values for the (created-once) PanResponder
  const st = useRef({}).current;
  st.cur = cur;
  st.layout = layout;
  st.byId = byId;
  st.items = items;
  st.onReorder = onReorder;
  st.onDragState = onDragState;
  const armed = useRef(false);
  const active = useRef(null);
  const dragging = useRef(false);

  const finish = () => {
    dragging.current = false;
    armed.current = false;
    const next = st.live;
    const changed =
      next && next.join("|") !== st.items.map((i) => i.id).join("|");
    active.current = null;
    setDragId(null);
    setSelectedId(null);
    if (changed) st.onReorder(next.map((id) => st.byId[id]).filter(Boolean));
    setOrder(null);
    st.onDragState && st.onDragState(false);
  };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (e, g) =>
        armed.current &&
        active.current != null &&
        (Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4),
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        const id = active.current;
        dragging.current = true;
        st.live = st.cur;
        st.base = st.layout.slots[st.cur.indexOf(id)];
        setOrder(st.cur);
        setDragId(id);
        st.onDragState && st.onDragState(true);
      },
      onPanResponderMove: (e, g) => {
        const id = active.current;
        if (!st.base || id == null) return;
        const p = posMap.current[id];
        p && p.setValue({ x: st.base.x + g.dx, y: st.base.y + g.dy });
        const cx = st.base.x + st.base.w / 2 + g.dx;
        const cy = st.base.y + st.base.h / 2 + g.dy;
        let best = 0;
        let bd = Infinity;
        st.layout.slots.forEach((s, i) => {
          const d = (s.x + s.w / 2 - cx) ** 2 + (s.y + s.h / 2 - cy) ** 2;
          if (d < bd) {
            bd = d;
            best = i;
          }
        });
        const from = st.live.indexOf(id);
        if (best !== from) {
          const next = [...st.live];
          next.splice(from, 1);
          next.splice(best, 0, id);
          st.live = next;
          setOrder(next);
        }
      },
      onPanResponderRelease: () => finish(),
      onPanResponderTerminate: () => finish(),
    }),
  ).current;

  // spring every cell into its slot whenever order / layout changes
  useEffect(() => {
    cur.forEach((id, i) => {
      if (id === dragId) return;
      const s = layout.slots[i];
      if (!s) return;
      Animated.spring(getPos(id, i), {
        toValue: { x: s.x, y: s.y },
        friction: 9,
        tension: 90,
        useNativeDriver: true,
      }).start();
    });
  }, [cur.join("|"), dragId, layout]);

  return (
    <View
      style={{ width, height: layout.height }}
      onTouchStart={() => {
        armed.current = false;
      }}
      {...pan.panHandlers}
    >
      {cur.map((id, i) => {
        const item = byId[id];
        if (!item) return null;
        return (
          <GridCell
            key={id}
            item={item}
            slot={layout.slots[i]}
            pos={getPos(id, i)}
            accent={accent}
            dragging={dragId === id}
            selected={selectedId === id}
            onPress={() => {
              if (selectedId) return setSelectedId(null);
              onOpen(items.findIndex((x) => x.id === id));
            }}
            onLongPress={() => {
              armed.current = true;
              active.current = id;
              setSelectedId(id);
              onDragState && onDragState(true);
            }}
            onPressOut={() => {
              if (!dragging.current) onDragState && onDragState(false);
            }}
            onTrash={() => {
              setSelectedId(null);
              active.current = null;
              onDelete(id);
            }}
          />
        );
      })}
    </View>
  );
}

/* ───────────────────────── draggable checklist ───────────────────────── */

const ROW_H = 46;
const ROW_GAP = 8;
const PITCH = ROW_H + ROW_GAP;

// Checklist card: progress bar, steps, Enter = next step, hold the ⠿ handle and drag to reorder
function ChecklistBlock({
  block,
  accent,
  ink,
  glass,
  dark,
  inputRefs,
  onFocusBlock,
  onToggle,
  onText,
  onSubmit,
  onBackspace,
  onDelete,
  onReorder,
  onDragState,
  onRemove,
}) {
  const items = block.items || [];
  const n = items.length;
  const [order, setOrder] = useState(null);
  const [dragId, setDragId] = useState(null);
  const cur = order || items.map((i) => i.id);
  const byId = useMemo(
    () => Object.fromEntries(items.map((i) => [i.id, i])),
    [items],
  );
  const done = items.filter((i) => i.done).length;

  const ys = useRef({});
  const getY = (id, i) => {
    if (!ys.current[id]) ys.current[id] = new Animated.Value(i * PITCH);
    return ys.current[id];
  };

  // latest values for the (created-once) PanResponder
  const st = useRef({}).current;
  st.cur = cur;
  st.items = items;
  st.byId = byId;
  st.onReorder = onReorder;
  st.onDragState = onDragState;
  const armed = useRef(false);
  const active = useRef(null);
  const dragging = useRef(false);

  const finish = () => {
    dragging.current = false;
    armed.current = false;
    const next = st.live;
    const changed =
      next && next.join("|") !== st.items.map((i) => i.id).join("|");
    active.current = null;
    setDragId(null);
    if (changed) st.onReorder(next.map((id) => st.byId[id]).filter(Boolean));
    setOrder(null);
    st.onDragState && st.onDragState(false);
  };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (e, g) =>
        armed.current && active.current != null && Math.abs(g.dy) > 3,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        const id = active.current;
        dragging.current = true;
        st.live = st.cur;
        st.baseY = st.cur.indexOf(id) * PITCH;
        setOrder(st.cur);
        setDragId(id);
        st.onDragState && st.onDragState(true);
      },
      onPanResponderMove: (e, g) => {
        const id = active.current;
        if (id == null || st.baseY == null) return;
        const maxY = (st.live.length - 1) * PITCH;
        const y = Math.max(0, Math.min(maxY, st.baseY + g.dy));
        ys.current[id] && ys.current[id].setValue(y);
        const best = Math.max(
          0,
          Math.min(st.live.length - 1, Math.round(y / PITCH)),
        );
        const from = st.live.indexOf(id);
        if (best !== from) {
          const next = [...st.live];
          next.splice(from, 1);
          next.splice(best, 0, id);
          st.live = next;
          setOrder(next);
        }
      },
      onPanResponderRelease: () => finish(),
      onPanResponderTerminate: () => finish(),
    }),
  ).current;

  // spring every row into its slot whenever order changes
  useEffect(() => {
    cur.forEach((id, i) => {
      if (id === dragId) return;
      Animated.spring(getY(id, i), {
        toValue: i * PITCH,
        friction: 9,
        tension: 90,
        useNativeDriver: true,
      }).start();
    });
  }, [cur.join("|"), dragId]);

  const rowBg = dark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.9)";

  return (
    <View
      style={{
        marginVertical: 10,
        borderRadius: 22,
        padding: 12,
        backgroundColor: glass,
        borderWidth: 1,
        borderColor: `${accent}33`,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 8,
          paddingHorizontal: 2,
        }}
      >
        <Ionicons name="checkbox-outline" size={16} color={accent} />
        <Text
          style={{
            flex: 1,
            marginLeft: 6,
            fontWeight: "800",
            color: accent,
          }}
        >
          Checklist
        </Text>
        <Text style={{ color: accent, fontSize: 12, fontWeight: "700" }}>
          {done}/{n}
        </Text>
        <Pressable onPress={onRemove} hitSlop={8} style={{ marginLeft: 10 }}>
          <Ionicons name="close" size={17} color={`${ink}88`} />
        </Pressable>
      </View>

      <View style={{ marginBottom: 12, paddingHorizontal: 2 }}>
        <AnimatedBar
          pct={n ? done / n : 0}
          color={accent}
          track={dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.08)"}
          height={6}
        />
      </View>

      <View
        style={{ width: "100%", height: Math.max(ROW_H, n * PITCH - ROW_GAP) }}
        {...pan.panHandlers}
      >
        {cur.map((id, i) => {
          const item = byId[id];
          if (!item) return null;
          const isDrag = dragId === id;
          return (
            <Animated.View
              key={id}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 0,
                height: ROW_H,
                zIndex: isDrag ? 30 : 1,
                elevation: isDrag ? 10 : 0,
                shadowColor: "#000",
                shadowOpacity: isDrag ? 0.25 : 0,
                shadowRadius: isDrag ? 10 : 0,
                shadowOffset: { width: 0, height: 6 },
                transform: [
                  { translateY: getY(id, i) },
                  { scale: isDrag ? 1.03 : 1 },
                ],
              }}
            >
              <View
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  borderRadius: 14,
                  paddingHorizontal: 6,
                  backgroundColor: rowBg,
                  borderWidth: isDrag ? 2 : 0,
                  borderColor: accent,
                }}
              >
                <Pressable
                  onPress={() => onToggle(id)}
                  hitSlop={8}
                  style={{ paddingHorizontal: 6 }}
                >
                  <Ionicons
                    name={item.done ? "checkbox" : "square-outline"}
                    size={22}
                    color={item.done ? accent : `${ink}77`}
                  />
                </Pressable>
                <TextInput
                  ref={(el) => {
                    inputRefs.current[id] = el;
                  }}
                  value={item.text}
                  placeholder="New step"
                  placeholderTextColor={`${ink}66`}
                  selectionColor={accent}
                  onFocus={onFocusBlock}
                  onChangeText={(t) => onText(id, t)}
                  submitBehavior="submit"
                  onSubmitEditing={() => onSubmit(id)}
                  onKeyPress={({ nativeEvent }) => {
                    if (nativeEvent.key === "Backspace" && !item.text)
                      onBackspace(id);
                  }}
                  style={{
                    flex: 1,
                    height: ROW_H,
                    paddingVertical: 0,
                    fontSize: 16,
                    color: ink,
                    opacity: item.done ? 0.45 : 1,
                    textDecorationLine: item.done ? "line-through" : "none",
                  }}
                />
                <Pressable
                  onPressIn={() => {
                    armed.current = true;
                    active.current = id;
                    onDragState && onDragState(true);
                  }}
                  onPressOut={() => {
                    if (!dragging.current) {
                      armed.current = false;
                      active.current = null;
                      onDragState && onDragState(false);
                    }
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                  style={{ paddingHorizontal: 6 }}
                >
                  <Ionicons name="reorder-three" size={24} color={`${ink}88`} />
                </Pressable>
                <Pressable
                  onPress={() => onDelete(id)}
                  hitSlop={8}
                  style={{ paddingHorizontal: 6 }}
                >
                  <Ionicons name="close" size={18} color="#F43F5E" />
                </Pressable>
              </View>
            </Animated.View>
          );
        })}
      </View>

      <Text style={{ color: ink, opacity: 0.45, fontSize: 11, marginTop: 10 }}>
        Enter adds a step · drag the handle to reorder
      </Text>
    </View>
  );
}

/* ───────────────────────── list: bento card ───────────────────────── */

function BentoNote({ note, index, width, onPress, onLongPress }) {
  const t = getTheme(note.theme);
  const accent = t.accent;
  const onAccent = readableOn(accent);
  const panelInk = readableOn(t.bg, "#F1F5F9", "#334155");
  const checks = checksOf(note);
  const done = checks.filter((c) => c.done).length;
  const imgs = imagesOf(note);
  const preview = previewOf(note);
  const tags = (note.tags || [])
    .map((id) => TAGS.find((x) => x.id === id))
    .filter(Boolean);
  const hasLock = blocksOf(note).some(
    (b) => b.type === "secret" && b.text?.trim(),
  );
  const empty = !preview && !checks.length && !imgs.length;

  return (
    <PressScale
      delay={Math.min(index, 10) * 70}
      onPress={onPress}
      onLongPress={onLongPress}
      style={{ width, marginBottom: 12 }}
    >
      <View
        style={{
          borderRadius: 26,
          padding: 12,
          backgroundColor: accent,
          overflow: "hidden",
          shadowColor: accent,
          shadowOpacity: 0.42,
          shadowRadius: 13,
          shadowOffset: { width: 0, height: 8 },
          elevation: 7,
        }}
      >
        <View
          style={{
            position: "absolute",
            right: -22,
            top: -22,
            width: 84,
            height: 84,
            borderRadius: 42,
            backgroundColor: "rgba(255,255,255,0.16)",
          }}
        />

        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            marginBottom: 10,
          }}
        >
          <Text
            numberOfLines={2}
            style={{
              flex: 1,
              color: onAccent,
              fontWeight: "800",
              fontSize: 16,
              lineHeight: 20,
              fontFamily: t.font,
            }}
          >
            {note.title || "Untitled"}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginLeft: 6,
              marginTop: 2,
            }}
          >
            {hasLock && (
              <Ionicons
                name="lock-closed"
                size={13}
                color={onAccent}
                style={{ marginRight: 5, opacity: 0.9 }}
              />
            )}
            {!!note.pinned && (
              <Ionicons name="pin" size={15} color={onAccent} />
            )}
          </View>
        </View>

        <View
          style={{
            borderRadius: 18,
            backgroundColor: t.bg,
            padding: 10,
            overflow: "hidden",
            minHeight: 54,
          }}
        >
          <PatternBG
            kind={note.pattern}
            color={accent}
            opacity={0.2}
            size={16}
          />
          {!!preview && (
            <Text
              numberOfLines={4}
              style={{ color: panelInk, fontSize: 12.5, lineHeight: 17 }}
            >
              {preview}
            </Text>
          )}
          {checks.length > 0 && (
            <View style={{ marginTop: preview ? 8 : 0 }}>
              {checks.slice(0, 3).map((c) => (
                <Text
                  key={c.id}
                  numberOfLines={1}
                  style={{
                    color: panelInk,
                    fontSize: 12,
                    marginBottom: 2,
                    opacity: c.done ? 0.5 : 0.95,
                    textDecorationLine: c.done ? "line-through" : "none",
                  }}
                >
                  {c.done ? "☑" : "□"} {c.text}
                </Text>
              ))}
              <View style={{ marginTop: 4 }}>
                <AnimatedBar
                  pct={done / checks.length}
                  color={accent}
                  track="rgba(0,0,0,0.1)"
                  height={5}
                />
                <Text
                  style={{
                    color: panelInk,
                    opacity: 0.7,
                    fontSize: 10,
                    marginTop: 3,
                  }}
                >
                  {done}/{checks.length} done
                </Text>
              </View>
            </View>
          )}
          {imgs.length > 0 && (
            <View
              style={{
                flexDirection: "row",
                gap: 5,
                marginTop: preview || checks.length ? 8 : 0,
              }}
            >
              {imgs.slice(0, imgs.length === 1 ? 1 : 3).map((im) => (
                <Image
                  key={im.id}
                  source={{ uri: im.uri }}
                  style={{
                    flex: 1,
                    height: imgs.length === 1 ? 92 : 54,
                    borderRadius: 10,
                  }}
                />
              ))}
              {imgs.length > 3 && (
                <View
                  style={{
                    width: 34,
                    height: 54,
                    borderRadius: 10,
                    backgroundColor: "rgba(0,0,0,0.12)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{ color: panelInk, fontSize: 11, fontWeight: "800" }}
                  >
                    +{imgs.length - 3}
                  </Text>
                </View>
              )}
            </View>
          )}
          {empty && (
            <Text style={{ color: panelInk, opacity: 0.5, fontSize: 12 }}>
              Empty note
            </Text>
          )}
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: 10,
            flexWrap: "wrap",
          }}
        >
          {tags.slice(0, 2).map((tag) => (
            <View
              key={tag.id}
              style={{
                backgroundColor: "rgba(255,255,255,0.24)",
                borderRadius: 10,
                paddingHorizontal: 7,
                paddingVertical: 2,
                marginRight: 5,
              }}
            >
              <Text
                style={{ fontSize: 10, color: onAccent, fontWeight: "700" }}
              >
                {tag.label}
              </Text>
            </View>
          ))}
          <Text
            style={{
              marginLeft: "auto",
              fontSize: 10,
              color: onAccent,
              opacity: 0.8,
              fontWeight: "600",
            }}
          >
            {note.createdAt}
          </Text>
        </View>
      </View>
    </PressScale>
  );
}

const estimateHeight = (n) =>
  120 +
  Math.min(previewOf(n).length, 150) * 0.42 +
  Math.min(checksOf(n).length, 3) * 19 +
  (checksOf(n).length ? 26 : 0) +
  (imagesOf(n).length ? (imagesOf(n).length === 1 ? 100 : 62) : 0);

/* ───────────────────────── editor bits ───────────────────────── */

function Chip({
  label,
  active,
  onPress,
  color,
  textOn = "#fff",
  idle = "rgba(0,0,0,0.07)",
  idleText = "#475569",
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        marginRight: 8,
        borderRadius: 999,
        paddingHorizontal: 13,
        paddingVertical: 8,
        backgroundColor: active ? color : idle,
      }}
    >
      <Text
        style={{
          fontWeight: "700",
          fontSize: 12.5,
          color: active ? textOn : idleText,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ToolBtn({ icon, onPress, color, active, accent }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={{
        width: 46,
        height: 46,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active ? accent : "transparent",
      }}
    >
      <Ionicons
        name={icon}
        size={24}
        color={active ? readableOn(accent) : color}
      />
    </Pressable>
  );
}

/* ───────────────────────── screen ───────────────────────── */

export default function PlansScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const { show, node: toastNode } = useFxToast(insets.top + 8);

  const [notes, setNotes] = useState([]);
  const [active, setActive] = useState(null);
  const [initial, setInitial] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [tray, setTray] = useState(null); // null | "text" | "style"
  const [focusId, setFocusId] = useState(null);
  const [revealed, setRevealed] = useState({});
  const [scrollOn, setScrollOn] = useState(true);
  const [kb, setKb] = useState(false);
  const [kbH, setKbH] = useState(0); // keyboard height (used on Android)
  const [viewer, setViewer] = useState(null);

  const notesRef = useRef([]);
  notesRef.current = notes;
  const inputRefs = useRef({});
  const viewerScroll = useRef(null);
  const splitGuard = useRef(0);

  useEffect(() => {
    getData("notes", []).then((d) =>
      setNotes((Array.isArray(d) ? d : []).map(normalize)),
    );
  }, []);

  useEffect(() => {
    const a = Keyboard.addListener("keyboardDidShow", (e) => {
      setKb(true);
      setKbH(e?.endCoordinates?.height || 0);
    });
    const b = Keyboard.addListener("keyboardDidHide", () => {
      setKb(false);
      setKbH(0);
    });
    return () => {
      a.remove();
      b.remove();
    };
  }, []);

  const persist = (next) => {
    setNotes(next);
    saveData("notes", next);
  };

  const focusLater = (id) =>
    setTimeout(() => inputRefs.current[id]?.focus(), 70);

  /* ───── open / close / save ───── */

  const open = (note) => {
    const next = note ? normalize(note) : blankNote();
    setActive(next);
    setInitial(JSON.stringify(next));
    setRevealed({});
    setTray(null);
    setFocusId(null);
    setScrollOn(true);
  };

  const dirty = active && JSON.stringify(active) !== initial;

  const closeEditor = () => {
    Keyboard.dismiss();
    ease();
    setActive(null);
    setTray(null);
  };

  const saveAndClose = () => {
    if (!dirty) return closeEditor();
    const exists = notesRef.current.some((n) => n.id === active.id);
    if (isNoteEmpty(active)) {
      if (exists) persist(notesRef.current.filter((n) => n.id !== active.id));
      closeEditor();
      return show("Empty note discarded", "warn");
    }
    const toSave = {
      ...active,
      title: active.title.trim() || "Untitled",
      blocks: cleanBlocks(active.blocks),
    };
    persist(
      exists
        ? notesRef.current.map((n) => (n.id === toSave.id ? toSave : n))
        : [toSave, ...notesRef.current],
    );
    closeEditor();
    show("Note saved ✨", "success");
  };

  const deleteNote = () => {
    const cur = notesRef.current;
    const at = cur.findIndex((n) => n.id === active.id);
    const removed = cur[at];
    if (at >= 0) persist(cur.filter((n) => n.id !== active.id));
    closeEditor();
    if (removed)
      show("Note deleted", "danger", () => {
        const latest = [...notesRef.current];
        latest.splice(Math.min(at, latest.length), 0, removed);
        ease();
        persist(latest);
        show("Note restored", "info");
      });
  };

  const duplicateNote = () => {
    const copy = {
      ...active,
      id: String(Date.now()),
      title: `${active.title || "Untitled"} (copy)`,
      pinned: false,
      createdAt: localDate(),
      blocks: cleanBlocks(active.blocks).map((b) => ({ ...b, id: nid() })),
    };
    persist([copy, ...notesRef.current]);
    closeEditor();
    show("Note duplicated 📄", "info");
  };

  const quickPin = (note) => {
    ease();
    persist(
      notesRef.current.map((n) =>
        n.id === note.id ? { ...n, pinned: !n.pinned } : n,
      ),
    );
    show(note.pinned ? "Unpinned" : "Pinned 📌", "info");
  };

  /* ───── block editing ───── */

  const update = (patch) => setActive((c) => ({ ...c, ...patch }));
  const updateBlock = (id, patch) =>
    setActive((c) => ({
      ...c,
      blocks: c.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }));
  const insertAfter = (afterId, block) => {
    ease();
    setActive((c) => {
      const i = afterId ? c.blocks.findIndex((b) => b.id === afterId) : -1;
      const blocks = [...c.blocks];
      blocks.splice(i < 0 ? blocks.length : i + 1, 0, block);
      return { ...c, blocks };
    });
  };
  const removeBlock = (id) => {
    ease();
    setActive((c) => {
      const blocks = c.blocks.filter((b) => b.id !== id);
      return {
        ...c,
        blocks: blocks.length
          ? blocks
          : [{ id: nid(), type: "text", text: "" }],
      };
    });
  };

  // after a heading, Enter drops you into a normal body line
  const breakToText = (afterId, tail = "") => {
    const now = Date.now();
    if (now - splitGuard.current < 250) return; // onChange + onSubmit can both fire
    splitGuard.current = now;
    const nb = { id: nid(), type: "text", text: tail };
    insertAfter(afterId, nb);
    focusLater(nb.id);
  };

  // focus the end of whatever block sits before a removed one
  const refocusPrev = (prev) => {
    if (!prev || prev.type === "images") return;
    if (prev.type === "checklist") {
      const last = prev.items?.[prev.items.length - 1];
      return last && focusLater(last.id);
    }
    focusLater(prev.id);
  };

  const focused = active?.blocks.find((b) => b.id === focusId);

  // "T" tray: the style applies to what you type NEXT.
  // Existing text is never restyled; a filled line gets a new line below it.
  const applyText = (type) => {
    const isText = focused && TEXT_TYPES.includes(focused.type);
    if (isText && !focused.text) {
      // empty line → just switch its style
      updateBlock(focused.id, { type });
      focusLater(focused.id);
    } else {
      const b = { id: nid(), type, text: "" };
      insertAfter(focusId, b);
      focusLater(b.id);
    }
    setTray(null);
  };

  /* ───── checklist ───── */

  const updateItems = (blockId, fn) =>
    setActive((c) => ({
      ...c,
      blocks: c.blocks.map((b) =>
        b.id === blockId ? { ...b, items: fn(b.items || []) } : b,
      ),
    }));

  const addItemAfter = (blockId, afterItemId) => {
    const it = { id: nid(), text: "", done: false };
    ease();
    updateItems(blockId, (items) => {
      const i = afterItemId
        ? items.findIndex((x) => x.id === afterItemId)
        : items.length - 1;
      const next = [...items];
      next.splice(i + 1, 0, it);
      return next;
    });
    focusLater(it.id);
  };

  // Enter on an empty step → leave the list and continue with normal text
  const exitChecklist = (blockId, itemId) => {
    const nb = { id: nid(), type: "text", text: "" };
    ease();
    setActive((c) => {
      const bi = c.blocks.findIndex((b) => b.id === blockId);
      if (bi < 0) return c;
      const blk = c.blocks[bi];
      const items = blk.items.filter((x) => x.id !== itemId);
      const blocks = [...c.blocks];
      if (items.length) {
        blocks[bi] = { ...blk, items };
        blocks.splice(bi + 1, 0, nb);
      } else {
        blocks.splice(bi, 1, nb);
      }
      return { ...c, blocks };
    });
    focusLater(nb.id);
  };

  const deleteItem = (blockId, itemId, refocus) => {
    const blk = active.blocks.find((b) => b.id === blockId);
    if (!blk) return;
    const idx = blk.items.findIndex((x) => x.id === itemId);
    const prev = blk.items[idx - 1] || blk.items[idx + 1];
    ease();
    setActive((c) => {
      let blocks = c.blocks
        .map((b) =>
          b.id === blockId
            ? { ...b, items: b.items.filter((x) => x.id !== itemId) }
            : b,
        )
        .filter((b) => b.type !== "checklist" || b.items.length);
      if (!blocks.length) blocks = [{ id: nid(), type: "text", text: "" }];
      return { ...c, blocks };
    });
    if (refocus && prev) focusLater(prev.id);
  };

  const removeChecklist = (b) => {
    if (!b.items.some((i) => i.text?.trim())) return removeBlock(b.id);
    Alert.alert(
      "Remove checklist?",
      "All steps in this list will be deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removeBlock(b.id),
        },
      ],
    );
  };

  // toolbar ☑ button
  const addChecklist = () => {
    if (focused && focused.type === "checklist")
      return addItemAfter(focused.id, null);
    const item = { id: nid(), text: "", done: false };
    const blk = { id: nid(), type: "checklist", items: [item] };
    if (focused && TEXT_TYPES.includes(focused.type) && !focused.text?.trim()) {
      // empty line → becomes the checklist
      ease();
      setActive((c) => ({
        ...c,
        blocks: c.blocks.map((b) => (b.id === focused.id ? blk : b)),
      }));
    } else {
      insertAfter(focusId, blk);
    }
    focusLater(item.id);
  };

  const addImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted)
      return Alert.alert(
        "Permission needed",
        "Allow photo access to add note images.",
      );
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 16,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.length) return;
    const items = result.assets.map((a) => ({ id: nid(), uri: a.uri }));
    ease();
    setActive((c) => {
      const blocks = [...c.blocks];
      const f = blocks.find((b) => b.id === focusId);
      if (f && f.type === "images")
        return {
          ...c,
          blocks: blocks.map((b) =>
            b.id === f.id ? { ...b, items: [...b.items, ...items] } : b,
          ),
        };
      const i = focusId ? blocks.findIndex((b) => b.id === focusId) : -1;
      blocks.splice(i < 0 ? blocks.length : i + 1, 0, {
        id: nid(),
        type: "images",
        items,
      });
      return { ...c, blocks };
    });
    show(
      `${items.length} photo${items.length > 1 ? "s" : ""} added 🖼️`,
      "success",
    );
  };

  const deleteImage = (blockId, imgId) => {
    const blk = active.blocks.find((b) => b.id === blockId);
    if (!blk) return;
    const idx = blk.items.findIndex((x) => x.id === imgId);
    const item = blk.items[idx];
    ease();
    setActive((c) => ({
      ...c,
      blocks: c.blocks
        .map((b) =>
          b.id === blockId
            ? { ...b, items: b.items.filter((x) => x.id !== imgId) }
            : b,
        )
        .filter((b) => b.type !== "images" || b.items.length),
    }));
    show("Photo removed", "danger", () => {
      ease();
      setActive((c) => {
        if (c.blocks.some((b) => b.id === blockId)) {
          return {
            ...c,
            blocks: c.blocks.map((b) => {
              if (b.id !== blockId) return b;
              const items = [...b.items];
              items.splice(Math.min(idx, items.length), 0, item);
              return { ...b, items };
            }),
          };
        }
        return {
          ...c,
          blocks: [...c.blocks, { id: blockId, type: "images", items: [item] }],
        };
      });
      show("Photo restored", "info");
    });
  };

  const addSecret = () => {
    const existing = active.blocks.find((b) => b.type === "secret");
    if (existing) {
      setRevealed((r) => ({ ...r, [existing.id]: true }));
      focusLater(existing.id);
      return show("This note already has secret text", "info");
    }
    const b = { id: nid(), type: "secret", text: "" };
    insertAfter(focusId, b);
    setRevealed((r) => ({ ...r, [b.id]: true }));
    focusLater(b.id);
  };

  const toggleTag = (id) => {
    const tags = active.tags || [];
    update({
      tags: tags.includes(id) ? tags.filter((t) => t !== id) : [...tags, id],
    });
  };

  const tapEmptyArea = () => {
    const last = active.blocks[active.blocks.length - 1];
    if (last && TEXT_TYPES.includes(last.type))
      return inputRefs.current[last.id]?.focus();
    const b = { id: nid(), type: "text", text: "" };
    insertAfter(last?.id, b);
    focusLater(b.id);
  };

  /* ───── derived list data ───── */

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes
      .filter((n) => {
        if (filter === "pinned" && !n.pinned) return false;
        if (filter === "lists" && !checksOf(n).length) return false;
        if (filter === "photos" && !imagesOf(n).length) return false;
        if (!q) return true;
        return (
          (n.title || "").toLowerCase().includes(q) ||
          previewOf(n).toLowerCase().includes(q) ||
          checksOf(n).some((c) => c.text.toLowerCase().includes(q)) ||
          (n.tags || []).some((t) => t.includes(q))
        );
      })
      .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
  }, [notes, query, filter]);

  const columns = useMemo(() => {
    const L = [],
      R = [];
    let lh = 0,
      rh = 0;
    visible.forEach((n) => {
      if (lh <= rh) {
        L.push(n);
        lh += estimateHeight(n);
      } else {
        R.push(n);
        rh += estimateHeight(n);
      }
    });
    return [L, R];
  }, [visible]);

  const stats = useMemo(() => {
    const allChecks = notes.flatMap(checksOf);
    return {
      pinned: notes.filter((n) => n.pinned).length,
      checks: allChecks.length,
      done: allChecks.filter((c) => c.done).length,
      photos: notes.reduce((s, n) => s + imagesOf(n).length, 0),
    };
  }, [notes]);

  const tabs = [
    { id: "all", label: "All", count: notes.length },
    { id: "pinned", label: "Pinned", count: stats.pinned },
    {
      id: "lists",
      label: "Lists",
      count: notes.filter((n) => checksOf(n).length).length,
    },
    {
      id: "photos",
      label: "Photos",
      count: notes.filter((n) => imagesOf(n).length).length,
    },
  ];

  const pad = 16;
  const gap = 12;
  const colW = (screenW - pad * 2 - gap) / 2;
  const indexOf = (n) => visible.findIndex((x) => x.id === n.id);

  /* ═════════════════ LIST VIEW ═════════════════ */

  if (!active) {
    return (
      <AnimatedScreen>
        <View
          className="flex-1 bg-[#F4F5FF]"
          style={{ paddingTop: insets.top + 12, paddingHorizontal: pad }}
        >
          {toastNode}

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          >
            <FadeSlide from={-12}>
              <View className="mb-4 flex-row items-center justify-between">
                <View>
                  <Text className="text-xs font-bold uppercase tracking-[2px] text-indigo-500">
                    IDEAS & PROJECTS
                  </Text>
                  <Text className="mt-1 text-2xl font-extrabold text-slate-800">
                    Plans & notes
                  </Text>
                </View>
                <Pressable
                  onPress={() => open(null)}
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

            {/* hero */}
            <FadeSlide delay={60}>
              <View
                style={{
                  borderRadius: 28,
                  padding: 20,
                  marginBottom: 16,
                  backgroundColor: "#4F46E5",
                  overflow: "hidden",
                  shadowColor: "#4F46E5",
                  shadowOpacity: 0.42,
                  shadowRadius: 16,
                  shadowOffset: { width: 0, height: 10 },
                  elevation: 8,
                }}
              >
                <PatternBG
                  kind="dots"
                  color="#FFFFFF"
                  opacity={0.2}
                  size={18}
                />
                <View
                  style={{
                    position: "absolute",
                    right: -36,
                    top: -46,
                    width: 150,
                    height: 150,
                    borderRadius: 75,
                    backgroundColor: "rgba(236,72,153,0.35)",
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
                  Your notes
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-end",
                    marginTop: 2,
                  }}
                >
                  <CountUp
                    value={notes.length}
                    style={{ color: "#fff", fontSize: 38, fontWeight: "800" }}
                  />
                  <Text
                    style={{
                      color: "#E0E7FF",
                      fontWeight: "700",
                      marginLeft: 8,
                      marginBottom: 7,
                    }}
                  >
                    {notes.length === 1 ? "note" : "notes"}
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    marginTop: 10,
                    gap: 8,
                  }}
                >
                  {[
                    { i: "pin", t: `${stats.pinned} pinned` },
                    { i: "image", t: `${stats.photos} photos` },
                    {
                      i: "checkbox",
                      t: `${stats.done}/${stats.checks} checked`,
                    },
                  ].map((c) => (
                    <View
                      key={c.t}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: "rgba(255,255,255,0.18)",
                        borderRadius: 12,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                      }}
                    >
                      <Ionicons name={c.i} size={12} color="#fff" />
                      <Text
                        style={{
                          color: "#fff",
                          fontSize: 11.5,
                          fontWeight: "700",
                          marginLeft: 5,
                        }}
                      >
                        {c.t}
                      </Text>
                    </View>
                  ))}
                </View>
                {stats.checks > 0 && (
                  <View style={{ marginTop: 14 }}>
                    <AnimatedBar
                      pct={stats.done / stats.checks}
                      color="#FDE047"
                    />
                  </View>
                )}
              </View>
            </FadeSlide>

            {/* search + filters */}
            <FadeSlide delay={110}>
              <View
                className="mb-3 flex-row items-center rounded-2xl bg-white px-3"
                style={{
                  elevation: 2,
                  shadowColor: "#6366F1",
                  shadowOpacity: 0.1,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 3 },
                }}
              >
                <Ionicons name="search" size={16} color="#94a3b8" />
                <TextInput
                  value={query}
                  onChangeText={(v) => {
                    ease();
                    setQuery(v);
                  }}
                  placeholder="Search notes, lists, tags…"
                  placeholderTextColor="#94a3b8"
                  className="flex-1 px-2 py-3 text-slate-700"
                />
                {!!query && (
                  <Pressable onPress={() => setQuery("")}>
                    <Ionicons name="close-circle" size={18} color="#cbd5e1" />
                  </Pressable>
                )}
              </View>
              <View className="mb-4">
                <FilterTabs value={filter} onChange={setFilter} tabs={tabs} />
              </View>
            </FadeSlide>

            {/* 2-box bento */}
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              {columns.map((col, ci) => (
                <View key={ci} style={{ width: colW }}>
                  {col.map((n) => (
                    <BentoNote
                      key={n.id}
                      note={n}
                      index={indexOf(n)}
                      width={colW}
                      onPress={() => open(n)}
                      onLongPress={() => quickPin(n)}
                    />
                  ))}
                </View>
              ))}
            </View>

            {!visible.length && (
              <FadeSlide>
                <View className="items-center py-14">
                  <Text style={{ fontSize: 44 }}>
                    {notes.length ? "🔍" : "📝"}
                  </Text>
                  <Text className="mt-3 font-bold text-slate-600">
                    {notes.length ? "Nothing matches" : "No notes yet"}
                  </Text>
                  <Text className="mt-1 text-center text-slate-400">
                    {notes.length
                      ? "Try another search or filter."
                      : "Tap New to start your first note."}
                  </Text>
                </View>
              </FadeSlide>
            )}
            {!!visible.length && (
              <Text className="mt-1 text-center text-xs text-slate-400">
                Long-press a note to pin it
              </Text>
            )}
          </ScrollView>
        </View>
      </AnimatedScreen>
    );
  }

  /* ═════════════════ EDITOR VIEW ═════════════════ */

  const theme = getTheme(active.theme);
  const accent = theme.accent;
  const ink = readableOn(theme.bg, "#F8FAFC", "#1E293B");
  const inkDark = ink === "#F8FAFC";
  const glass = inkDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.85)";
  const barBg = inkDark ? "rgba(30,30,34,0.97)" : "rgba(255,255,255,0.97)";
  const idleChip = inkDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)";
  const idleChipText = inkDark ? "#E2E8F0" : "#475569";
  const isExisting = notes.some((n) => n.id === active.id);
  const gridW = screenW - 40;

  const checkItems = active.blocks
    .filter((b) => b.type === "checklist")
    .flatMap((b) => b.items || []);
  const checksDone = checkItems.filter((c) => c.done).length;
  const words = [
    ...active.blocks
      .filter((b) => TEXT_TYPES.includes(b.type))
      .map((b) => b.text || ""),
    ...checkItems.map((c) => c.text || ""),
  ]
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  const photoCount = active.blocks
    .filter((b) => b.type === "images")
    .reduce((s, b) => s + b.items.length, 0);

  const renderBlock = (b, i) => {
    const common = {
      ref: (el) => {
        inputRefs.current[b.id] = el;
      },
      onFocus: () => setFocusId(b.id),
      placeholderTextColor: `${ink}66`,
      selectionColor: accent,
    };

    if (TEXT_TYPES.includes(b.type)) {
      const style =
        b.type === "h1"
          ? {
              fontSize: 25,
              fontWeight: "800",
              color: accent,
              lineHeight: 32,
              fontFamily: theme.font,
            }
          : b.type === "h2"
            ? { fontSize: 19, fontWeight: "700", color: ink, lineHeight: 26 }
            : { fontSize: 16.5, color: ink, lineHeight: 24 };
      return (
        <TextInput
          key={b.id}
          {...common}
          value={b.text}
          onChangeText={(text) => {
            // Enter inside a heading → rest goes to a normal body line
            if (b.type !== "text" && text.includes("\n")) {
              const at = text.indexOf("\n");
              updateBlock(b.id, { text: text.slice(0, at) });
              breakToText(b.id, text.slice(at + 1).replace(/\n/g, " "));
              return;
            }
            updateBlock(b.id, { text });
          }}
          multiline
          submitBehavior={b.type === "text" ? "newline" : "submit"}
          onSubmitEditing={() => {
            if (b.type === "text") return;
            breakToText(b.id);
          }}
          onKeyPress={({ nativeEvent }) => {
            if (
              nativeEvent.key === "Backspace" &&
              !b.text &&
              active.blocks.length > 1
            ) {
              const prev = active.blocks[i - 1];
              removeBlock(b.id);
              refocusPrev(prev);
            }
          }}
          placeholder={
            b.type === "h1"
              ? "Heading"
              : b.type === "h2"
                ? "Subheading"
                : i === 0
                  ? "Start writing…"
                  : ""
          }
          textAlignVertical="top"
          style={[{ paddingVertical: 6 }, style]}
        />
      );
    }

    if (b.type === "checklist") {
      return (
        <ChecklistBlock
          key={b.id}
          block={b}
          accent={accent}
          ink={ink}
          glass={glass}
          dark={inkDark}
          inputRefs={inputRefs}
          onFocusBlock={() => setFocusId(b.id)}
          onToggle={(id) => {
            ease();
            updateItems(b.id, (its) =>
              its.map((x) => (x.id === id ? { ...x, done: !x.done } : x)),
            );
          }}
          onText={(id, text) =>
            updateItems(b.id, (its) =>
              its.map((x) => (x.id === id ? { ...x, text } : x)),
            )
          }
          onSubmit={(id) => {
            const it = b.items.find((x) => x.id === id);
            if (!it?.text?.trim()) exitChecklist(b.id, id);
            else addItemAfter(b.id, id);
          }}
          onBackspace={(id) => deleteItem(b.id, id, true)}
          onDelete={(id) => deleteItem(b.id, id, false)}
          onReorder={(items) => updateBlock(b.id, { items })}
          onDragState={(on) => setScrollOn(!on)}
          onRemove={() => removeChecklist(b)}
        />
      );
    }

    if (b.type === "images") {
      return (
        <View key={b.id} style={{ marginVertical: 10 }}>
          <DragGrid
            items={b.items}
            width={gridW}
            accent={accent}
            onDragState={(on) => setScrollOn(!on)}
            onReorder={(items) => updateBlock(b.id, { items })}
            onOpen={(index) =>
              setViewer({ uris: b.items.map((x) => x.uri), index })
            }
            onDelete={(imgId) => deleteImage(b.id, imgId)}
          />
          <Text
            style={{ color: ink, opacity: 0.45, fontSize: 11, marginTop: 8 }}
          >
            Tap to view · hold to delete or drag to reorder
          </Text>
        </View>
      );
    }

    if (b.type === "secret") {
      const isOpen = !!revealed[b.id];
      return (
        <View
          key={b.id}
          style={{
            marginVertical: 10,
            borderRadius: 20,
            padding: 14,
            backgroundColor: glass,
            borderWidth: 1,
            borderColor: `${accent}44`,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <Ionicons name="lock-closed" size={14} color={accent} />
            <Text
              style={{
                marginLeft: 6,
                fontWeight: "800",
                color: accent,
                flex: 1,
              }}
            >
              Secret
            </Text>
            <Pressable onPress={() => removeBlock(b.id)} hitSlop={8}>
              <Ionicons name="close" size={17} color={`${ink}88`} />
            </Pressable>
          </View>
          {isOpen ? (
            <TextInput
              {...common}
              value={b.text}
              onChangeText={(text) => updateBlock(b.id, { text })}
              multiline
              placeholder="Write something private…"
              style={{ color: ink, fontSize: 15.5, minHeight: 40 }}
            />
          ) : (
            <Pressable
              onPress={() => {
                ease();
                setRevealed((r) => ({ ...r, [b.id]: true }));
              }}
            >
              <Text style={{ color: accent, fontWeight: "700" }}>
                •••••••• Tap to reveal
              </Text>
            </Pressable>
          )}
          <Text
            style={{ color: ink, opacity: 0.45, fontSize: 11, marginTop: 6 }}
          >
            Hidden every time this note is opened.
          </Text>
        </View>
      );
    }
    return null;
  };

  const trayStyle = {
    borderRadius: 22,
    marginBottom: 8,
    backgroundColor: barBg,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  };

  return (
    <AnimatedScreen>
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <PatternBG
          kind={active.pattern}
          color={accent}
          opacity={0.22}
          size={24}
        />
        {toastNode}

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{
            flex: 1,
            paddingTop: insets.top + 8,
            // Android (edge-to-edge) doesn't resize the window for the keyboard,
            // so lift the toolbar above it manually.
            // If there's a gap above the keyboard, use Math.max(0, kbH - insets.bottom).
            paddingBottom: Platform.OS === "android" ? kbH : 0,
          }}
        >
          {/* header */}
          <FadeSlide from={-10}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 14,
                marginBottom: 6,
              }}
            >
              <Pressable
                onPress={saveAndClose}
                hitSlop={8}
                style={{ flexDirection: "row", alignItems: "center" }}
              >
                <Ionicons name="chevron-back" size={22} color={accent} />
                <Text
                  style={{ color: accent, fontWeight: "700", fontSize: 15 }}
                >
                  Notes
                </Text>
              </Pressable>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Pressable
                  onPress={() => {
                    ease();
                    update({ pinned: !active.pinned });
                  }}
                  style={{ padding: 8 }}
                >
                  <Ionicons
                    name={active.pinned ? "pin" : "pin-outline"}
                    size={21}
                    color={accent}
                  />
                </Pressable>
                {isExisting && (
                  <>
                    <Pressable onPress={duplicateNote} style={{ padding: 8 }}>
                      <Ionicons name="copy-outline" size={21} color={accent} />
                    </Pressable>
                    <Pressable onPress={deleteNote} style={{ padding: 8 }}>
                      <Ionicons
                        name="trash-outline"
                        size={21}
                        color="#F43F5E"
                      />
                    </Pressable>
                  </>
                )}
                <Pressable
                  onPress={saveAndClose}
                  style={{
                    marginLeft: 6,
                    borderRadius: 14,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    backgroundColor: accent,
                  }}
                >
                  <Text
                    style={{ color: readableOn(accent), fontWeight: "800" }}
                  >
                    Done
                  </Text>
                </Pressable>
              </View>
            </View>
          </FadeSlide>

          {/* one flowing document */}
          <ScrollView
            scrollEnabled={scrollOn}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingBottom: 180,
            }}
          >
            <FadeSlide delay={50}>
              <TextInput
                value={active.title}
                onChangeText={(title) => update({ title })}
                placeholder="Title"
                placeholderTextColor={`${accent}88`}
                selectionColor={accent}
                multiline
                submitBehavior="submit"
                onSubmitEditing={() => {
                  const first = active.blocks.find((b) =>
                    TEXT_TYPES.includes(b.type),
                  );
                  first && inputRefs.current[first.id]?.focus();
                }}
                style={{
                  fontSize: 32,
                  fontWeight: "800",
                  color: accent,
                  fontFamily: theme.font,
                  paddingVertical: 6,
                  lineHeight: 40,
                }}
              />
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <Text style={{ color: ink, opacity: 0.55, fontSize: 12 }}>
                  {active.createdAt} · {words} {words === 1 ? "word" : "words"}
                  {checkItems.length
                    ? ` · ${checksDone}/${checkItems.length} done`
                    : ""}
                  {photoCount ? ` · ${photoCount} 🖼️` : ""}
                </Text>
                {(active.tags || []).map((id) => {
                  const tg = TAGS.find((x) => x.id === id);
                  return tg ? (
                    <View
                      key={id}
                      style={{
                        marginLeft: 6,
                        borderRadius: 10,
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        backgroundColor: `${accent}22`,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          color: accent,
                          fontWeight: "700",
                        }}
                      >
                        {tg.label}
                      </Text>
                    </View>
                  ) : null;
                })}
              </View>
            </FadeSlide>

            {active.blocks.map(renderBlock)}

            <Pressable onPress={tapEmptyArea} style={{ minHeight: 160 }} />
          </ScrollView>

          {/* trays + toolbar */}
          <View style={{ paddingHorizontal: 12 }}>
            {tray === "text" && (
              <FadeSlide key="tray-text" from={12}>
                <View
                  style={[
                    trayStyle,
                    { flexDirection: "row", gap: 8, padding: 10 },
                  ]}
                >
                  {[
                    { t: "h1", label: "Heading", font: 22, weight: "800" },
                    { t: "h2", label: "Subheading", font: 17, weight: "700" },
                    { t: "text", label: "Body", font: 15, weight: "500" },
                  ].map((o) => {
                    const on = focused?.type === o.t;
                    return (
                      <Pressable
                        key={o.t}
                        onPress={() => applyText(o.t)}
                        style={{
                          flex: 1,
                          borderRadius: 16,
                          paddingVertical: 12,
                          alignItems: "center",
                          backgroundColor: on ? accent : idleChip,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: o.font,
                            fontWeight: o.weight,
                            color: on ? readableOn(accent) : ink,
                          }}
                        >
                          Aa
                        </Text>
                        <Text
                          style={{
                            fontSize: 11,
                            marginTop: 2,
                            color: on ? readableOn(accent) : ink,
                            opacity: 0.8,
                          }}
                        >
                          {o.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </FadeSlide>
            )}

            {tray === "style" && (
              <FadeSlide key="tray-style" from={12}>
                <View style={[trayStyle, { padding: 12 }]}>
                  <ThemePicker
                    value={active.theme}
                    onChange={(th) => {
                      ease();
                      update({ theme: th });
                    }}
                  />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginTop: 12 }}
                  >
                    {PATTERNS.map((p) => (
                      <Chip
                        key={p.id}
                        label={p.label}
                        color={accent}
                        textOn={readableOn(accent)}
                        idle={idleChip}
                        idleText={idleChipText}
                        active={(active.pattern || "none") === p.id}
                        onPress={() => update({ pattern: p.id })}
                      />
                    ))}
                  </ScrollView>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginTop: 10 }}
                  >
                    {TAGS.map((tg) => (
                      <Chip
                        key={tg.id}
                        label={tg.label}
                        color={accent}
                        textOn={readableOn(accent)}
                        idle={idleChip}
                        idleText={idleChipText}
                        active={(active.tags || []).includes(tg.id)}
                        onPress={() => toggleTag(tg.id)}
                      />
                    ))}
                  </ScrollView>
                </View>
              </FadeSlide>
            )}

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-around",
                alignItems: "center",
                borderRadius: 26,
                paddingVertical: 8,
                marginBottom: kb ? 20 : Math.max(insets.bottom, 12),
                backgroundColor: barBg,
                elevation: 12,
                shadowColor: "#000",
                shadowOpacity: 0.18,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 6 },
              }}
            >
              <ToolBtn
                icon="image-outline"
                color={ink}
                accent={accent}
                onPress={addImages}
              />
              <ToolBtn
                icon="checkbox-outline"
                color={ink}
                accent={accent}
                active={focused?.type === "checklist"}
                onPress={addChecklist}
              />
              <ToolBtn
                icon="text"
                color={ink}
                accent={accent}
                active={tray === "text"}
                onPress={() => {
                  ease();
                  setTray(tray === "text" ? null : "text");
                }}
              />
              <ToolBtn
                icon="color-palette-outline"
                color={ink}
                accent={accent}
                active={tray === "style"}
                onPress={() => {
                  ease();
                  setTray(tray === "style" ? null : "style");
                }}
              />
              <ToolBtn
                icon="lock-closed-outline"
                color={ink}
                accent={accent}
                onPress={addSecret}
              />
            </View>
          </View>
        </KeyboardAvoidingView>

        {/* photo viewer */}
        <Modal
          visible={!!viewer}
          transparent
          animationType="fade"
          onRequestClose={() => setViewer(null)}
        >
          <View style={{ flex: 1, backgroundColor: "#000" }}>
            {viewer && (
              <ScrollView
                ref={viewerScroll}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                contentOffset={{ x: viewer.index * screenW, y: 0 }}
                onLayout={() =>
                  setTimeout(
                    () =>
                      viewerScroll.current?.scrollTo({
                        x: viewer.index * screenW,
                        animated: false,
                      }),
                    0,
                  )
                }
                onMomentumScrollEnd={(e) => {
                  const idx = Math.round(
                    e.nativeEvent.contentOffset.x / screenW,
                  );
                  setViewer((v) => (v ? { ...v, index: idx } : v));
                }}
              >
                {viewer.uris.map((uri, i) => (
                  <Pressable
                    key={`${uri}-${i}`}
                    onPress={() => setViewer(null)}
                    style={{ width: screenW, justifyContent: "center" }}
                  >
                    <Image
                      source={{ uri }}
                      resizeMode="contain"
                      style={{ width: screenW, height: "80%" }}
                    />
                  </Pressable>
                ))}
              </ScrollView>
            )}
            <Pressable
              onPress={() => setViewer(null)}
              style={{
                position: "absolute",
                top: insets.top + 12,
                right: 18,
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "rgba(255,255,255,0.18)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
            {viewer && viewer.uris.length > 1 && (
              <View
                style={{
                  position: "absolute",
                  bottom: insets.bottom + 24,
                  alignSelf: "center",
                  backgroundColor: "rgba(255,255,255,0.18)",
                  borderRadius: 14,
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>
                  {viewer.index + 1} / {viewer.uris.length}
                </Text>
              </View>
            )}
          </View>
        </Modal>
      </View>
    </AnimatedScreen>
  );
}
