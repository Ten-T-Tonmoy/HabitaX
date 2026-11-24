import AsyncStorage from "@react-native-async-storage/async-storage";

export async function getData(key, fallback = []) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch (error) {
    console.warn(`Could not read ${key}`, error);
    return fallback;
  }
}

export async function saveData(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`Could not save ${key}`, error);
    return false;
  }
}

export async function removeData(key) {
  try {
    await AsyncStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`Could not remove ${key}`, error);
    return false;
  }
}

export const DATA_KEYS = [
  "transactions",
  "tasks",
  "dailyTasks",
  "notes",
  "reminders",
  "activityLog",
];
