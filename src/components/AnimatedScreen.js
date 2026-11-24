import React, { useEffect, useRef } from "react";
import { Animated } from "react-native";

export default function AnimatedScreen({ children, style }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const offset = useRef(new Animated.Value(10)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.spring(offset, { toValue: 0, damping: 20, stiffness: 150, useNativeDriver: true })
    ]).start();
  }, [opacity, offset]);
  return <Animated.View style={[{ flex: 1, opacity, transform: [{ translateY: offset }] }, style]}>{children}</Animated.View>;
}
