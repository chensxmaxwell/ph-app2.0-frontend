
import React from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import { useRegister } from "./hooks";
import LinearGradient from "react-native-linear-gradient";

export const Register = () => {
    const {
        email,
        setEmail,
        handleNavigateToLogin,
        handleNavigateToVerification,
    } = useRegister();

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['rgba(108, 108, 108, 0.6)', 'rgba(33, 33, 33, 0.6)']}
                start={{ x: 0.5, y: 0 }}  
                end={{ x: 0.5, y: 1 }}   
                style={styles.fill}
            ></LinearGradient>
            <Text style={styles.title}>Email verification</Text>
      
            <Text style={styles.info}>Please verify your email to set up a new account.</Text>

            <View style={styles.emailContainer}>
                <Text style={styles.emailLabel}>Email</Text>
                <TextInput
                placeholder="Email"
                style={styles.emailInput}
                placeholderTextColor="#f3f3f399"
                value={email}
                onChangeText={setEmail}
                />
            </View>

            <TouchableOpacity 
                style={styles.continueButton} 
                disabled={!email}
                onPress={handleNavigateToVerification}>
                <Text style={styles.continueButtonText} >Continue</Text>
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
        color: '#f3f3f399',
        textAlign: 'center',
        marginTop: 40,
        fontFamily: 'Quicksand',
        fontWeight: 'bold',
    },
    emailContainer: {
        width: 329,
        marginTop: 178,
        alignItems: 'center',
    },
    emailLabel: {
        fontSize: 20,
        color: '#fff',
        fontFamily: 'Quicksand', 
        lineHeight: 25,
        fontWeight: 'bold',
    },
    emailInput: {
        height: 40,
        width: '100%',
        borderRadius: 20,
        backgroundColor: '#F3F3F34D',
        color: '#f3f3f3',
        paddingHorizontal: 24,
        fontSize: 13,
        marginTop: 24,
        fontFamily: 'Quicksand', 
        fontWeight: 'bold',
    },
    continueButton: {
        width: 297,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#757585',
        justifyContent: 'center',
        alignItems: 'center',   
        marginTop: 300,

    },
    continueButtonText: {
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
