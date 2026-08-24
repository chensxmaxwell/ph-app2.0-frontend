import { spacings } from '@common/styles/spacings';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

import HomeMainActive from '@images/home-active.svg';
import HomeMain from '@images/home.svg';
import MessageActive from '@images/message-active.svg';
import Message from '@images/message.svg';
import ProfileMainActive from '@images/profile-active.svg';
import ProfileMain from '@images/profile.svg';

import { NavigationType } from '../../../../App';
import { SCREENS } from '../../constant';
import { PillButtonSvg } from '../pill-button-svg';

export const NavigationTab: React.FC<NavigationTabProps> = ({
  activeRoute,
  style,
}) => {
  const navigation = useNavigation<NavigationType>();

  return (
    <View style={[styles.footer, style]}>
      <PillButtonSvg
        height={spacings.h75}
        width={spacings.w340}
        type="pink-light"
      />
      <View style={styles.logoBarWrapper}>
        <Pressable
          style={styles.logoWrapper}
          onPress={() => navigation.navigate(SCREENS.HOME)}>
          {SCREENS.HOMEMAIN === activeRoute || SCREENS.HOME === activeRoute ? (
            <HomeMainActive />
          ) : (
            <HomeMain />
          )}
        </Pressable>
        <Pressable
          style={styles.logoWrapper}
          onPress={() => navigation.navigate(SCREENS.MESSAGETAB)}>
          {SCREENS.MESSAGETAB === activeRoute ||
          SCREENS.MESSAGE_MAINTENANCE_PAGE === activeRoute ? (
            <MessageActive />
          ) : (
            <Message />
          )}
        </Pressable>
        <Pressable
          style={styles.logoWrapper}
          onPress={() => navigation.navigate(SCREENS.PROFILE)}>
          {SCREENS.PROFILE === activeRoute ||
          SCREENS.PROFILEMAIN === activeRoute ? (
            <ProfileMainActive />
          ) : (
            <ProfileMain />
          )}
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  logoBarWrapper: {
    alignItems: 'center',
    position: 'absolute',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'row',
    gap: 72,
  },
  logoWrapper: {
    width: 28,
    height: 28,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
});

export type NavigationTabProps = {
  activeRoute: (typeof SCREENS)[keyof typeof SCREENS];
  style?: StyleProp<ViewStyle>;
};
