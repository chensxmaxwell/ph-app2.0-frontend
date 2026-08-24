import React from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import { useRegisterOTP } from "./hooks";
import LinearGradient from "react-native-linear-gradient";

export const RegisterVerifyOTP = () => {
    const {
        email,
        otp,
        setOtp,
        handleVerification,
        handleResendCode,
        skipVerification,
    } = useRegisterOTP();
    return (
        <View style={styles.container}>

            <LinearGradient
                colors={['rgba(108, 108, 108, 0.6)', 'rgba(33, 33, 33, 0.6)']}
                start={{ x: 0.5, y: 0 }}  
                end={{ x: 0.5, y: 1 }}   
                style={styles.fill}
            ></LinearGradient>
            <Text style={styles.title}>Email verification</Text>
    
            <Text style={styles.info}>
                We have sent a verification code via your email{' '}
                <Text style={styles.email}>{email}</Text>.
            </Text>

            <View style={styles.codeContainer}>
                <Text style={styles.codeLabel}>Verification code</Text>
                <TextInput
                style={styles.codeInput}
                value={otp}
                onChangeText={setOtp}
                />
                <Text style={styles.notReceived}>
                    Didn’t receive verification code?
                    <Text style={styles.resend} onPress={handleResendCode}> Resend</Text>
                </Text>
                
            </View>

            <TouchableOpacity style={styles.continueButton} onPress={handleVerification}>
                <Text style={styles.continueButtonText}>Verify</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipButton}>
                <Text style={styles.skipButtonText} onPress={skipVerification}>Skip for now</Text>
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
        width: 329,
        fontSize: 14,
        color: '#f3f3f399',
        textAlign: 'center',
        marginTop: 40,
        fontFamily: 'Quicksand',
        fontWeight: 'bold',
    },
    email: {
        color: '#f3f3f3',
    },
    codeContainer: {
        width: 329,
        marginTop: 178,
        alignItems: 'center',
    },
    codeLabel: {
        fontSize: 20,
        color: '#fff',
        fontFamily: 'Quicksand', 
        lineHeight: 25,
        fontWeight: 'bold',
    },
    codeInput: {
        height: 40,
        width: '100%',
        borderRadius: 20,
        backgroundColor: '#F3F3F34D',
        color: '#fff',
        paddingHorizontal: 24,
        fontSize: 13,
        marginTop: 24,
        fontFamily: 'Quicksand', 
        fontWeight: 'bold',
    },
    notReceived: { 
        fontSize: 14,
        color: '#f3f3f399',
        textAlign: 'center',
        marginTop: 16,
        fontFamily: 'Quicksand',
        fontWeight: 'bold',
    },
    resend: {
        color: '#f3f3f3',
    },
    continueButton: {
        width: 297,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#757585',
        justifyContent: 'center',
        alignItems: 'center',   
        marginTop: 257,

    },
    continueButtonText: {
        color: '#fff',
        fontSize: 20,
        fontFamily: 'Quicksand', 
        fontWeight: 'bold',
    },
    skipButton: {
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 16,
    },
    skipButtonText: {
        color: '#f3f3f3',
        fontSize: 13,
        fontFamily: 'Quicksand',
        fontWeight: 'bold',
        lineHeight: 16, 
    },
});
