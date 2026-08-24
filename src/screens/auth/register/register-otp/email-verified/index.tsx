import React from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import { useRegisterOTP } from "../hooks";
import LinearGradient from "react-native-linear-gradient";

export const EmailVerified = () => {
    const {
        handleNavigateToLogin,
        handleNavigateToRegisterPassword
    } = useRegisterOTP();
    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['rgba(108, 108, 108, 0.6)', 'rgba(33, 33, 33, 0.6)']}
                start={{ x: 0.5, y: 0 }}  
                end={{ x: 0.5, y: 1 }}   
                style={styles.fill}
            />
            <Text style={styles.title}>Email verification</Text>
      

            <View style={styles.InfoContainer}>
                <Text style={styles.InfoLabel}>Account created</Text>
                <Text style={styles.InfoLabel2}>Your email has been verified.</Text>
            </View>

            <TouchableOpacity style={styles.continueButton} onPress={handleNavigateToRegisterPassword}>
                <Text style={styles.continueButtonText}>Continue</Text>
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
    InfoContainer: {
        width: '90%',
        marginTop: 262,
        alignItems: 'center',
    },
    InfoLabel: {
        fontFamily: 'Quicksand', 
        lineHeight: 25,  
        fontSize: 20,
        color: '#f3f3f3',
        fontWeight: 'bold',
    },
    InfoLabel2: {
        fontFamily: 'Quicksand', 
        lineHeight: 16,  
        fontSize: 13,
        color: '#f3f3f399',
        marginTop: 25,
        fontWeight: 'bold',
    }, 
    continueButton: {
        width: 297,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#757585',
        justifyContent: 'center',
        alignItems: 'center',  
        marginTop: 281,
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
