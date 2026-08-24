import React from 'react';
import { Pressable, StyleProp, ViewStyle } from "react-native";
import Xmark from '@images/icons/xmark.svg';
import { useNavigation } from '@react-navigation/native';

export const BackButton: React.FC<BackButtonProps> = ({ style }) => {
    const navigation = useNavigation();
    return (
        <Pressable
            style={style}
            onPress={() => navigation.goBack()}>
            <Xmark />
        </Pressable>
    )
};

type BackButtonProps = {
    style?: StyleProp<ViewStyle>
}
