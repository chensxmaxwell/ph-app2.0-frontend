import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { ScreenWrapper } from "@common/components/screen-wrapper";
import { colors } from "@common/styles/colors";
import { fontSizes, fontWeights } from "@common/styles/fonts";
import { useNavigation } from "@react-navigation/native";
import ChevronLeft from "@images/chevron-left-white.svg";
import {
  ARK_BASE_URL,
  ARK_MODEL,
  LlmConfig,
  defaultLlmConfig,
  hasLlmKey,
  loadLlmConfig,
  saveLlmConfig,
} from "../../services/llm-config";

export const CompanionAiScreen = () => {
  const navigation = useNavigation();
  const [config, setConfig] = useState<LlmConfig>(defaultLlmConfig());
  const [status, setStatus] = useState("");

  useEffect(() => {
    loadLlmConfig().then(setConfig);
  }, []);

  const save = async () => {
    await saveLlmConfig(config);
    setStatus("Saved for this account. New chats will use this API.");
  };

  return (
    <ScreenWrapper backgroundType="gray" paddingHorizontal="small">
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Companion AI</Text>
        <TouchableOpacity
          style={styles.backIcon}
          onPress={() => navigation.goBack()}
        >
          <ChevronLeft width={35} height={35} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.copy}>
          Companion chat calls Volcengine Ark from this device. Paste a key here
          so Release builds can reply. The key stays on this account on this
          phone — it is not uploaded and is not read from a shipped .env.
        </Text>
        <Text style={styles.label}>API key</Text>
        <TextInput
          value={config.apiKey}
          onChangeText={(apiKey) => setConfig((current) => ({ ...current, apiKey }))}
          style={styles.input}
          placeholder="Ark API key"
          placeholderTextColor={colors.grayLighter}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
        <Text style={styles.label}>Base URL</Text>
        <TextInput
          value={config.baseUrl}
          onChangeText={(baseUrl) =>
            setConfig((current) => ({ ...current, baseUrl }))
          }
          style={styles.input}
          placeholder={ARK_BASE_URL}
          placeholderTextColor={colors.grayLighter}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.label}>Model</Text>
        <TextInput
          value={config.model}
          onChangeText={(model) => setConfig((current) => ({ ...current, model }))}
          style={styles.input}
          placeholder={ARK_MODEL}
          placeholderTextColor={colors.grayLighter}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.save} onPress={save}>
          <Text style={styles.saveText}>Save</Text>
        </TouchableOpacity>
        {status ? <Text style={styles.status}>{status}</Text> : null}
        <Text style={styles.hint}>
          {hasLlmKey(config)
            ? "A key is saved for this account."
            : "No key yet. Chat will not invent a companion reply until you save one."}
        </Text>
      </ScrollView>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  header: {
    width: "100%",
    position: "relative",
  },
  headerTitle: {
    fontSize: fontSizes.medium2X,
    fontWeight: fontWeights.bold,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    textAlign: "center",
    position: "absolute",
    width: "100%",
  },
  backIcon: {
    width: 35,
    height: 35,
  },
  body: {
    paddingTop: 24,
    paddingBottom: 40,
    gap: 8,
  },
  copy: {
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    fontSize: 14,
    marginBottom: 16,
  },
  label: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 13,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.white,
    fontFamily: "Quicksand-Bold",
  },
  save: {
    marginTop: 24,
    backgroundColor: colors.grayLightest,
    borderRadius: 25,
    alignItems: "center",
    paddingVertical: 14,
  },
  saveText: {
    color: colors.white,
    fontFamily: "Quicksand-Bold",
    fontSize: 18,
  },
  status: {
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    textAlign: "center",
    marginTop: 12,
  },
  hint: {
    color: colors.grayLighter,
    fontFamily: "Quicksand-Bold",
    textAlign: "center",
    marginTop: 8,
    fontSize: 13,
  },
});
