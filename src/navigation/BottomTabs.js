import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ExpensesScreen from "../screens/ExpensesScreen";
import TasksScreen from "../screens/TasksScreen";
import PlansScreen from "../screens/PlansScreen";
import StatsScreen from "../screens/StatsScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const INACTIVE = "#8C95AA";

const tabs = {
  Expenses: {
    label: "Expenses",
    icon: "wallet-outline",
    activeIcon: "wallet",
    color: "#F9735B",
  },
  Tasks: {
    label: "Tasks",
    icon: "checkbox-outline",
    activeIcon: "checkbox",
    color: "#7C5CFA",
  },
  Plans: {
    label: "Plans",
    icon: "book-outline",
    activeIcon: "book",
    color: "#0EAA91",
  },
  Stats: {
    label: "Stats",
    icon: "pie-chart-outline",
    activeIcon: "pie-chart",
    color: "#E6A23C",
  },
};

/* The selected tab grows into a solid colour pill with its label;
   the others stay as quiet icons. */
function TabItem({ item, focused, onPress, onLongPress }) {
  const p = useRef(new Animated.Value(focused ? 1 : 0)).current; // pill open (JS driver)
  const pop = useRef(new Animated.Value(1)).current; // icon bounce (native driver)
  const labelW = item.label.length * 7.8 + 2;

  useEffect(() => {
    Animated.spring(p, {
      toValue: focused ? 1 : 0,
      friction: 9,
      tension: 80,
      useNativeDriver: false,
    }).start();
    if (focused) {
      Animated.sequence([
        Animated.timing(pop, {
          toValue: 0.78,
          duration: 90,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(pop, {
          toValue: 1,
          friction: 4,
          tension: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [focused]);

  const clamp = { extrapolate: "clamp" };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      accessibilityLabel={item.label}
    >
      <Animated.View
        style={{
          height: 44,
          borderRadius: 22,
          paddingHorizontal: 13,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          backgroundColor: p.interpolate({
            inputRange: [0, 1],
            outputRange: [`${item.color}00`, item.color],
            ...clamp,
          }),
        }}
      >
        <Animated.View style={{ transform: [{ scale: pop }] }}>
          <Ionicons
            name={focused ? item.activeIcon : item.icon}
            size={22}
            color={focused ? "#FFFFFF" : INACTIVE}
          />
        </Animated.View>
        <Animated.View
          style={{
            overflow: "hidden",
            width: p.interpolate({
              inputRange: [0, 1],
              outputRange: [0, labelW],
              ...clamp,
            }),
            marginLeft: p.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 7],
              ...clamp,
            }),
            opacity: p.interpolate({
              inputRange: [0, 0.6, 1],
              outputRange: [0, 0, 1],
              ...clamp,
            }),
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              width: labelW,
              color: "#FFFFFF",
              fontWeight: "800",
              fontSize: 13,
              letterSpacing: 0.2,
            }}
          >
            {item.label}
          </Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

function FloatingTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  const [kbOpen, setKbOpen] = useState(false);

  useEffect(() => {
    const showEvt =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const a = Keyboard.addListener(showEvt, () => setKbOpen(true));
    const b = Keyboard.addListener(hideEvt, () => setKbOpen(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);

  if (kbOpen) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        bottom: Math.max(insets.bottom, 10) + 6,
      }}
    >
      <View
        style={{
          height: 64,
          borderRadius: 32,
          paddingHorizontal: 10,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "rgba(255,255,255,0.98)",
          borderWidth: 1,
          borderColor: "rgba(79,70,229,0.08)",
          elevation: 14,
          shadowColor: "#4F46E5",
          shadowOpacity: 0.2,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 10 },
        }}
      >
        {state.routes.map((route, index) => {
          const item = tabs[route.name];
          const focused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented)
              navigation.navigate(route.name, route.params);
          };
          const onLongPress = () =>
            navigation.emit({ type: "tabLongPress", target: route.key });

          return (
            <TabItem
              key={route.key}
              item={item}
              focused={focused}
              onPress={onPress}
              onLongPress={onLongPress}
            />
          );
        })}
      </View>
    </View>
  );
}

function Tabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: "#F7F8FC" },
      }}
    >
      <Tab.Screen name="Expenses" component={ExpensesScreen} />
      <Tab.Screen name="Tasks" component={TasksScreen} />
      <Tab.Screen name="Plans" component={PlansScreen} />
      <Tab.Screen name="Stats" component={StatsScreen} />
    </Tab.Navigator>
  );
}

export default function BottomTabs() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeTabs" component={Tabs} />
    </Stack.Navigator>
  );
}
