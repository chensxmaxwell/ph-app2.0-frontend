import React from 'react';
import { Pressable, StyleProp, ViewStyle } from "react-native";
import ChevronLeft from '@images/chevron-left-white.svg';
import { useNavigation } from '@react-navigation/native';

export const BackButton: React.FC<BackButtonProps> = ({ style }) => {
    const navigation = useNavigation();
    return (
        <Pressable
            style={style}
            onPress={() => navigation.goBack()}>
            <ChevronLeft width={35} height={35} />
        </Pressable>
    )
};

type BackButtonProps = {
    style?: StyleProp<ViewStyle>
}
