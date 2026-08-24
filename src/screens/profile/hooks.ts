import { gql, useMutation, useQuery } from "@apollo/client";
import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

  const [user, setUser] = useState({
    id: "",
    email: "123456@gmail.com",
  });

  const [profile, setProfile] = useState({
    name: "Amanda Guo",
    gender: "Female",
    birthday: "13/04/2022",
    height: "",
    weight: "",
  });

  const {
    loading: userLoading,
    error: userError,
    data: userData,
  } = useQuery(GET_USER);

  useEffect(() => {
    if (userError) return;
    if (!userLoading && userData) {
      console.log("userData: ", userData);

      setUser({
        id: userData.currentUser.id,
        email: userData.currentUser.email,
      });
    }
  }, [userLoading, userData]);

  const {
    loading: profileLoading,
    error: profileError,
    data: profileData,
    refetch,
  } = useQuery(GET_PROFILE);

  const [addProfileMutation] = useMutation(ADD_PROFILE);

  useEffect(() => {
    if (profileError) return;
    if (!profileLoading && profileData) {
      console.log("profileData: ", profileData);

      if (!profileData.getUserProfile) {
        addProfileMutation({
          variables: {
            input: {
              nickName: "Amanda Guo",
              personalInfo: {
                birthday: "01/01/2000",
              },
            },
          },
        })
          .then((res) => {
            console.log("Profile created:", res.data);
          })
          .catch((err) => {
            console.error("Error creating profile:", err);
          });
      }
    }
  }, [profileLoading, profileData]);

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
        console.log("Profile updated successfully: ", data);
        await refetch();
      }
    } catch (error) {
      console.error("Error updating profile:", error);
    }
  };

  useEffect(() => {
    if (!profileLoading && profileData) {
      setProfile((prevProfile) => ({
        ...prevProfile,
        name: profileData.getUserProfile?.nickName,
        birthday: profileData.getUserProfile?.personalInfo?.birthday,
      }));
    }
  }, [profileData]);

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
    const [day, month, year] = dateStr.split("/").map(Number);

    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return "Invalid Date";
    }

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

  return { user, profile, setProfile, updateProfile, isValidDate, formatDate };
};
