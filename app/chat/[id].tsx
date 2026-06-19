import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActionSheetIOS,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Empty, Header, Loading, Screen } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { notify, confirmAsync } from "../../lib/notify";
import { reportMessage } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { colors, radius, spacing } from "../../lib/theme";

type DM = { id: number; sender_id: string; recipient_id: string; body: string; created_at: string };

export default function Chat() {
  const { id: friendId } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const me = session?.user?.id;
  const [msgs, setMsgs] = useState<DM[]>([]);
  const [text, setText] = useState("");
  const [name, setName] = useState("Chat");
  const [loading, setLoading] = useState(true);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    if (!me) return;
    const { data: prof } = await supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", friendId)
      .single();
    if (prof) setName((prof as any).display_name || (prof as any).username);
    const { data } = await supabase
      .from("direct_messages")
      .select("*")
      .or(
        `and(sender_id.eq.${me},recipient_id.eq.${friendId}),and(sender_id.eq.${friendId},recipient_id.eq.${me})`
      )
      .order("created_at", { ascending: true })
      .limit(300);
    setMsgs((data as DM[]) ?? []);
    setLoading(false);
  }, [me, friendId]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`dm-${me}-${friendId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, (p) => {
        const m = p.new as DM;
        const relevant =
          (m.sender_id === me && m.recipient_id === friendId) ||
          (m.sender_id === friendId && m.recipient_id === me);
        if (relevant) setMsgs((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load, me, friendId]);

  async function reportMsg(msg: DM) {
    if (msg.sender_id === me) return;
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Cancel", "Report message"], cancelButtonIndex: 0, destructiveButtonIndex: 1 },
        async (idx) => {
          if (idx === 1) await doReport(msg);
        }
      );
    } else {
      const ok = await confirmAsync("Report message?", "Flag this message for review?");
      if (ok) await doReport(msg);
    }
  }

  async function doReport(msg: DM) {
    try {
      await reportMessage(msg.id, "dm", msg.sender_id);
      notify("Message reported", "Thank you. Our team will review it.");
    } catch (e: any) {
      notify("Could not report", e.message);
    }
  }

  async function send() {
    const body = text.trim();
    if (!body || !me) return;
    setText("");
    const { error } = await supabase.from("direct_messages").insert({ sender_id: me, recipient_id: friendId, body });
    if (error) {
      setText(body);
      notify("Message not sent", error.message);
    }
  }

  if (loading) return <Loading />;

  return (
    <Screen>
      <Header title={name} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={listRef}
          data={msgs}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            const mine = item.sender_id === me;
            return (
              <Pressable
                onLongPress={() => reportMsg(item)}
                delayLongPress={400}
                style={[styles.bubble, mine ? styles.mine : styles.theirs]}
              >
                <Text style={[styles.msgText, mine && { color: colors.blanc }]}>{item.body}</Text>
              </Pressable>
            );
          }}
          ListEmptyComponent={<Empty icon="chatbubbles-outline" title="Start the conversation" />}
        />
        <View style={styles.composer}>
          <TextInput
            style={styles.composerInput}
            placeholder={`Message ${name}…`}
            placeholderTextColor={colors.textFaint}
            value={text}
            onChangeText={setText}
            onSubmitEditing={send}
          />
          <Pressable style={styles.sendBtn} onPress={send}>
            <Text style={{ color: colors.blanc, fontWeight: "900" }}>Send</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: "78%", padding: spacing.md, borderRadius: radius.lg },
  mine: { alignSelf: "flex-end", backgroundColor: colors.bleu, borderBottomRightRadius: 4 },
  theirs: { alignSelf: "flex-start", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  msgText: { color: colors.text, fontSize: 15 },
  composer: { flexDirection: "row", gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  composerInput: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: spacing.lg, height: 46, color: colors.text, borderWidth: 1, borderColor: colors.border },
  sendBtn: { backgroundColor: colors.bleu, borderRadius: radius.pill, paddingHorizontal: spacing.lg, alignItems: "center", justifyContent: "center" },
});
