import React from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import { useRegisterPassword } from "./hooks";
import LinearGradient from "react-native-linear-gradient";

export const RegisterPassword = () => {
    const {
        password,
        confirmPassword,
        setPassword,
        setConfirmPassword,
        handleNavigateToLogin,
        handleNavigateToPasswordSet,
    } = useRegisterPassword();
    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['rgba(108, 108, 108, 0.6)', 'rgba(33, 33, 33, 0.6)']}
                start={{ x: 0.5, y: 0 }}  
                end={{ x: 0.5, y: 1 }}   
                style={styles.fill}
            />
            <Text style={styles.title}>Set up password</Text>
      

            <View style={styles.passwordContainer}>
                <Text style={styles.passwordLabel}>New password</Text>
                <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                />
                <Text style={styles.confirmLabel}>Confirm new password</Text>
                <TextInput
                style={styles.confirmInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                />
                
            </View>

            <TouchableOpacity style={styles.confirmButton} onPress={handleNavigateToPasswordSet}>
                <Text style={styles.confirmButtonText}>Confirm</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={handleNavigateToLogin}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

        </View>
    );
};


const styles = StyleSheet.create({
    container: {
        height: '100%',
        overflow: 'hidden',
        width: '100%',
        alignItems: 'center',
        backgroundColor: '#585390',
    },
    fill: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
    },
    title: {
        fontSize: 24,
        color: '#fff',
        fontWeight: 'bold',
        marginTop: 70,
        fontFamily: 'Quicksand', 
        lineHeight: 25,          
        textAlign: 'center',      
    },
    info: {
        fontSize: 14,
        color: '#fff',
        textAlign: 'center',
        marginTop: 40,
    },
    passwordContainer: {
        width: 329,
        marginTop: 212,
    },
    passwordLabel: {
        fontSize: 20,
        lineHeight: 25,
        color: '#fcfcfc',
        fontWeight: 'bold',
        fontFamily: 'Quicksand', 
    },
    passwordInput: {
        height: 40,
        width: '100%',
        borderRadius: 25,
        backgroundColor: '#fcfcfc4D',
        color: '#f3f3f3',
        paddingHorizontal: 24,
        fontSize: 13,
        marginTop: 24,
        fontFamily: 'Quicksand', 
        fontWeight: 'bold',
    },
    confirmLabel: {
        fontSize: 20,
        lineHeight: 25,
        color: '#fcfcfc',
        fontWeight: 'bold',
        fontFamily: 'Quicksand', 
        marginTop: 24,
    },
    confirmInput: {
        height: 40,
        width: '100%',
        borderRadius: 25,
        backgroundColor: '#fcfcfc4D',
        color: '#f3f3f3',
        paddingHorizontal: 24,
        fontSize: 13,
        marginTop: 24,
        fontFamily: 'Quicksand', 
        fontWeight: 'bold',
    },
    confirmButton: {
        width: 297,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#757585',
        justifyContent: 'center',
        alignItems: 'center', 
        marginTop: 212,
    },
    confirmButtonText: {
        color: '#fff',
        fontSize: 20,
        fontFamily: 'Quicksand', 
        fontWeight: 'bold',
    },
    cancelButton: {
        width: '100%',
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cancelButtonText: {
        color: '#fff',
        fontSize: 20,
        fontFamily: 'Quicksand', 
        fontWeight: 'bold',
    },
});
