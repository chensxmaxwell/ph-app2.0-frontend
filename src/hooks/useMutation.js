import { gql } from '@apollo/client';

export const UPDATE_DEVICE = gql`
  mutation UpdateDevice(
    $userData: [UpdateDeviceInput]
    $userOnboardingData: [UpdateDeviceInput]
  ) {
    updateDevice(userData: $userData, userOnboardingData: $userOnboardingData) {
      id
      userId
      name
      peripheralID
      settings {
        intensity
        mode
      }
      userData {
        timeStamp
        data
      }
      userOnboardingData {
        timeStamp
        data
      }
    }
  }
`;
