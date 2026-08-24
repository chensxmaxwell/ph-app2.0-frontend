import { colors } from "@common/styles/colors";
import React, { useState } from "react";
import { Image, View, Text, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import { useRegisterProfile } from "./hooks";
import LinearGradient from "react-native-linear-gradient";


export const RegisterProfile = () => {
    const {
        nickname,
        profileImage,
        gender,
        birthYear,
        birthMonth,
        birthDay,
        setNickname,
        setGender,
        setBirthYear,
        setBirthMonth,
        setBirthDay,
        pickImage,
        handleNavigateToSkipProfile,
      } = useRegisterProfile();

    const [open, setOpen] = useState(false);
    const [value, setValue] = useState('female');
    const [items, setItems] = useState([
        { label: 'Female', value: 'female' },
        { label: 'Male', value: 'male' },
        { label: 'Non-binary', value: 'non-binary' },
    ]);


    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['rgba(108, 108, 108, 0.6)', 'rgba(33, 33, 33, 0.6)']}
                start={{ x: 0.5, y: 0 }}  
                end={{ x: 0.5, y: 1 }}   
                style={styles.fill}
            />
            <Text style={styles.title}>Set up your profile</Text>
      
            <View style={styles.profileImageWrapper}>
                {profileImage ? (
                    <Image
                    source={{ uri: profileImage.uri }}
                    style={styles.profileImage}
                    />
                ) : (
                    <View style={[styles.defaultProfileImage, styles.profileImage]}>
                    <Text style={styles.profileText}>
                        {nickname?.toUpperCase().charAt(0)}
                    </Text>
                    </View>
                )}
                <Text style={styles.uploadFont} onPress={pickImage}>Upload an image</Text>
            </View>

            <View style={styles.bioContainer}>
                <Text style={styles.nameLabel}>Name</Text>
                <TextInput
                style={styles.nameInput}
                placeholder="Name"
                placeholderTextColor="#f3f3f399"
                value={nickname}
                onChangeText={setNickname}
                />
                <Text style={styles.genderLabel}>Gender</Text>
                <DropDownPicker
                    open={open}
                    value={value}
                    items={items}
                    setOpen={setOpen}
                    setValue={setValue}
                    setItems={setItems}
                    placeholder="Select Gender"
                    style={styles.genderInput}
                    textStyle={styles.text}
                    dropDownContainerStyle={styles.dropDownContainer}
                />

                <Text style={styles.birthdayLabel}>Birthday</Text>
                <TextInput
                style={styles.birthdayInput}
                placeholder="mm/dd/yyyy"
                placeholderTextColor="#f3f3f399"
                />
            </View>

            <TouchableOpacity style={styles.continueButton}>
                <Text style={styles.continueButtonText}>Continue</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipButton} onPress={handleNavigateToSkipProfile}>
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
    profileImageWrapper: {
        alignItems: 'center',
        alignSelf: 'center',
        display: 'flex',
        flexDirection: 'column',
        marginTop: 48,
    },
    defaultProfileImage: {
        backgroundColor: '#F3F3F34D',
        justifyContent: 'center',
        alignItems: 'center',
    },
    profileImage: {
        width: 100,
        height: 100,
        borderRadius: 50,
    },
    profileText: {
        fontSize: 42,
        color: colors.white,
    },
    uploadFont: {
        fontFamily: 'Quicksand', 
        fontSize: 13, 
        fontWeight: '700',
        lineHeight: 16.25, 
        color: '#f3f3f3',
        marginTop: 16,
    },
    bioContainer: {
        width: '84%',
        marginTop: 48,
    },
    nameLabel: {
        fontSize: 20,
        lineHeight: 25,
        color: '#fcfcfc',
        fontWeight: 'bold',
        fontFamily: 'Quicksand', 
    },
    nameInput: {
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
    genderLabel: {
        fontSize: 20,
        lineHeight: 25,
        color: '#fcfcfc',
        fontWeight: 'bold',
        fontFamily: 'Quicksand',
        marginTop: 24,
    },
    genderInput: {
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
        backgroundColor: '#6e6e8b',
        borderColor: '#aaa',
        borderRadius: 10,  // Custom rounded edges for dropdown
        marginTop: 24,
    },
    text: {
        fontSize: 16,
        color: '#fff',  // Text color in dropdown
    },

    birthdayLabel: {
        fontSize: 20,
        lineHeight: 25,
        color: '#fcfcfc',
        fontWeight: 'bold',
        fontFamily: 'Quicksand',
        marginTop: 24,
    },
    birthdayInput: {
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
        marginTop: 83,

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
