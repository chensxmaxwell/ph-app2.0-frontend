import { gql, useMutation, useQuery } from "@apollo/client";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ANONYMOUS_USER_NAME,
  SessionUser,
  isBypassUser,
  resolveHomeDisplayName,
} from "./display-name";

export const useProfile = () => {
  const GET_USER = gql`
    query {
      currentUser {
        id
        email
      }
    }
  `;

  const GET_PROFILE = gql`
    query {
      getUserProfile {
        userId
        nickName
        profilePicture
        personalInfo {
          age
          height
          weight
          biographicalInfo
          sexualOrientation
          birthday
        }
      }
    }
  `;

  const ADD_PROFILE = gql`
    mutation AddUserProfile($input: UserProfileInput!) {
      addUserProfile(input: $input) {
        userId
        nickName
        personalInfo {
          birthday
        }
      }
    }
  `;

  const UPDATE_PROFILE = gql`
    mutation UpdateUserProfile($input: UserProfileInput!) {
      updateUserProfile(input: $input) {
        nickName
        personalInfo {
          birthday
        }
      }
    }
  `;

  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [user, setUser] = useState({
    id: "",
    email: "",
  });
  const [profile, setProfile] = useState({
    name: "",
    gender: "",
    birthday: "",
    height: "",
    weight: "",
  });

  useEffect(() => {
    AsyncStorage.getItem("user")
      .then((raw) => {
        if (!raw) {
          return;
        }
        const parsed = JSON.parse(raw) as SessionUser;
        setSessionUser(parsed);
        if (parsed.id || parsed.email) {
          setUser({
            id: parsed.id ?? "",
            email: parsed.email ?? "",
          });
        }
      })
      .catch(() => undefined)
      .finally(() => setSessionReady(true));
  }, []);

  const bypass = isBypassUser(sessionUser);
  const skipRemote = !sessionReady || bypass || !sessionUser;

  const {
    loading: userLoading,
    error: userError,
    data: userData,
  } = useQuery(GET_USER, { skip: skipRemote });

  useEffect(() => {
    if (userError) return;
    if (!userLoading && userData) {
      setUser({
        id: userData.currentUser.id,
        email: userData.currentUser.email,
      });
    }
  }, [userLoading, userData, userError]);

  const {
    loading: profileLoading,
    error: profileError,
    data: profileData,
    refetch,
  } = useQuery(GET_PROFILE, { skip: skipRemote });

  const [addProfileMutation] = useMutation(ADD_PROFILE);

  useEffect(() => {
    if (skipRemote || profileError) return;
    if (!profileLoading && profileData) {
      if (!profileData.getUserProfile) {
        addProfileMutation({
          variables: {
            input: {
              nickName: ANONYMOUS_USER_NAME,
              personalInfo: {
                birthday: "01/01/2000",
              },
            },
          },
        }).catch(() => undefined);
      }
    }
  }, [addProfileMutation, profileError, profileLoading, profileData, skipRemote]);

  const [updateProfileMutation] = useMutation(UPDATE_PROFILE);

  const updateProfile = async (newProfile: {
    name: string;
    birthday: string;
  }) => {
    try {
      const { data } = await updateProfileMutation({
        variables: {
          input: {
            nickName: newProfile.name,
            personalInfo: {
              birthday: newProfile.birthday,
            },
          },
        },
      });

      if (data) {
        await refetch();
      }
    } catch (error) {
      console.error("Error updating profile:", error);
    }
  };

  useEffect(() => {
    if (skipRemote || !profileData?.getUserProfile) {
      return;
    }
    setProfile((prevProfile) => ({
      ...prevProfile,
      name: profileData.getUserProfile?.nickName ?? prevProfile.name,
      birthday:
        profileData.getUserProfile?.personalInfo?.birthday ??
        prevProfile.birthday,
    }));
  }, [profileData, skipRemote]);

  const displayName = resolveHomeDisplayName({
    user: sessionUser,
    profileName: profile.name,
  });

  const isValidDate = (dateStr: string): boolean => {
    const regex = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;

    if (!regex.test(dateStr)) return false;

    const [day, month, year] = dateStr.split("/").map(Number);
    const date = new Date(year, month - 1, day);

    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  };

  const formatDate = (dateStr: string): string => {
    if (!dateStr) {
      return "—";
    }
    if (!isValidDate(dateStr)) {
      return "Invalid Date";
    }

    const [day, month, year] = dateStr.split("/").map(Number);
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const getOrdinalSuffix = (d: number) => {
      if (d > 3 && d < 21) return "th";
      switch (d % 10) {
        case 1:
          return "st";
        case 2:
          return "nd";
        case 3:
          return "rd";
        default:
          return "th";
      }
    };

    return `${day}${getOrdinalSuffix(day)} ${monthNames[month - 1]} ${year}`;
  };

  return {
    user,
    profile,
    displayName,
    setProfile,
    updateProfile,
    isValidDate,
    formatDate,
  };
};
