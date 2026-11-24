import "react-native-gesture-handler";
import "./global.css";
import React from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "react-native";
import BottomTabs from "./src/navigation/BottomTabs";
import { ToastProvider } from "./src/components/Toast";

const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: "#F5F7FB" },
};
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" backgroundColor="#F5F7FB" />
        <NavigationContainer theme={theme}>
          <ToastProvider>
            <BottomTabs />
          </ToastProvider>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
