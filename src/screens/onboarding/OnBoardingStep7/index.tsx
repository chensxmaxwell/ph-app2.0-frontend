import React, { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View, Modal, Dimensions } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Smile from '@images/icons/smile.svg';
import { useOnboarding7 } from "./hooks";
import GoBackIcon from '@images/icons/go-back.svg'
import Xmark from '@images/icons/xmark.svg'
import { SeekBarOriginal } from "@common/components/seek-bar-original";




export const OnBoardingStep7 = () => {
    const {
        handleNavigateToBack,
        handleNavigateToMainPage,
        handleNavigateToSkip
    } =  useOnboarding7();

    const [satisfaction, setSatisfaction] = useState(5);
    const [seconds, setSeconds] = useState(0);
   

    const handleValueChange = (value: number) => {
        setSatisfaction(value);
    };

    const formatTime = (totalSeconds: number) => {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes < 10 ? `0${minutes}` : minutes}:${seconds < 10 ? `0${seconds}` : seconds}`;
    };

    const satisfyText: { [key: number]: [string, string] } = {
        5: ['Amazing', 'Absolutely loved it—just perfect!'],
        4: ['Great', 'That felt really good, almost perfect!'],
        3: ['Okay', 'Not bad, but could be a bit better.'],
        2: ['Not for me', 'It’s okay, but I’ve felt better.'],
        1: ['Didn’t like it', 'That felt really good, almost perfect!'],
        0: ['Didn’t like it', 'That felt really good, almost perfect!'],
    }

    useEffect(() => {
        const interval = setInterval(() => {
          setSeconds((prevSeconds) => prevSeconds + 1);
        }, 1000);
    
        return () => clearInterval(interval);
      }, []);

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['rgba(108, 108, 108, 0.6)', 'rgba(33, 33, 33, 0.6)']}
                start={{ x: 0.5, y: 0 }}  
                end={{ x: 0.5, y: 1 }}   
                style={styles.fill}
            />
           

            <Xmark style={styles.XIcon} onPress={handleNavigateToBack}></Xmark>
            <Text style={styles.title}>Set up your devices</Text>
      
            <View style={styles.infoContainer}>
                <Text style={styles.info}>Please rate your experience so we can continue improving your journey.</Text>
            </View>
         
            <View style={styles.timerTextContainer}>
                <Text style={styles.timerText}>{formatTime(seconds)}</Text>
            </View>
        
            
            <View style={styles.imageContainer}>
                <Smile/>
                <View style={styles.feelTextContainer}>
                    <Text style={styles.feelText1}>{satisfyText[satisfaction][0]}</Text>
                    <Text style={styles.feelText2}>{satisfyText[satisfaction][1]}</Text>
                </View>
            </View>

            <View style={styles.seekBar}>
                <SeekBarOriginal
                    handleValueChange={handleValueChange}
                    type="purple"
                    range={{ start: 0, end: 5 }}
                    width={Dimensions.get('window').width * 0.9}
                />
            </View>

            <View style={styles.buttonsContainer}>
                <TouchableOpacity style={styles.continueButton} onPress={handleNavigateToMainPage}>
                    <Text style={styles.continueButtonText}>Submit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.skipButton} onPress={handleNavigateToSkip}>
                    <Text style={styles.skipButtonText}>Enter pleasure house</Text>
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
    fill: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
    },
    XIcon: {
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
        justifyContent: 'center',
        alignItems: 'center',
        height: 38
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
        top: 270,
        alignItems: 'center',
        justifyContent: 'center',
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
        bottom: 225
    },
    feelTextContainer:{
        marginTop: 8,
        gap: 4
    },
    feelText1:{
        fontSize: 20,
        color: '#fff',
        fontWeight: 'bold',
        fontFamily: 'Quicksand', 
        lineHeight: 25,          
        textAlign: 'center',      
    },
    feelText2:{
        fontFamily: 'Quicksand',
        fontSize: 15,
        fontWeight: 'bold',
        lineHeight: 22.5,
        textAlign: 'center',
        color: '#fff'
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
