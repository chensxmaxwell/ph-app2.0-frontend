import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { useLogin } from "./hooks";
import GoogleIcon from "@images/google-icon.svg";
import Line from "@images/line.svg";
import { fontSizes, fontWeights } from "@common/styles/fonts";
import CheckBox from "@react-native-community/checkbox";
import LinearGradient from "react-native-linear-gradient";

export const Login = () => {
  const {
    email,
    password,
    handleLogin,
    setEmail,
    setPassword,
    handleNavigateToRegister,
    handleNavigateToForgotPassword,
    handleBypassLogin,
    googleSignIn,
  } = useLogin();
  const [isChecked, setIsChecked] = useState(false);
  const toggleCheckbox = () => {
    setIsChecked(!isChecked);
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#2B2358", "#2B2358"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFillObject}
      />

      <LinearGradient
        colors={["#5E5DBF", "rgba(50, 41, 105, 0)"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      ></LinearGradient>

      <Text style={styles.pleasureHouse}>Pleasure House</Text>

      <View style={styles.rectangle3}>
        <Image
          source={require("@images/logos/PHlogo.png")}
          style={{ width: 120, height: 120 }}
        />
      </View>

      <View style={styles.inputGroup}>
        <View style={styles.typeWrapper1}>
          <TextInput
            style={styles.typeText}
            placeholder="Email"
            placeholderTextColor="#f3f3f399"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View style={styles.typeWrapper2}>
          <TextInput
            style={styles.typeText}
            placeholder="Password"
            placeholderTextColor="#f3f3f399"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>
        <View style={styles.group}>
          <View style={styles.rememberMeGroup}>
            <CheckBox
              value={isChecked}
              onValueChange={toggleCheckbox}
              style={styles.checkbox}
              boxType="square"
            />

            <Text style={styles.rememberMe}>Remember me</Text>
          </View>

          <View style={styles.forgotContainer}>
            <Text
              style={styles.forgotPassword}
              onPress={handleNavigateToForgotPassword}
            >
              Forgot Password?
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.loginButton}>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            { opacity: !email || !password ? 0.5 : 1 },
          ]}
          disabled={!email || !password}
          onPress={handleLogin}
        >
          <View style={styles.overlapGroup}>
            <Text style={styles.text}>Log in</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.dontHaveAccount}>
          <Text style={styles.span}>Don’t have an account?</Text>
          <Text style={styles.signUp} onPress={handleNavigateToRegister}>
            {" "}
            Sign Up
          </Text>
        </Text>
        <TouchableOpacity style={styles.bypassButton} onPress={handleBypassLogin}>
          <Text style={styles.bypassText}>Bypass login</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.registerWith}>
        <View style={styles.continueWith}>
          <Line style={styles.line} />
          <Text style={styles.continueText}>Or continue with</Text>
          <Line style={styles.line2} />
        </View>

        <View style={styles.socialRow}>
          <TouchableOpacity style={styles.googleButton} onPress={googleSignIn}>
            <GoogleIcon />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleBypassLogin}
          >
            <Text style={styles.socialGlyph}>f</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleBypassLogin}
          >
            <Text style={styles.socialGlyph}>A</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: "100%",
    overflow: "hidden",
    width: "100%",
    alignItems: "center",
  },
  absoluteFillObject: {
    position: "absolute",
  },
  pleasureHouse: {
    color: "#ffffff",
    fontFamily: "AngryPortraitToumpano",
    fontSize: fontSizes.largeX,
    textAlign: "center",
    marginTop: 70,
    width: 329,
  },
  rectangle3: {
    borderRadius: 20,
    height: 120,
    width: 120,
    marginTop: 56,
    overflow: "hidden",
  },
  inputGroup: {
    marginTop: 64,
    width: 329,
  },
  inputBox: {
    height: 40,
    marginTop: 24,
    width: 331,
  },
  typeWrapper1: {
    backgroundColor: "#f3f3f34c",
    borderRadius: 50,
    height: 40,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  typeWrapper2: {
    backgroundColor: "#f3f3f34c",
    borderRadius: 50,
    height: 40,
    justifyContent: "center",
    paddingHorizontal: 24,
    marginTop: 24,
  },
  typeText: {
    color: "#ffffffff",
    fontFamily: "Quicksand",
    fontSize: 13,
    fontWeight: fontWeights.bold,
  },
  loginButton: {
    width: 299,
    marginTop: 88,
  },
  bypassButton: {
    marginTop: 16,
    height: 40,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: "#f3f3f399",
    justifyContent: "center",
    alignItems: "center",
  },
  bypassText: {
    color: "#f3f3f3",
    fontFamily: "Quicksand",
    fontSize: 13,
    fontWeight: fontWeights.bold,
  },
  primaryButton: {
    height: 50,
    width: 299,
  },
  overlapGroup: {
    backgroundColor: "#f3f3f34c",
    borderRadius: 50,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    color: "#FFFFFF",
    fontFamily: "Quicksand",
    fontSize: 20,
    fontWeight: fontWeights.bold,
    textAlign: "center",
  },
  dontHaveAccount: {
    color: "#FFFFFF",
    fontFamily: "Quicksand",
    fontSize: 13,
    fontWeight: fontWeights.bold,
    textAlign: "center",
    marginTop: 16,
    width: 223,
    alignSelf: "center",
  },
  span: {
    color: "#f3f3f399",
  },
  signUp: {
    color: "#f3f3f3",
  },
  registerWith: {
    height: 94,
    width: "100%",
    marginTop: 41,
    alignItems: "center",
  },
  googleButton: {
    backgroundColor: "#f3f3f34c",
    borderRadius: 8,
    height: 56,
    width: 109,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 22,
  },
  socialRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 0,
  },
  socialGlyph: {
    color: "#FFFFFF",
    fontFamily: "Quicksand",
    fontSize: 24,
    fontWeight: fontWeights.bold,
  },
  continueWith: {
    width: 347,
    flexDirection: "row",
    height: "auto",
    justifyContent: "center",
    alignItems: "center",
  },
  continueText: {
    color: "#f3f3f399",
    fontFamily: "Quicksand",
    fontSize: 13,
    fontWeight: fontWeights.bold,
    textAlign: "center",
    marginLeft: 8,
    marginRight: 8,
  },
  line: {
    height: 1,
    width: 107,
  },
  line2: {
    height: 1,
    width: 107,
  },
  group: {
    height: "auto",
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    justifyContent: "space-between",
  },
  forgotContainer: {
    width: "auto",
    height: "auto",
    alignItems: "center",
  },
  forgotPassword: {
    color: "#f3f3f399",
    fontFamily: "Quicksand",
    fontSize: 13,
    fontWeight: fontWeights.bold,
    textAlign: "center",
    width: 115,
  },
  rememberMeGroup: {
    width: "auto",
    height: "auto",
    flexDirection: "row",
    alignItems: "center",
  },
  rememberMe: {
    color: "#f3f3f399",
    fontFamily: "Quicksand",
    fontSize: 13,
    fontWeight: fontWeights.bold,
    marginLeft: 13,
  },
  checkbox: {
    borderColor: "#f3f3f399",
    height: 20,
    width: 20,
  },
});
