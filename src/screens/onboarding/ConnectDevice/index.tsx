import React, { memo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { PeripheralWrapper, useBleManager } from '../../../hooks/useBleManager';
import { DEMO_DEVICE_ID, DEMO_DEVICE_NAME, useDevice } from '../../../store/device';
import { useConnectDevice } from './hooks';
import LinearGradient from 'react-native-linear-gradient';
import RefreshButton from '@images/icons/refresh-button.svg';
import BleConnectIcon from '@images/icons/ble-connect.svg';
import GoBackIcon from '@images/icons/go-back.svg'

type DeviceProps = {
    peripheralWrapper: PeripheralWrapper;
    connect: (args: PeripheralWrapper) => void;
    disconnect: (args: PeripheralWrapper) => void;
};

const DeviceItem = memo(
    ({ peripheralWrapper, connect, disconnect }: DeviceProps) => {
  
    return (
        <TouchableOpacity style={styles.deviceItem} onPress={() =>
            peripheralWrapper.connected
              ? disconnect(peripheralWrapper)
              : connect(peripheralWrapper)}>
            <Text style={styles.deviceName}>{peripheralWrapper.peripheral.name}</Text>
            {peripheralWrapper.connected && <BleConnectIcon />}
        </TouchableOpacity>
        );
    },
);

export const ConnectDevice = () => {
    const {
        startScan,
        scaning,
        stopScan,
        bleState,
        checkBleState,
        bleDevice,
        connect,
        disconnect,
        isConnected,
    } = useBleManager();
    const {
        connected: demoConnected,
        connecting: demoConnecting,
        connectDemo,
        disconnectDemo,
        battery,
    } = useDevice();
    const {
        handleNavigateToBack,
        handleContinue,
        fromOnboarding,
    } = useConnectDevice();
    const demoDevice: PeripheralWrapper = {
        peripheral: {
            id: DEMO_DEVICE_ID,
            name: DEMO_DEVICE_NAME,
            rssi: -40,
            advertising: {},
        } as PeripheralWrapper['peripheral'],
        connected: demoConnected,
    };
    const devices = [demoDevice, ...(bleDevice ?? [])];
    const linked = isConnected || demoConnected;

    const handleRefresh = () => {
        // Simulate refreshing logic
        if (!scaning) {
            startScan();
        }
    };

    useEffect(() => {
        if (checkBleState()) {
          startScan();
        }
    
        // Cleanup function to stop the scan
        return () => {
          if (scaning) {
            stopScan();
          }
        };
    }, [bleState]);

    return (
        <View style={styles.container}>
        {/* Header */}
            <LinearGradient
                colors={['rgba(108, 108, 108, 0.6)', 'rgba(33, 33, 33, 0.6)']}
                start={{ x: 0.5, y: 0 }}  
                end={{ x: 0.5, y: 1 }}   
                style={styles.fill}
            />
            <GoBackIcon style={styles.BackIcon} onPress={handleNavigateToBack}></GoBackIcon>
            <Text style={styles.title}>Find your device</Text>
            <TouchableOpacity style={styles.connectContainer}>
                <View style={linked ? styles.connectIndicator : styles.disconnectIndicator} />
                <Text style={styles.buttonText}>
                    {demoConnecting ? 'Connecting...' : linked ? 'Connected' : 'Disconnected'}
                </Text>
                <Text style={styles.percentageText}>{linked ? `${battery}%` : '--'}</Text>
            </TouchableOpacity>
            

            {/* Refresh Button */}
            <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
                <Text style={styles.refreshText}>Refresh</Text>
                <RefreshButton style={styles.refreshButtonIcon}></RefreshButton>
            </TouchableOpacity>

            {/* Device List */}
            <View style={styles.deviceListContainer}>
                <FlatList
                    data={devices}
                    renderItem={({ item }) => (
                            <DeviceItem
                            peripheralWrapper={item}
                            connect={(wrapper) => {
                                if (wrapper.peripheral.id === DEMO_DEVICE_ID) {
                                    connectDemo();
                                    return;
                                }
                                connect(wrapper);
                            }}
                            disconnect={(wrapper) => {
                                if (wrapper.peripheral.id === DEMO_DEVICE_ID) {
                                    disconnectDemo();
                                    return;
                                }
                                disconnect(wrapper);
                            }}
                            />
                        )}
                    keyExtractor={(item) => item.peripheral.id}
                />
            </View>
            {fromOnboarding ? (
                <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
                    <Text style={styles.continueText}>Continue</Text>
                </TouchableOpacity>
            ) : null}
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
    BackIcon: {
        position: 'absolute',
        top: 73,
        left: 26
    },
    fill: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: -2,
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
    connectContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F3F34D',
        borderRadius: 50,            
        borderWidth: 1,
        borderColor: '#FFFFFF',  
        width: 197,
        height: 40,    
        marginTop: 32,
    },
    disconnectIndicator: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#F95F6E',   
        marginLeft: 16,  
    },
    connectIndicator: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#39FF14',   
        marginLeft: 16,  
    },
    buttonText: {
        color: '#FCFCFC',
        fontSize: 13,
        fontWeight: 'bold',
        fontFamily: 'Quicksand', 
        marginLeft: 29,
    },
    percentageText: {
        color: '#FCFCFC99',            
        fontSize: 13,
        fontWeight: 'bold',
        fontFamily: 'Quicksand', 
        marginLeft: 8,
    },
    refreshButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F3F3F34D',
        borderRadius: 20,
        width: 329,
        height: 40,
        marginTop: 56,
        gap: 8,
    },
    refreshText: {
        color: '#FCFCFC',
        fontSize: 13,
        fontWeight: 'bold',
        fontFamily: 'Quicksand', 
    },
    refreshButtonIcon: {
        marginTop: 1,
    },
    deviceListContainer: {
        backgroundColor: '#F3F3F34D',
        marginTop: 23,
        width: 329,
        minHeight: 250,
        borderRadius: 20,
        paddingLeft: 32,
        paddingRight: 32,
        paddingTop: 8,
        paddingBottom: 8,
    },
    deviceItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: 43,
        borderBottomColor: '#F3F3F34D',
        borderBottomWidth: 1,
    },
    deviceName: {
        color: '#FCFCFC',
        fontSize: 13,
        fontWeight: 'bold',
        fontFamily: 'Quicksand', 
    },
    continueButton: {
        width: 297,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#757585',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 24,
        marginBottom: 24,
    },
    continueText: {
        color: '#fff',
        fontSize: 20,
        fontFamily: 'Quicksand',
        fontWeight: 'bold',
    },
});


