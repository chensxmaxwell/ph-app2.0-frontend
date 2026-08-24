import React, { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View, Modal, Dimensions } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Device from '@images/device.svg';
import { useOnboarding6 } from "./hooks";
import GoBackIcon from '@images/icons/go-back.svg'
import Xmark from '@images/icons/xmark.svg'
import { SeekBar } from "@common/components/seek-bar";
import { useCustomAlert } from "@common/util";

export const OnBoardingStep6 = () => {
    const {
        handleNavigateToBack,
        handleNavigateToOnBoarding7,
        handleNavigateToSkip
    } = useOnboarding6();

    const [modalVisible, setModalVisible] = useState(true);
    const [modalStep, setModalStep] = useState<number>(1);
    const [setupStep, setSetupStep] = useState<number>(1);
    const [_satisfaction, setSatisfaction] = useState(0);
    const [seconds, setSeconds] = useState(0);
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

    const handlePressModalContinue = () => {
        setModalStep(modalStep + 1);
        if (modalStep == 3) {
            setModalVisible(!modalVisible);
        }
    }

    const handleValueChange = (value: number) => {
        setSatisfaction(value);
    };

    const formatTime = (totalSeconds: number) => {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `0${minutes}:${seconds < 10 ? `0${seconds}` : seconds}`;
    };

    const modalText: { [key: number]: string } = {
        1: "The toy must be paired with your bracelet to function properly",
        2: "Your toy will glow red when it’s running low on battery—time for a recharge!",
        3: "Hold the button for 2 seconds to turn off your bracelet or toy",
    }

    const infoText: { [key: number]: string } = {
        1: "Experience Your Device, your feedback helps us make the experience just right for you.",
        2: "Turn on your device and try it for at least 5 minutes ",
    }

    const buttonText: { [key: number]: string } = {
        1: "Let's start",
        2: "Share your feedback",
    }

    useEffect(() => {
        let interval: any;

        if (setupStep === 2) {
            interval = setInterval(() => {
                setSeconds((prevSeconds) => prevSeconds + 1);
            }, 1000);
        }

        return () => clearInterval(interval);
    }, [setupStep]);

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['rgba(108, 108, 108, 0.6)', 'rgba(33, 33, 33, 0.6)']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.fill}
            />
            <Modal
                animationType="fade"
                transparent={true}
                visible={modalVisible}
            >
                <View style={styles.modalBackground}>
                    <View style={styles.modalView}>
                        <Xmark style={styles.xMark} onPress={() => setModalVisible(!modalVisible)} />
                        <Text style={styles.modalText}>{modalText[modalStep] ? modalText[modalStep] : modalText[3]}</Text>
                        <View style={styles.circle}></View>
                        <TouchableOpacity
                            style={styles.button}
                            onPress={() => setModalVisible(!modalVisible)}
                        >
                            <Text style={styles.buttonText} onPress={handlePressModalContinue}>Continue</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <GoBackIcon style={styles.BackIcon} onPress={handleNavigateToBack}></GoBackIcon>
            <Text style={styles.title}>Set up your devices</Text>

            <View style={styles.infoContainer}>
                <Text style={styles.info}>{infoText[setupStep]}</Text>
            </View>
            {
                setupStep === 2 &&
                <View style={styles.timerTextContainer}>
                    <Text style={styles.timerText}>{formatTime(seconds)}</Text>
                </View>
            }

            <View style={styles.imageContainer}>
                <Device />
            </View>
            {
                setupStep === 1 &&
                <View style={styles.instructionContainer}>
                    <Text style={styles.instruction}>In the next X minutes, try out different vibration patterns as your toy automatically switches frequencies, Slide to share how each one feels!</Text>
                </View>
            }
            {
                setupStep === 2 &&
                <View style={styles.seekBar}>
                    <SeekBar
                        handleValueChange={handleValueChange}
                        type="pink"
                        range={{ start: 0, end: 5 }}
                        width={Dimensions.get('window').width * 0.82}
                        height={15}
                    />
                </View>
            }
            <View style={styles.buttonsContainer}>
                <TouchableOpacity style={styles.continueButton} onPress={setupStep === 1 ? () => { setSetupStep(2) } : handleNavigateToOnBoarding7}>
                    <Text style={styles.continueButtonText}>{buttonText[setupStep]}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.skipButton} onPress={handleShowAlert}>
                    <Text style={styles.skipButtonText}>Skip for now</Text>
                </TouchableOpacity>
            </View>
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
    modalBackground: {
        flex: 1,
        justifyContent: 'flex-end',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.25)',

    },
    xMark: {
        position: 'absolute',
        right: 22,
        top: 22,

    },
    modalView: {
        backgroundColor: '#757485',
        width: 321,
        height: 425,
        borderRadius: 20,
        paddingLeft: 28,
        paddingRight: 28,
        paddingTop: 56,
        paddingBottom: 54,
        marginBottom: 56,
        alignItems: 'center',
    },
    modalText: {
        fontSize: 20,
        color: '#fff',
        fontWeight: 'bold',
        fontFamily: 'Quicksand',
        lineHeight: 25,
        textAlign: 'center',
    },
    circle: {
        width: 128,
        height: 128,
        borderRadius: 64,
        backgroundColor: '#2D2A41',
        marginTop: 29,

    },
    button: {
        width: 271,
        height: 50,
        borderRadius: 50,
        backgroundColor: '#F3F3F34D',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 49,
    },
    buttonText: {
        fontSize: 20,
        color: '#fff',
        fontWeight: 'bold',
        fontFamily: 'Quicksand',
        lineHeight: 25,
        textAlign: 'center',

    },
    fill: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
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
        width: '83%',
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
    timerTextContainer: {
        position: 'absolute',
        top: 188,
        textAlign: 'center',

    },
    timerText: {
        fontFamily: 'Quicksand',
        fontSize: 18,
        fontWeight: 'bold',
        lineHeight: 22.5,
        textAlign: 'center',
        color: '#F3F3F3',
    },
    imageContainer: {
        position: 'absolute',
        top: 167
    },
    instructionContainer: {
        marginTop: 363,
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
    seekBar: {
        position: 'absolute',
        bottom: 286
    },
    buttonsContainer: {
        position: 'absolute',
        bottom: 56.5
    },
    continueButton: {
        width: 297,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#757585',
        justifyContent: 'center',
        alignItems: 'center',
    },
    continueButtonText: {
        color: '#fff',
        fontSize: 20,
        fontFamily: 'Quicksand',
        fontWeight: 'bold',
    },
    skipButton: {
        width: '100%',
        height: 23,
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
