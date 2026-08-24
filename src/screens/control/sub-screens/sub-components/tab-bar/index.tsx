import { BaseText } from "@common/components/base-text";
import { FULL_SIZE } from "@common/constant";
import { colors } from "@common/styles/colors";
import { fontWeights } from "@common/styles/fonts";
import { spacings } from "@common/styles/spacings";
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";



export const TabBar: React.FC<TabBarProps> = ({ tabs, selectedTab }) => {

    return (
        <View style={styles.tabBar}>
            <View style={styles.tabs}>
                {tabs.map((tab, index) => {
                    return (
                        <TouchableOpacity key={index} onPress={tab.onPress}>
                            <BaseText
                                style={[styles.title, (tab.value === selectedTab && styles.selected)]}>
                                {tab.title}
                            </BaseText>
                        </TouchableOpacity>
                    );
                })}
            </View>
            <View style={styles.divider} />
        </View>
    );
}


const styles = StyleSheet.create({
    tabBar: {
        width: FULL_SIZE,
        display: 'flex',
        alignItems: 'center',
        paddingHorizontal: spacings.w24,
    },
    tabs: {
        display: 'flex',
        flexDirection: 'row',
        gap: spacings.w24,
        paddingTop: spacings.h50,
    },
    title: {
        fontWeight: fontWeights.bold,
        color: colors.grayLighter,
    },
    selected: {
        color: colors.white
    },
    divider: {
        marginTop: spacings.h16,
        height: 2,
        width: FULL_SIZE,
        backgroundColor: colors.white
    }
});

export type Tab = {
    title: string
    value: string
    onPress: () => void
};

type TabBarProps = {
    tabs: Array<Tab>
    selectedTab: string
}