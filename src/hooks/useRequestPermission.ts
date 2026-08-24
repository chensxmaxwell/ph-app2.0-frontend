import {Platform, PermissionsAndroid, Permission} from 'react-native';

export enum PermissionEnum {
  bluetoothConnect = 'android.permission.BLUETOOTH_CONNECT',
  bluetoothScan = 'android.permission.BLUETOOTH_SCAN',
  fineLocation = 'android.permission.ACCESS_FINE_LOCATION',
}

export const useRequestPermission = () => {
  const requestPermission = (permission: Permission): Promise<void> => {
    return new Promise((resolve, reject) => {
      // sepecial case bluetooth connection for android v12 or below
      if (
        Platform.OS === 'android' &&
        ((Platform.Version >= 31 &&
          permission !== PermissionEnum.fineLocation) ||
          (Platform.Version < 31 && permission === PermissionEnum.fineLocation))
      ) {
        PermissionsAndroid.check(permission).then(result => {
          if (result) {
            console.log(permission, 'is OK');
            resolve();
          } else {
            PermissionsAndroid.request(permission).then(result => {
              if (result) {
                console.log('User accepted', permission, result);
                resolve();
              } else {
                console.log('User refused', permission, result);
                reject(
                  new Error(
                    'App need ' +
                      permission.substring(8) +
                      ' in order to function',
                  ),
                );
              }
            });
          }
        });
      } else {
        resolve();
      }
    });
  };
  return requestPermission;
};
