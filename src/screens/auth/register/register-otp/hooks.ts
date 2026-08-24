import { useNavigation } from "@react-navigation/native";

import { SCREENS } from "@common/constant";
import { NavigationType } from "../../../../../App";
import { gql, useMutation } from "@apollo/client";
import { useContext, useState } from "react";
import { GlobalContext } from "../../../../store";
import { Alert } from "react-native";
import { useCustomAlert } from '@common/util';


export const useRegisterOTP = () => {
    const navigation = useNavigation<NavigationType>();
    const VERIFY_OTP = gql`
        mutation VerifyOTP($otp: String) {
        verifyOTP(otp: $otp)
        }
    `;

    const RESEND_VERIFICATION_CODE = gql`
        mutation ResendOTPVerificationCode($email: String) {
        resendOTPVerificationCode(email: $email)
        }
    `;

    // global states
    const { globalState } = useContext(GlobalContext);
    const { email } = globalState.register;
    const { showAlert } = useCustomAlert();

    const [otp, setOtp] = useState('');
    const [verify_otp] = useMutation(VERIFY_OTP, {
        onCompleted: async data => {
            console.log('data: ', data);
            navigation.navigate(SCREENS.EMAIL_VERIFIED);
        },
        onError: error => {
            console.log(error);
            showAlert({
                title: 'Code invalid or does not exist:',
            });
        },
    });

    const handleVerification = () => {
        /*
        if (otp) {
        verify_otp({
            variables: { otp: otp },
        });
        } else {
        console.log('otp should not be empty');
        }*/
        navigation.navigate((SCREENS.EMAIL_VERIFIED));
    };

    const [resend_verification_code] = useMutation(RESEND_VERIFICATION_CODE, {
        onCompleted: async data => {
            console.log('data: ', data);
        },
    });

    const handleResendCode = () => {
        resend_verification_code({
            variables: { email: email },
        });
    };

    const handleNavigateToLogin = () => navigation.reset({
        index: 0,
        routes: [{ name: SCREENS.LOGIN }],
    });

    const handleNavigateToRegisterPassword = () => {
        navigation.navigate((SCREENS.REGISTER_PASSWORD));
    };

    const skipVerification = () => {
        navigation.navigate((SCREENS.REGISTER_PASSWORD));
    };

    return {
        email,
        otp,
        setOtp,
        handleVerification,
        handleResendCode,
        handleNavigateToLogin,
        handleNavigateToRegisterPassword,
        skipVerification,
    };
};