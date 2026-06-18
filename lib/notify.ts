import { Alert, Platform } from "react-native";

// Cross-platform feedback. React Native's Alert is a no-op on react-native-web,
// so on web we fall back to the browser's native dialogs.
export function notify(title: string, message?: string) {
  if (Platform.OS === "web") {
    // eslint-disable-next-line no-alert
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

export async function confirmAsync(title: string, message?: string): Promise<boolean> {
  if (Platform.OS === "web") {
    // eslint-disable-next-line no-alert
    return window.confirm(message ? `${title}\n\n${message}` : title);
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "OK", style: "destructive", onPress: () => resolve(true) },
    ]);
  });
}
