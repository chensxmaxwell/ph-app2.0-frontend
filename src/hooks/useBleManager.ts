import { useMutation } from '@apollo/client';
import { useEffect, useRef, useState } from 'react';
import {
    Alert,
    NativeEventEmitter,
    NativeModules,
    Platform,
} from 'react-native';
import BleManager, {
    BleEventType,
    BleManagerDidUpdateStateEvent,
    BleState,
    Peripheral,
} from 'react-native-ble-manager';
import { UPDATE_DEVICE } from './useMutation';
import { PermissionEnum, useRequestPermission } from './useRequestPermission';
import { byteToString, stringToByte } from './utils';
import { useCustomAlert } from '@common/util';

export interface PeripheralWrapper {
    peripheral: Peripheral;
    connected: boolean;
}

export const useBleManager = () => {
    // 蓝牙是否连接
    const [isConnected, setIsConnected] = useState(false);
    // 正在扫描中
    const [scaning, setScaning] = useState(false);
    // 蓝牙是否正在监听
    const [isMonitoring, setIsMonitoring] = useState(false);
    // 当前正在连接的蓝牙id
    const [connectingId, setConnectingId] = useState('');
    // 已配对的蓝牙id
    const [peripheralId, setPeripheralId] = useState('');
    // 写数据
    const [writeData, setWriteData] = useState<any[]>([]);
    // 接收到的数据
    const [receiveData, setReceiveData] = useState('');
    // 读取的数据
    const [readData, setReadData] = useState('');
    // 输入的内容
    const [input, setInput] = useState<any[]>([]);
    // 扫描的蓝牙列表
    const [bleDevice, setBleDevice] = useState<PeripheralWrapper[]>([]);
    /** 蓝牙接收的数据缓存 */
    const bleReceiveData = useRef<any[]>([]);
    // 更新接收到的数据
    const [updateDevice, { data, loading, error }] = useMutation(UPDATE_DEVICE);

    // check if we should update data on userOnboardingData or regular userData
    // false for regular userData and true for userOnboardingData
    const [isUserOnboardingData, setIsUserOnboardingData] = useState(false);

    // 使用Map类型保存搜索到的蓝牙设备，确保列表不显示重复的设备
    const deviceMap = useRef(new Map<string, PeripheralWrapper>());

    // Track ble manager state
    const [bleState, setBleState] = useState<BleState | undefined>();
    // Track if required permission is granted by user
    const [permissionGranted, setPermissionGranted] = useState(false);
    // Request app permmission
    const requestPermission = useRequestPermission();
    const BleManagerModule = NativeModules.BleManager;
    const BleManagerEmitter = new NativeEventEmitter(BleManagerModule);

    const [readServiceUUID, setReadServiceUUID] = useState<any[]>([]);
    const [readCharacteristicUUID, setReadCharacteristicUUID] = useState<
        string[]
    >([]);
    const [writeWithResponseServiceUUID, setWriteWithResponseServiceUUID] =
        useState<any[]>([]);
    const [
        writeWithResponseCharacteristicUUID,
        setWriteWithResponseCharacteristicUUID,
    ] = useState<any[]>([]);
    const [writeWithoutResponseServiceUUID, setWriteWithoutResponseServiceUUID] =
        useState<any[]>([]);
    const [
        writeWithoutResponseCharacteristicUUID,
        setWriteWithoutResponseCharacteristicUUID,
    ] = useState<any[]>([]);
    const [notifyServiceUUID, setNotifyServiceUUID] = useState<any[]>([]);
    const [notifyCharacteristicUUID, setNotifyCharacteristicUUID] = useState<
        any[]
    >([]);

    const {
        showAlert,
        hideAlert
    } = useCustomAlert();

    const initUUID = () => {
        setReadServiceUUID([]);
        setReadCharacteristicUUID([]);
        setWriteWithResponseServiceUUID([]);
        setWriteWithResponseCharacteristicUUID([]);
        setWriteWithoutResponseServiceUUID([]);
        setWriteWithoutResponseCharacteristicUUID([]);
        setNotifyServiceUUID([]);
        setNotifyCharacteristicUUID([]);
    };

    useEffect(() => {
        requestPermission(PermissionEnum.bluetoothConnect)
            .then(() => {
                return requestPermission(PermissionEnum.bluetoothScan);
            })
            .then(() => {
                return requestPermission(PermissionEnum.fineLocation);
            })
            .then(() => {
                setPermissionGranted(true);
            })
            .catch(err => alert(err));
    }, []);

    const enableBluetooth = () => {
        if (Platform.OS === 'ios') {
            //   alert('Please turn on your Bluetooth!');
            return;
        }
        BleManager.enableBluetooth()
            .then(() => {
                console.log('Bluetooth is turned on!');
            })
            .catch(error => {
                console.error(error);
            });
    };

    useEffect(() => {
        if (permissionGranted) {
            enableBluetooth();

            BleManager.start({ showAlert: false })
                .then(() => {
                    console.log('BleManager initialized');
                    BleManager.checkState();
                    // handleGetConnectedDevices();
                })
                .catch(err => console.log(err));

            const updateStateListener = BleManagerEmitter.addListener(
                BleEventType.BleManagerDidUpdateState,
                handleUpdateState,
            );
            const stopScanListener = BleManagerEmitter.addListener(
                BleEventType.BleManagerStopScan,
                handleStopScan,
            );
            const discoverPeripheralListener = BleManagerEmitter.addListener(
                BleEventType.BleManagerDiscoverPeripheral,
                handleDiscoverPeripheral,
            );
            const connectPeripheralListener = BleManagerEmitter.addListener(
                BleEventType.BleManagerConnectPeripheral,
                handleConnectPeripheral,
            );
            const disconnectPeripheralListener = BleManagerEmitter.addListener(
                BleEventType.BleManagerDisconnectPeripheral,
                handleDisconnectPeripheral,
            );
            const updateValueListener = BleManagerEmitter.addListener(
                BleEventType.BleManagerDidUpdateValueForCharacteristic,
                handleUpdateValue,
            );

            return () => {
                updateStateListener.remove();
                stopScanListener.remove();
                discoverPeripheralListener.remove();
                connectPeripheralListener.remove();
                disconnectPeripheralListener.remove();
                updateValueListener.remove();
            };
        }
    }, [permissionGranted]);

    /** 蓝牙状态改变 */
    function handleUpdateState(event: BleManagerDidUpdateStateEvent) {
        console.log('BleManagerDidUpdateState:', event);
        setBleState(event.state);
        // 蓝牙打开时自动扫描
        // if (event.state === BleState.On) {
        //   startScan();
        // }
    }

    /** 扫描结束监听 */
    function handleStopScan() {
        console.log('Scanning is stopped');
        setScaning(false);
    }

    /** 搜索到一个新设备监听 */
    function handleDiscoverPeripheral(data: Peripheral) {
        // console.log('BleManagerDiscoverPeripheral:', data);
        // 蓝牙连接 id
        let id;
        // 蓝牙 Mac 地址
        let macAddress;

        id = macAddress;
        deviceMap.current.set(data.id, { peripheral: data, connected: false });
        setBleDevice([...deviceMap.current.values()]);
    }

    /** 蓝牙设备已连接 */
    function handleConnectPeripheral(data: Peripheral) {
        console.log('BleManagerConnectPeripheral:', data);
    }

    /** 蓝牙设备已断开连接 */
    function handleDisconnectPeripheral(data: Peripheral) {
        console.log('BleManagerDisconnectPeripheral:', data);
        initData();
    }

    function convertDecimalArrayToHex(decimalArray: any) {
        return decimalArray.map((num: number) => {
            // Convert to hexadecimal
            let hex = num.toString(16).toUpperCase();
            return hex.length === 1 ? '0' + hex : hex;
        });
    }

    /** 接收到新数据 */
    async function handleUpdateValue(data: any) {
        let hexArray = convertDecimalArrayToHex(data.value);
        hexArray = hexArray.join('');

        // check the command code
        const code = hexArray.substring(0, 2);

        // if all message received
        if (code == '0E') {
            // sort by timestamp before storing the data to the database
            bleReceiveData.current.sort(
                (a, b) => parseInt(a.timeStamp, 16) - parseInt(b.timeStamp, 16),
            );

            // store all data to DB
            try {
                if (!isUserOnboardingData) {
                    const result = await updateDevice({
                        variables: {
                            userData: bleReceiveData.current,
                            userOnboardingData: undefined,
                        },
                    });
                    console.log('Device userData updated:', result.data.updateDevice);
                } else {
                    const result = await updateDevice({
                        variables: {
                            userData: undefined,
                            userOnboardingData: bleReceiveData.current,
                        },
                    });
                    console.log(
                        'Device userOnboardingData updated:',
                        result.data.updateDevice,
                    );
                    setIsUserOnboardingData(false);
                }
                // send a success message back to ble device after all data successfully stored in DB
                writeToMotor(
                    peripheralId,
                    '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
                    '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
                    [15],
                );
            } catch (err) {
                console.error('Failed to update device:', err);
            }

            console.log('all message received');
            bleReceiveData.current = [];
            return;
        }

        if (code != '08' && code != '09') {
            console.log('Invalid command!');
            return;
        }

        // 分离时间戳和数据
        let timeStamp1 = hexArray.substring(2, 6);
        timeStamp1 = parseInt(timeStamp1, 16);
        let timeStamp2 = timeStamp1 + 0.5;

        let dataInfo1 = hexArray.substring(6, 22);

        let dataInfo2 = hexArray.substring(22, 38);

        if (code == '09') {
            // handle onboarding message
            if (isUserOnboardingData == false) {
                setIsUserOnboardingData(true);
            }
            dataInfo1 += ' rest onboarding data';
            dataInfo2 += ' rest onboarding data';
        }

        bleReceiveData.current.push({
            timeStamp: timeStamp1.toString(),
            data: dataInfo1,
        });
        bleReceiveData.current.push({
            timeStamp: timeStamp2.toString(),
            data: dataInfo2,
        });
    }

    function initData() {
        // 断开连接后清空UUID
        initUUID();

        // 断开后显示上次的扫描结果
        setBleDevice([...deviceMap.current.values()]);
        setIsConnected(false);
        setWriteData([]);
        setReadData('');
        setReceiveData('');
        setInput([]);
        setPeripheralId('');
        setIsUserOnboardingData(false);
        setIsMonitoring(false);
        bleReceiveData.current = [];
    }

    const checkBleState = () => {
        return bleState === BleState.On;
    };

    const startScan = () => {
        if (bleState !== BleState.On) {
            if (Platform.OS === 'ios') {
                alert('Please turn on your Bluetooth!');
                return false;
            }
            enableBluetooth();
            return;
        }
        console.log('start scan');
        // 重新扫描时清空列表
        deviceMap.current.clear();
        BleManager.scan(
            [
                // 'D0611E78-BBB4-4591-A5F8-487910AE4366',
                // '9FA480E0-4967-4542-9390-D343DC5D04AE',
                // '180a',
                // '180f',
                // '1805',
            ],
            3,
            true,
        )
            .then(() => {
                setScaning(true);
            })
            .catch(err => {
                setScaning(false);
            });
    };

    /** 停止扫描 */
    const stopScan = () => {
        BleManager.stopScan()
            .then(() => {
                console.log('Scan stopped');
                setScaning(false);
            })
            .catch(error => {
                console.log('Scan stopped fail', error);
            });
    };

    /** 返回扫描到的蓝牙设备 */
    const getDiscoveredPeripherals = () => {
        BleManager.getDiscoveredPeripherals()
            .then(peripheralsArray => {
                console.log('Discovered peripherals: ', peripheralsArray);
            })
            .catch(error => {
                console.log('Discovered peripherals fail', error);
            });
    };

    /** 将16、32、128位 UUID 转换为128位大写的 UUID */
    const fullUUID = (uuid: string) => {
        if (uuid.length === 4) {
            return '0000' + uuid.toUpperCase() + '-0000-1000-8000-00805F9B34FB';
        }
        if (uuid.length === 8) {
            return uuid.toUpperCase() + '-0000-1000-8000-00805F9B34FB';
        }
        return uuid.toUpperCase();
    };

    /** 获取Notify、Read、Write、WriteWithoutResponse的serviceUUID和characteristicUUID */
    function getUUID(peripheralInfo: any) {
        initUUID();
        const readServices: any[] = [];
        const readCharacteristics: any[] = [];
        const writeWithResponseServices: any[] = [];
        const writeWithResponseCharacteristics: any[] = [];
        const writeWithoutResponseServices: any[] = [];
        const writeWithoutResponseCharacteristics: any[] = [];
        const notifyServices: any[] = [];
        const notifyCharacteristics: any[] = [];

        peripheralInfo.characteristics?.forEach((item: any) => {
            const service = fullUUID(item.service);
            const characteristic = fullUUID(item.characteristic);
            if (Platform.OS === 'android') {
                if (item.properties.Notify) {
                    notifyServices.push(service);
                    notifyCharacteristics.push(characteristic);
                }
                if (item.properties.Read) {
                    readServices.push(service);
                    readCharacteristics.push(characteristic);
                }
                if (item.properties.Write) {
                    writeWithResponseServices.push(service);
                    writeWithResponseCharacteristics.push(characteristic);
                }
                if (item.properties.WriteWithoutResponse) {
                    writeWithoutResponseServices.push(service);
                    writeWithoutResponseCharacteristics.push(characteristic);
                }
            } else {
                // iOS logic
                Object.entries(item.properties).forEach(([key, value]) => {
                    switch (value) {
                        case 'Notify':
                            notifyServices.push(service);
                            notifyCharacteristics.push(characteristic);
                            break;
                        case 'Read':
                            readServices.push(service);
                            readCharacteristics.push(characteristic);
                            break;
                        case 'Write':
                            writeWithResponseServices.push(service);
                            writeWithResponseCharacteristics.push(characteristic);
                            break;
                        case 'WriteWithoutResponse':
                            writeWithoutResponseServices.push(service);
                            writeWithoutResponseCharacteristics.push(characteristic);
                            break;
                    }
                });
            }
        });

        // Update state with the new UUIDs
        setReadServiceUUID(readServices);
        setReadCharacteristicUUID(readCharacteristics);
        setWriteWithResponseServiceUUID(writeWithResponseServices);
        setWriteWithResponseCharacteristicUUID(writeWithResponseCharacteristics);
        setWriteWithoutResponseServiceUUID(writeWithoutResponseServices);
        setWriteWithoutResponseCharacteristicUUID(
            writeWithoutResponseCharacteristics,
        );
        setNotifyServiceUUID(notifyServices);
        setNotifyCharacteristicUUID(notifyCharacteristics);
    }

    useEffect(() => {
        console.log(
            'writeWithoutResponseServiceUUID',
            writeWithoutResponseServiceUUID,
        );
        console.log(
            'writeWithoutResponseCharacteristicUUID',
            writeWithoutResponseCharacteristicUUID,
        );
        console.log('notifyServiceUUID', notifyServiceUUID);
        console.log('notifyCharacteristicUUID', notifyCharacteristicUUID);
    }, [
        writeWithoutResponseServiceUUID,
        writeWithoutResponseCharacteristicUUID,
        notifyServiceUUID,
        notifyCharacteristicUUID,
    ]);

    /** 连接蓝牙 */
    function connect(item: PeripheralWrapper) {
        setConnectingId(item.peripheral.id);

        if (scaning) {
            // 当前正在扫描中，连接时关闭扫描
            stopScan();
        }

        // Check if BLE is support by the device
        if (!item.peripheral.advertising.isConnectable) {
            alert(
                'Bluetooth Low Energy Is Not Supported By the Device ' +
                (item.peripheral.name ?? ''),
            );
            return;
        }

        if (Platform.OS === 'ios') {
        } else {
            BleManager.createBond(item.peripheral.id)
                .then(() => {
                    console.log('Bonding established', item.peripheral.id);
                })
                .catch(err => {
                    console.log(err);
                    alert('Fail to establish bond');
                });
        }

        BleManager.connect(item.peripheral.id)
            .then(() => {
                setIsConnected(true);
                setPeripheralId(item.peripheral.id);
                item.connected = true;
                console.log('Device Connected');
                BleManager.retrieveServices(item.peripheral.id)
                    .then(peripheralInfo => {
                        console.log('Peripheral Info: ', peripheralInfo);
                        getUUID(peripheralInfo);
                    })
                    .catch(err => {
                        console.log(err);
                        alert(
                            'Fail to retrieve peripheralInfo from ' +
                            (item.peripheral.name ?? ''),
                        );
                    });
                alert('Device Connected');
                // 连接成功后，列表只显示已连接的设备
                setBleDevice([item]);
            })
            .catch(err => {
                console.log(err);
                alert('Fail to Connect ' + (item.peripheral.name ?? ''));
            })
            .finally(() => {
                setConnectingId('');
            });
    }

    function connectToDevice(peripheralId: string) {
        if (Platform.OS === 'ios') {
        } else {
            BleManager.createBond(peripheralId)
                .then(() => {
                    console.log('Bonding established', peripheralId);
                })
                .catch(err => {
                    console.log(err);
                    alert('Fail to connect to ' + peripheralId);
                });
        }

        // need to handle the case when the peripheral is not working
        // and the connect should stop in like 5 seconds if still not connecting
        BleManager.connect(peripheralId)
            .then(() => {
                setIsConnected(true);
                setPeripheralId(peripheralId);
                console.log('Device Connected');
                BleManager.retrieveServices(peripheralId)
                    .then(peripheralInfo => {
                        console.log('Peripheral Info: ', peripheralInfo);
                        getUUID(peripheralInfo);
                        writeToMotor(
                            peripheralId,
                            '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
                            '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
                            [13],
                        );
                        listenToDevice(
                            peripheralId,
                            '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
                            '6e400003-b5a3-f393-e0a9-e50e24dcca9e',
                        );
                    })
                    .catch(err => {
                        console.log('Fail to retrieve peripheralInfo', err);
                    });
            })
            .catch(err => {
                console.log('Fail to Connect to ', peripheralId, err);
            })
            .finally(() => {
                setConnectingId('');
            });
    }

    /** 断开连接 */
    function disconnect(item: PeripheralWrapper) {
        BleManager.disconnect(item.peripheral.id)
            .then(() => {
                item.connected = false;
                console.log('Disconnected');
            })
            .catch(error => {
                console.log('Disconnected fail', error);
            });
        initData();
    }

    function disconnectToDevice(peripheralId: string) {
        BleManager.disconnect(peripheralId)
            .then(() => {
                console.log('Disconnected');
            })
            .catch(error => {
                console.log('Disconnected fail', error);
            });
        initData();
    }

    function notify(index: number) {
        if (isMonitoring) {
            console.log('Notification already started');
            alert('已经在监听');
            return;
        }
        BleManager.startNotification(
            peripheralId,
            notifyServiceUUID[index],
            notifyCharacteristicUUID[index],
        )
            .then(() => {
                setIsMonitoring(true);
                console.log('Notification started');
                alert('开启成功');
            })
            .catch(err => {
                setIsMonitoring(false);
                console.log('Start notification fail', err);
                alert('开启失败');
            });
    }

    function stopNotify(index: number) {
        BleManager.retrieveServices(peripheralId)
            .then(peripheralInfo => {
                console.log('Peripheral Info after write: ', peripheralInfo);
            })
            .catch(err => {
                console.log(err);
                alert('Fail to retrieve peripheralInfo from ');
            });
        BleManager.stopNotification(
            peripheralId,
            notifyServiceUUID[index],
            notifyCharacteristicUUID[index],
        )
            .then(() => {
                setIsMonitoring(false);
                console.log('Notification ended');
                alert('关闭成功');
            })
            .catch(err => {
                console.log('End notification fail', err);
                alert('关闭失败');
            });
    }

    function read(index: number) {
        BleManager.read(
            peripheralId,
            readServiceUUID[index],
            readCharacteristicUUID[index],
        )
            .then(data => {
                const str = byteToString(data);
                console.log('Read', data, str);
                setReadData(str);
            })
            .catch(err => {
                console.log('Read fail', err);
                alert('读取失败');
            });
    }

    function readFromDevice(
        peripheralId: string,
        serviceUUID: string,
        characteristicUUID: string,
    ) {
        BleManager.read(peripheralId, serviceUUID, characteristicUUID)
            .then(data => {
                const str = byteToString(data);
                console.log('Read', data, str);
                setReadData(str);
            })
            .catch(err => {
                console.log('Read fail', err);
                alert('读取失败');
            });
    }

    function write(writeType: 'write' | 'writeWithoutResponse', index: number) {
        if (input.length === 0) {
            alert('请输入消息内容');
            return;
        }

        if (writeType === 'write') {
            console.log('peripheralId', peripheralId);
            console.log(
                'writeWithResponseServiceUUID',
                writeWithResponseServiceUUID[index],
            );
            console.log(
                'writeWithResponseCharacteristicUUID',
                writeWithResponseCharacteristicUUID[index],
            );
            console.log(input);
            BleManager.write(
                peripheralId,
                '1818',
                '2a63',
                // writeWithResponseServiceUUID[index],
                // writeWithResponseCharacteristicUUID[index],
                input,
            )
                .then(() => {
                    console.log('Write success', input);
                    bleReceiveData.current = [];
                    setWriteData(input);
                    setInput([]);
                    alert('Write success');
                })
                .catch(err => {
                    console.log('Write failed', err);
                    alert('发送失败');
                });
        } else {
            BleManager.writeWithoutResponse(
                peripheralId,
                '1818',
                '2a63',
                // writeWithoutResponseServiceUUID[index],
                // writeWithoutResponseCharacteristicUUID[index],
                input,
            )
                .then(() => {
                    console.log('Write success', input);
                    bleReceiveData.current = [];
                    setWriteData(input);
                    setInput([]);

                    alert('send success');
                })
                .catch(err => {
                    console.log('Write failed', err);
                    alert('发送失败');
                });
        }
    }

    function writeToMotor(
        peripheralId: string,
        serviceUUID: string,
        characteristicUUID: string,
        motorInput: number[],
    ) {
        if (!motorInput || motorInput.length == 0) {
            return;
        }
        // const input = stringToByte(motorInput);
        console.log(
            `Attempting to write to device ${peripheralId} on characteristic ${characteristicUUID} with data:`,
            motorInput,
        );

        // const input = new Uint8Array(motorInput);

        BleManager.writeWithoutResponse(
            peripheralId,
            serviceUUID,
            characteristicUUID,
            motorInput,
        )
            .then(() => {
                console.log('Write success', input);

                // need to re retrieve the services after each write operation
                BleManager.retrieveServices(peripheralId);
            })
            .catch(err => {
                console.log('Write failed', err);
                BleManager.retrieveServices(peripheralId);
            });
    }

    // function writeToBleDevice(
    //   peripheralId: string,
    //   serviceUUID: string,
    //   characteristicUUID: string,
    //   data: string,
    // ) {
    //   if (!data) {
    //     return;
    //   }
    //   const input = stringToByte(data);
    //   console.log(
    //     `Attempting to write to device ${peripheralId} on characteristic ${characteristicUUID} with data:`,
    //     data,
    //   );

    //   BleManager.write(peripheralId, serviceUUID, characteristicUUID, input)
    //     .then(() => {
    //       console.log('Write success', input);
    //       // need to re retrieve the services after each write operation
    //       BleManager.retrieveServices(peripheralId);
    //     })
    //     .catch(err => {
    //       console.log('Write failed', err);
    //     });
    // }

    function listenToDevice(
        peripheralId: string,
        serviceUUID: string,
        characteristicUUID: string,
    ) {
        if (isMonitoring) {
            console.log('Notification already started');
            return;
        }
        try {
            BleManager.startNotification(
                peripheralId,
                serviceUUID,
                characteristicUUID,
            )
                .then(() => {
                    setIsMonitoring(true);
                    console.log('Notification started');
                    BleManager.retrieveServices(peripheralId);
                })
                .catch(err => {
                    setIsMonitoring(false);
                    console.log('Start notification fail', err);
                    BleManager.retrieveServices(peripheralId);
                });
        } catch (e) {
            console.log(e);
        }
    }

    function stopListenToDevice(
        peripheralId: string,
        serviceUUID: string,
        characteristicUUID: string,
    ) {
        BleManager.retrieveServices(peripheralId)
            .then(peripheralInfo => {
                console.log('Peripheral Info after write: ', peripheralInfo);
                BleManager.stopNotification(
                    peripheralId,
                    serviceUUID,
                    characteristicUUID,
                )
                    .then(() => {
                        setIsMonitoring(false);
                        console.log('Notification ended');
                    })
                    .catch(err => {
                        console.log('End notification fail', err);
                    });
            })
            .catch(err => {
                console.log('Fail to retrieve peripheralInfo from ', err);
            });
    }

    function alert(text: string) {
        showAlert({
            title: 'Message',
            message: text
        });
    }

    return {
        scaning,
        bleDevice,
        startScan,
        stopScan,
        connect,
        disconnect,
        peripheralId,
        setPeripheralId,
        writeData,
        writeWithResponseCharacteristicUUID,
        writeWithoutResponseCharacteristicUUID,
        readCharacteristicUUID,
        notifyCharacteristicUUID,
        readData,
        receiveData,
        isMonitoring,
        notify,
        stopNotify,
        read,
        write,
        input,
        setInput,
        stringToByte,
        isConnected,
        setIsConnected,
        connectToDevice,
        disconnectToDevice,
        writeToMotor,
        bleState,
        checkBleState,
        listenToDevice,
        stopListenToDevice,
        readFromDevice,
    };
};
