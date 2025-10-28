import { Tabs } from "expo-router";
import React from "react";
import { Provider as PaperProvider, MD3LightTheme } from "react-native-paper";

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: "#1A73E8",
    secondary: "#018786",
  },
};

export default function TabsLayout() {
  return (
    <PaperProvider theme={theme}>
      <Tabs>
        <Tabs.Screen name="index" options={{ title: "Dashboard" }} />
        <Tabs.Screen name="add" options={{ title: "Publish" }} />
        <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      </Tabs>
    </PaperProvider>
  );
}