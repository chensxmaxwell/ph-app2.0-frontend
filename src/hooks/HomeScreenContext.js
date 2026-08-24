import { gql, useQuery } from '@apollo/client';
import React, { createContext, useContext, useEffect, useState } from 'react';

import { useBleManager } from './useBleManager';
import { useDevice } from '../store/device';
import { applyToyMotor, stopToy } from '../store/toy';
import { wavePattern } from '../store/patterns';

const HomeScreenContext = createContext();

export const useHomeScreen = () => useContext(HomeScreenContext);

const GET_DEVICE_BY_USER = gql`
  query GetDeviceByUser {
    getDeviceByUser {
      id
      name
      peripheralID
    }
  }
`;

export const HomeScreenProvider = ({ children }) => {
  const [currentMode, setCurrentMode] = useState('');
  const [userId, setUserId] = useState(null);
  // this record the PeripheralId of ble device related to the user
  const [userPeripheralId, setUserPeripheralId] = useState('');
  const [motorInput, setMotorInput] = useState([]);
  const [autoIntensity, setAutoIntensity] = useState(3);

  const motor_selection_table = {
    0: [1, 95, 95, 95],
    1: [1, 88, 88, 88],
    2: [1, 77, 77, 77],
    3: [1, 66, 66, 66],
    4: [1, 55, 55, 55],
    5: [1, 44, 44, 44],
    6: [1, 33, 33, 33],
    7: [1, 22, 22, 22],
    8: [1, 11, 11, 11],
    9: [1, 5, 5, 5],
    10: [5], // this is auto
  };

  const {
    connectToDevice,
    isConnected: bleConnected,
    setIsConnected,
    disconnectToDevice,
    peripheralId,
    setPeripheralId,
    connect,
    writeToMotor,
    isMonitoring,
    listenToDevice,
    stopListenToDevice,
    receiveData,
    readFromDevice,
    readData,
  } = useBleManager();
  const {
    connected: demoConnected,
    connecting: demoConnecting,
    connectDemo,
    disconnectDemo,
    battery,
    name: demoName,
  } = useDevice();
  const isConnected = bleConnected || demoConnected;

  useEffect(() => {
    // This effect is for debugging purposes to log current mode changes
    if (currentMode) {
      console.log(currentMode);
    } else {
      console.log('stop motor');
    }
  }, [currentMode]);

  // useEffect(() => {
  //   // This effect is for testing purposes to mimic connected device
  //   setIsConnected(true);
  // }, []);

  useEffect(() => {
    if (!currentMode) {
      setMotorInput([]);
    }
    if (currentMode && !bleConnected && !demoConnected) {
      connectDemo();
    }
  }, [currentMode]);

  useEffect(() => {
    if (currentMode !== 'auto') {
      return undefined;
    }
    const pattern = wavePattern(20 + autoIntensity * 16);
    let index = 0;
    const timer = setInterval(() => {
      const value = pattern[index % pattern.length];
      setMotorInput([1, value, value, value]);
      index += 1;
    }, 280);
    return () => {
      clearInterval(timer);
    };
  }, [autoIntensity, currentMode]);

  useEffect(() => {
    if (bleConnected && motorInput) {
      const intervalId = setInterval(() => {
        writeToMotor(
          peripheralId,
          '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
          '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
          motorInput,
        );
      }, 500);
      return () => clearInterval(intervalId);
    }

    applyToyMotor(motorInput);
    return () => {
      if (!motorInput || motorInput.length === 0) {
        stopToy();
      }
    };
  }, [bleConnected, demoConnected, motorInput, peripheralId, writeToMotor]);

  const { loading, error, data, refetch } = useQuery(GET_DEVICE_BY_USER, {
    notifyOnNetworkStatusChange: true,
  });

  useEffect(() => {
    if (userId) {
      refetch();
    }
  }, [userId, refetch]);

  useEffect(() => {
    if (data && userId) {
      console.log('Device data:', data);
      if (data.getDeviceByUser) {
        setUserPeripheralId(data.getDeviceByUser.peripheralID);
      } else {
        setUserPeripheralId('');
      }
    }
    if (error) {
      console.log('Error fetching device data:', error);
    }
  }, [data, error, userId]);

  const handleConnectToDevice = () => {
    if (userPeripheralId) {
      console.log('connecting to', userPeripheralId);
      connectToDevice(userPeripheralId);
    } else {
      alert('Please Add a New Device');
    }
    // console.log(isConnected);
  };

  return (
    <HomeScreenContext.Provider
      value={{
        currentMode,
        setCurrentMode,
        handleConnectToDevice,
        isConnected,
        demoConnected,
        demoConnecting,
        connectDemo,
        disconnectDemo,
        demoName,
        battery,
        userId,
        setUserId,
        peripheralId,
        setPeripheralId,
        setIsConnected,
        disconnectToDevice,
        userPeripheralId,
        setUserPeripheralId,
        Connect: connect,
        setMotorInput,
        autoIntensity,
        setAutoIntensity,
        motor_selection_table,
        isMonitoring,
        listenToDevice,
        stopListenToDevice,
        receiveData,
        readFromDevice,
        readData,
      }}>
      {children}
    </HomeScreenContext.Provider>
  );
};
