import React, { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import { useRegisterBio } from "./hooks";
import LinearGradient from "react-native-linear-gradient";

export const RegisterBio = () => {
    const {
        handleNavigateToSkipBio,
        handleNavigateToOnBoarding
    } =  useRegisterBio();
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState('female');
    const [items, setItems] = useState([
        { label: '0-1 per week', value: '1' },
        { label: '2-4 per week', value: '4' },
        { label: '5-7 per week', value: '7' },
    ]);
    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['rgba(108, 108, 108, 0.6)', 'rgba(33, 33, 33, 0.6)']}
                start={{ x: 0.5, y: 0 }}  
                end={{ x: 0.5, y: 1 }}   
                style={styles.fill}
            />
            <Text style={styles.title}>Customize your experience</Text>
      
            <View style={styles.infoContainer}>
                <Text style={styles.info}>We’re all about making your Pleasure House journey uniquely yours. By sharing a little information with us, you'll help our AI learn what you love.</Text>
            </View>

            <View style={styles.bioContainer}>
                <Text style={styles.heightLabel}>Height</Text>
                <View style={styles.heightInputContainer}>
                    <TextInput
                        style={styles.feetInput}
                    />
                    <Text style={styles.quoteSign}>’</Text>
                    <TextInput
                        style={styles.inchInput}
                    />
                    <Text style={styles.quoteSign}>“</Text>
                </View>
                
                <Text style={styles.weightLabel}>Weight</Text>
                <View style={styles.weightInputContainer}>
                    <TextInput
                        style={styles.weightInput}
                    />
                    <Text style={styles.lb}>lb</Text>
                </View>
                
                <Text style={styles.frequencyLabel}>Exercise frequency</Text>
                <DropDownPicker
                    open={open}
                    value={value}
                    items={items}
                    setOpen={setOpen}
                    setValue={setValue}
                    setItems={setItems}
                    placeholder="Select your exercise frequency"
                    style={styles.frequencyInput}
                    textStyle={styles.text}
                    dropDownContainerStyle={styles.dropDownContainer}

                />
            </View>

            <TouchableOpacity style={styles.continueButton} onPress={handleNavigateToOnBoarding}>
                <Text style={styles.continueButtonText}>Continue</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipButton} onPress={handleNavigateToSkipBio}>
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
    bioContainer: {
        width: 330,
        marginTop: 64,
    },
    heightLabel: {
        fontSize: 20,
        lineHeight: 25,
        color: '#fcfcfc',
        fontWeight: 'bold',
        fontFamily: 'Quicksand', 
    },
    heightInputContainer: {
        flexDirection: 'row',
        marginTop: 24,
    },
    feetInput: {
        height: 40,
        width: 100,
        borderRadius: 50,
        backgroundColor: '#F3F3F34D',
        color: '#f3f3f3',
        paddingHorizontal: 24,
        fontSize: 13,
        fontFamily: 'Quicksand', 
        fontWeight: 'bold',
    },
    quoteSign: {
        fontSize: 18,
        color: '#fff',
        marginLeft: 10,
    },
    inchInput: {
        height: 40,
        width: 100,
        borderRadius: 50,
        backgroundColor: '#F3F3F34D',
        color: '#f3f3f3',
        paddingHorizontal: 24,
        fontSize: 13,
        fontFamily: 'Quicksand', 
        fontWeight: 'bold',
        marginLeft: 24,
    },
    weightLabel: {
        fontSize: 20,
        lineHeight: 25,
        color: '#fcfcfc',
        fontWeight: 'bold',
        fontFamily: 'Quicksand', 
        marginTop: 24,
    },
    weightInputContainer: {
        flexDirection: 'row',
        marginTop: 24,
        alignItems: 'center',
        width: '100%',
        justifyContent: 'space-between'
    },
    weightInput: {
        height: 40,
        width: '88%',
        borderRadius: 50,
        backgroundColor: '#F3F3F34D',
        color: '#f3f3f3',
        paddingHorizontal: 24,
        fontSize: 13,
        fontFamily: 'Quicksand', 
        fontWeight: 'bold',
    },
    lb: {
        fontSize: 20,
        lineHeight: 25,
        color: '#fcfcfc',
        fontWeight: 'bold',
        fontFamily: 'Quicksand', 
    },
    frequencyLabel: {
        fontSize: 20,
        lineHeight: 25,
        color: '#fcfcfc',
        fontWeight: 'bold',
        fontFamily: 'Quicksand', 
        marginTop: 24,
    },
    frequencyInput: {
        height: 40,
        width: '100%',
        borderRadius: 20,
        backgroundColor: '#F3F3F34D',
        color: '#f3f3f399',
        paddingHorizontal: 24,
        fontSize: 13,
        marginTop: 24,
        fontFamily: 'Quicksand', 
        fontWeight: 'bold',
    },
    dropDownContainer: {
        backgroundColor: '#fcfcfc4D',
        borderRadius: 10,  
        marginTop: 24,
    },
    text: {
        fontSize: 16,
        color: '#fff', 
        textAlign: 'center',
    },
    continueButton: {
        width: 297,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#757585',
        justifyContent: 'center',
        alignItems: 'center',   
        marginTop: 144,

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
