import React, { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Device from '@images/device.svg';
import { useOnboarding4 } from "./hooks";
import { useBleManager } from "../../../hooks/useBleManager";
import GoBackIcon from '@images/icons/go-back.svg'
import { useCustomAlert } from "@common/util";

export const OnBoardingStep4 = () => {
    const {
        handleNavigateToBack,
        handleNavigateToOnBoarding5,
        handleNavigateToConnectDevice,
        handleNavigateToSkip,
    } = useOnboarding4();
    const { showAlert, hideAlert } = useCustomAlert();

    const handleShowAlert = () => {
        showAlert({
            title: "Skip This Step?",
            message: "You can always complete this step later in Settings. Skipping now might impact your current setup.",
            primaryButton: {
                text: "Skip for Now",
                onPress: () => {
                    handleNavigateToSkip();
                },
            },
            secondaryButton: {
                text: "Cancel",
                onPress: () => {
                    hideAlert();
                },
            },
            cancelable: true,
        });
    };

    const {
        isConnected
    } = useBleManager();


    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['rgba(108, 108, 108, 0.6)', 'rgba(33, 33, 33, 0.6)']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.fill}
            />
            <GoBackIcon style={styles.BackIcon} onPress={handleNavigateToBack}></GoBackIcon>
            <Text style={styles.title}>Set up your devices</Text>

            <View style={styles.infoContainer}>
                <Text style={styles.info}>Click the button below to pair your bracelet</Text>
            </View>

            <TouchableOpacity style={styles.connectContainer} onPress={handleNavigateToConnectDevice}>
                <View style={isConnected ? styles.connectIndicator : styles.disconnectIndicator} />
                <Text style={styles.buttonText}>
                    {isConnected ? 'Connected' : 'Disconnected'}
                </Text>
                <Text style={styles.percentageText}>100%</Text>
            </TouchableOpacity>

            <View style={styles.imageContainer}>
                <Device />
            </View>
            <View style={styles.instructionContainer}>
                <Text style={styles.instruction}>Pair your bracelet via Bluetooth with our Pleasure House app</Text>
            </View>

            <TouchableOpacity style={styles.continueButton} onPress={handleNavigateToOnBoarding5}>
                <Text style={styles.continueButtonText}>Continue</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipButton} onPress={handleShowAlert}>
                <Text style={styles.skipButtonText}>Skip for now</Text>
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
        zIndex: -2,
    },
    BackIcon: {
        position: 'absolute',
        top: 73,
        left: 26
    },
    title: {
        fontSize: 20,
        color: '#fff',
        fontWeight: 'bold',
        marginTop: 70,
        fontFamily: 'Quicksand',
        lineHeight: 25,
        textAlign: 'center',
    },
    infoContainer: {
        width: '80%',
        alignItems: 'center',
        alignSelf: 'center',
        display: 'flex',
        flexDirection: 'column',
        marginTop: 40,
    },
    info: {
        fontFamily: 'Quicksand',
        fontSize: 13,
        fontWeight: '700',
        lineHeight: 16.25,
        textAlign: 'center',
        color: '#F3F3F399',
    },
    connectContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F3F34D',
        borderRadius: 50,
        borderWidth: 1,
        borderColor: '#FFFFFF',
        width: 197,
        height: 40,
        marginTop: 32,
    },
    disconnectIndicator: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#F95F6E',
        marginLeft: 16,
    },
    connectIndicator: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#F95F6E',
        marginLeft: 16,
    },
    buttonText: {
        color: '#FCFCFC',
        fontSize: 13,
        fontWeight: 'bold',
        fontFamily: 'Quicksand',
        marginLeft: 29,
    },
    percentageText: {
        color: '#FCFCFC99',
        fontSize: 13,
        fontWeight: 'bold',
        fontFamily: 'Quicksand',
        marginLeft: 8,
    },
    imageContainer: {
        position: 'absolute',
        top: 167,
        zIndex: -1,
    },
    instructionContainer: {
        marginTop: 307,
        width: 292,
    },
    instruction: {
        fontSize: 20,
        lineHeight: 25,
        color: '#fcfcfc',
        fontWeight: 'bold',
        fontFamily: 'Quicksand',
        textAlign: 'center',
    },
    continueButton: {
        width: 297,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#757585',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 103,

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
