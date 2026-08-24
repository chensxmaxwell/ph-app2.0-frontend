import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from 'react-native-image-picker';
import { NavigationType } from "../../../../../App";
import { RegisterState } from "../../../../store";
import { useStore } from "../../../../store/hooks";

import { ImageLibraryOptions, ImagePickerResponse } from "react-native-image-picker";
import { SCREENS } from "@common/constant";


export const useRegisterProfile = () => {
    const navigation = useNavigation<NavigationType>();

    const { globalState, updateRegisterState } = useStore();
    const { nickname, profileImage, gender, birthYear, birthMonth, birthDay } =
        globalState.register;

    // global state setters
    const setNickname = (currNickname: RegisterState['nickname']) =>
        updateRegisterState({ nickname: currNickname });
    const setProfileImage = (currProfileImage: RegisterState['profileImage']) =>
        updateRegisterState({ profileImage: currProfileImage });
    const setGender = (currGender: RegisterState['gender']) =>
        updateRegisterState({ gender: currGender });
    const setBirthYear = (currBirthYear: RegisterState['birthYear']) =>
        updateRegisterState({ birthYear: currBirthYear });
    const setBirthMonth = (currBirthMonth: RegisterState['birthMonth']) =>
        updateRegisterState({ birthMonth: currBirthMonth });
    const setBirthDay = (currBirthDay: RegisterState['birthDay']) =>
        updateRegisterState({ birthDay: currBirthDay });

    // onClicks
    const pickImage = () => {
        const options: ImageLibraryOptions = {
          mediaType: 'photo',
          selectionLimit: 1,
        };
    
        ImagePicker.launchImageLibrary(options, (response: ImagePickerResponse) => {
          if (response.didCancel) {
            console.log('User cancelled image picker');
          } else if (response.errorCode) {
            console.log('ImagePicker Error: ', response.errorMessage);
          } else {
            // Assuming only one image is selected
            let selectedImage = response.assets?.[0];
            if (selectedImage) {
              setProfileImage(selectedImage);
            }
          }
        });
    };
    const handleNavigateToSkipProfile = () => {
        navigation.navigate(SCREENS.REGISTER_SKIP_PROFILE);
    };
    const handleNavigateToRegisterBio = () => {
        navigation.navigate(SCREENS.REGISTER_BIO);
    };
    const handleNavigateBack = () => {
        navigation.goBack();
    };
    return {
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
        handleNavigateToRegisterBio,
        handleNavigateBack,
    };
  };